/**
 * Single column / single row layout builder.
 *
 * Bypasses the V4 multi-region engine when the user has explicitly chosen a
 * one-strip layout. Each photo keeps its display aspect ratio and sits in
 * order along a single axis with uniform gaps.
 */

import { CollageLayout } from '@/types/collage';
import { PhotoDimension } from '@/lib/v3/types';

const VIRTUAL_CANVAS_BASE = 1000;

export type StripeDirection = 'column' | 'row';

/**
 * Build a single-column or single-row layout that exactly fits all photos
 * at their input aspect ratios. The fixed axis equals VIRTUAL_CANVAS_BASE;
 * the other axis grows with content + gaps.
 */
export function generateSingleStripeLayout(
  dimensions: PhotoDimension[],
  normalizedGap: number,
  direction: StripeDirection,
): CollageLayout {
  if (dimensions.length === 0) {
    return { width: VIRTUAL_CANVAS_BASE, height: VIRTUAL_CANVAS_BASE, cells: [] };
  }

  const gap = Math.max(0, normalizedGap) * VIRTUAL_CANVAS_BASE;

  if (direction === 'column') {
    const width = VIRTUAL_CANVAS_BASE;
    const cellHeights = dimensions.map((d) => width / Math.max(0.01, d.aspectRatio));
    const totalGap = gap * (dimensions.length - 1);
    const totalHeight = cellHeights.reduce((s, h) => s + h, 0) + totalGap;

    let y = 0;
    const cells = dimensions.map((d, i) => {
      const h = cellHeights[i];
      const cell = {
        photoId: d.id,
        x: 0,
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(h),
      };
      y += h + gap;
      return cell;
    });

    return {
      width: Math.round(width),
      height: Math.round(totalHeight),
      cells,
    };
  }

  // row
  const height = VIRTUAL_CANVAS_BASE;
  const cellWidths = dimensions.map((d) => height * d.aspectRatio);
  const totalGap = gap * (dimensions.length - 1);
  const totalWidth = cellWidths.reduce((s, w) => s + w, 0) + totalGap;

  let x = 0;
  const cells = dimensions.map((d, i) => {
    const w = cellWidths[i];
    const cell = {
      photoId: d.id,
      x: Math.round(x),
      y: 0,
      width: Math.round(w),
      height: Math.round(height),
    };
    x += w + gap;
    return cell;
  });

  return {
    width: Math.round(totalWidth),
    height: Math.round(height),
    cells,
  };
}