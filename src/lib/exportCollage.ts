import { PhotoItem, CollageLayout } from '@/types/collage';
import { loadImage } from '@/lib/imageUtils';
import { getDisplayCrop } from '@/lib/cropUtils';
import { isMobileDevice, isIOS } from '@/lib/platform';

export async function exportCollageAsPng(
  photos: PhotoItem[],
  layout: CollageLayout,
  gapColor: string,
  scale: number = 1
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not create canvas context');
  }

  // Set canvas size with optional scaling for higher resolution
  canvas.width = layout.width * scale;
  canvas.height = layout.height * scale;

  // Fill background with gap color
  ctx.fillStyle = gapColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw each cell
  for (const cell of layout.cells) {
    const photo = photos.find((p) => p.id === cell.photoId);
    if (!photo) continue;

    // Create Object URL from blob for image loading
    const imgUrl = URL.createObjectURL(photo.blob);
    try {
      const img = await loadImage(imgUrl);
      const crop = getDisplayCrop(photo);

      if (crop) {
        // Draw cropped image
        ctx.drawImage(
          img,
          crop.x,
          crop.y,
          crop.width,
          crop.height,
          cell.x * scale,
          cell.y * scale,
          cell.width * scale,
          cell.height * scale
        );
      } else {
        // Draw full image scaled to fit
        ctx.drawImage(
          img,
          0,
          0,
          photo.originalWidth,
          photo.originalHeight,
          cell.x * scale,
          cell.y * scale,
          cell.width * scale,
          cell.height * scale
        );
      }
    } finally {
      // Clean up the temporary Object URL
      URL.revokeObjectURL(imgUrl);
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      },
      'image/png',
      1.0
    );
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function shareOrDownload(blob: Blob, filename: string): Promise<void> {
  // iOS Safari: navigator.share() and programmatic <a download> both
  // require a live user-gesture activation. Our canvas render awaits
  // for ~seconds and consumes that activation, so both fail silently.
  // Workaround: open the blob in a new tab so the user can long-press
  // → Save Image (Apple's blessed fallback). Falls back to download
  // if the popup is blocked.
  if (isIOS()) {
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      // Revoke after the new tab has had time to load the blob.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return;
    }
    URL.revokeObjectURL(url);
    downloadBlob(blob, filename);
    return;
  }

  // Android: navigator.share() tolerates a post-await call. Try it,
  // fall back to a regular download.
  if (isMobileDevice()) {
    const file = new File([blob], filename, { type: 'image/png' });
    const shareData = { files: [file] };

    if (navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        // Fall through to download
      }
    }
  }

  // Desktop always gets direct download
  downloadBlob(blob, filename);
}
