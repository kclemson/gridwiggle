import { PhotoItem, CollageLayout } from '@/types/collage';
import { getActiveCrop, loadImage } from '@/lib/imageUtils';

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
      const crop = getActiveCrop(photo);

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
  const file = new File([blob], filename, { type: 'image/png' });
  const shareData = { files: [file] };
  
  // Check if Web Share API with file support is available (mobile browsers)
  if (navigator.canShare && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData);
      return;
    } catch (err) {
      // User cancelled - that's fine
      if ((err as Error).name === 'AbortError') return;
      // Other error - fall through to download
    }
  }
  
  // Fallback to traditional download (desktop)
  downloadBlob(blob, filename);
}
