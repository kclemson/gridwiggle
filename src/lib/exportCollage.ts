import { PhotoItem, CollageLayout, LabelPosition } from '@/types/collage';
import { loadImage } from '@/lib/imageUtils';
import { getDisplayCrop } from '@/lib/cropUtils';
import { isMobileDevice, isIOS } from '@/lib/platform';
import { autoTextColor, getDisplayLabel, labelFontPx } from '@/lib/labelStyle';

export async function exportCollageAsPng(
  photos: PhotoItem[],
  layout: CollageLayout,
  gapColor: string,
  scale: number = 1,
  labelPosition: LabelPosition = 'bc',
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

  // One uniform label font size for the whole collage. Shared with the
  // on-screen preview via `labelFontPx` so the export is WYSIWYG.
  const labelFontSize = labelFontPx(layout.width * scale, layout.height * scale);

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

    // Draw label overlay whenever the photo has explicit label text.
    // Placeholder hints from "Custom labels" mode are preview-only and
    // never reach this path because they don't set `photo.label`.
    if (getDisplayLabel(photo)) {
      drawLabel(ctx, photo, cell, gapColor, scale, labelPosition, labelFontSize);
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

function drawLabel(
  ctx: CanvasRenderingContext2D,
  photo: PhotoItem,
  cell: { x: number; y: number; width: number; height: number },
  gapColor: string,
  scale: number,
  labelPosition: LabelPosition,
  fontSize: number,
) {
  const text = getDisplayLabel(photo).trim();
  if (!text) return;
  const pos = labelPosition;

  const cellW = cell.width * scale;
  const cellH = cell.height * scale;
  const cellX = cell.x * scale;
  const cellY = cell.y * scale;

  const padX = fontSize * 0.6;
  const padY = fontSize * 0.25;
  const inset = 0;

  ctx.font = `600 ${fontSize}px -apple-system, system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  const metrics = ctx.measureText(text);
  // Cap pill width to cell minus insets so it never exceeds the photo
  const maxPillW = cellW - inset * 2;
  const pillW = Math.min(metrics.width + padX * 2, maxPillW);
  const pillH = fontSize * 1.2 + padY * 2;

  let pillX: number;
  let pillY: number;
  if (pos.endsWith('l')) pillX = cellX + inset;
  else if (pos.endsWith('r')) pillX = cellX + cellW - inset - pillW;
  else pillX = cellX + (cellW - pillW) / 2;

  if (pos.startsWith('t')) pillY = cellY + inset;
  else pillY = cellY + cellH - inset - pillH;

  ctx.fillStyle = gapColor;
  ctx.fillRect(pillX, pillY, pillW, pillH);

  // Clip text to pill so long labels don't bleed past the rectangle
  ctx.save();
  ctx.beginPath();
  ctx.rect(pillX, pillY, pillW, pillH);
  ctx.clip();
  ctx.fillStyle = autoTextColor(gapColor);
  ctx.textAlign = 'left';
  ctx.fillText(text, pillX + padX, pillY + pillH / 2);
  ctx.restore();
}

export function downloadBlob(blob: Blob, filename: string): 'download' | 'navigate' {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // iOS Safari ignores <a download> for blob URLs and does nothing visible.
  // As a last resort, navigate to the blob so the user at least sees the
  // image and can long-press to save.
  if (isIOS()) {
    window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return 'navigate';
  }

  URL.revokeObjectURL(url);
  return 'download';
}

export type ShareOutcome =
  | 'share-ok'
  | 'share-aborted'
  | `share-rejected:${string}`
  | 'download'
  | 'navigate';

export async function shareOrDownload(blob: Blob, filename: string): Promise<ShareOutcome> {
  if (isMobileDevice() && typeof navigator.share === 'function') {
    const file = new File([blob], filename, { type: 'image/png' });
    const shareData = { files: [file] };

    if (navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        return 'share-ok';
      } catch (err) {
        const name = (err as Error).name || 'Unknown';
        if (name === 'AbortError') return 'share-aborted';
        // Fall through to download so the user still gets a file.
        downloadBlob(blob, filename);
        return `share-rejected:${name}` as ShareOutcome;
      }
    }
  }

  return downloadBlob(blob, filename);
}
