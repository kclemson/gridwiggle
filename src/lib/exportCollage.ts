import { PhotoItem, CollageLayout } from '@/types/collage';
import { loadImage } from '@/lib/imageUtils';
import { getDisplayCrop } from '@/lib/cropUtils';
import { isMobileDevice } from '@/lib/platform';

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
  // Mobile: open the native share sheet (iOS shows "Save Image",
  // Android shows the system share picker including Save to Files /
  // Photos). For this to work on iOS the call MUST happen inside a
  // live user-gesture activation — callers should pre-render the blob
  // so this runs synchronously after the click.
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

  // Desktop (or mobile share unavailable) gets direct download
  downloadBlob(blob, filename);
}
