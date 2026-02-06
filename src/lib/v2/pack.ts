/**
 * V2 Rectangle Packing
 * 
 * The single primitive for packing photos into rectangular regions.
 * This is the core building block - all layout strategies use this.
 */

import { PhotoDimension, RegionSpec, LayoutCell } from './types';
import { sum, mean } from './math';

// ============================================================================
// Core Packing Primitive
// ============================================================================

export type PackDirection = 'horizontal' | 'vertical' | 'auto';

/**
 * Pack photos into a row (horizontal strip).
 * All photos will have the same height, widths vary by aspect ratio.
 * 
 * @param photos - Photos to pack
 * @param region - Available region to fill
 * @param gap - Gap between photos
 * @returns Array of cells positioned within the region
 */
export function packRow(
  photos: PhotoDimension[],
  region: RegionSpec,
  gap: number
): LayoutCell[] {
  if (photos.length === 0) return [];
  
  const totalGap = gap * (photos.length - 1);
  const availableWidth = region.width - totalGap;
  
  // Calculate row height that makes all photos fit exactly
  // Sum of (rowHeight * ar) = availableWidth
  // rowHeight * sum(ar) = availableWidth
  // rowHeight = availableWidth / sum(ar)
  const totalAR = sum(photos.map(p => p.aspectRatio));
  const rowHeight = availableWidth / totalAR;
  
  // Position each photo
  const cells: LayoutCell[] = [];
  let x = region.x;
  
  for (const photo of photos) {
    const width = rowHeight * photo.aspectRatio;
    cells.push({
      photoId: photo.id,
      x,
      y: region.y,
      width,
      height: rowHeight,
    });
    x += width + gap;
  }
  
  return cells;
}

/**
 * Pack photos into a column (vertical strip).
 * All photos will have the same width, heights vary by aspect ratio.
 * 
 * @param photos - Photos to pack
 * @param region - Available region to fill
 * @param gap - Gap between photos
 * @returns Array of cells positioned within the region
 */
export function packColumn(
  photos: PhotoDimension[],
  region: RegionSpec,
  gap: number
): LayoutCell[] {
  if (photos.length === 0) return [];
  
  const totalGap = gap * (photos.length - 1);
  const availableHeight = region.height - totalGap;
  
  // Calculate column width that makes all photos fit exactly
  // Sum of (colWidth / ar) = availableHeight
  // colWidth * sum(1/ar) = availableHeight
  // colWidth = availableHeight / sum(1/ar)
  const totalInverseAR = sum(photos.map(p => 1 / p.aspectRatio));
  const colWidth = availableHeight / totalInverseAR;
  
  // Position each photo
  const cells: LayoutCell[] = [];
  let y = region.y;
  
  for (const photo of photos) {
    const height = colWidth / photo.aspectRatio;
    cells.push({
      photoId: photo.id,
      x: region.x,
      y,
      width: colWidth,
      height,
    });
    y += height + gap;
  }
  
  return cells;
}

/**
 * Pack photos into multiple rows to fill a region.
 * Automatically determines how many rows based on aspect ratios.
 * 
 * @param photos - Photos to pack
 * @param region - Available region to fill
 * @param gap - Gap between photos and rows
 * @param targetPhotosPerRow - Hint for ideal photos per row
 * @returns Array of cells filling the region
 */
export function packRowsToFit(
  photos: PhotoDimension[],
  region: RegionSpec,
  gap: number,
  targetPhotosPerRow: number = 3.5
): LayoutCell[] {
  if (photos.length === 0) return [];
  
  // Determine row count based on photo count and target
  const rowCount = Math.max(1, Math.round(photos.length / targetPhotosPerRow));
  
  // Distribute photos across rows evenly
  const photosPerRow = Math.ceil(photos.length / rowCount);
  const rows: PhotoDimension[][] = [];
  
  for (let i = 0; i < photos.length; i += photosPerRow) {
    rows.push(photos.slice(i, Math.min(i + photosPerRow, photos.length)));
  }
  
  // Build cells row by row, letting each row take its natural height
  // This follows V1's proven approach: calculate height once, use everywhere
  const cells: LayoutCell[] = [];
  let y = region.y;
  
  for (const row of rows) {
    // Calculate THIS row's natural height (like V1 does)
    const totalAR = sum(row.map(p => p.aspectRatio));
    const availableWidth = region.width - gap * (row.length - 1);
    const rowHeight = availableWidth / totalAR;
    
    // Position photos in this row
    let x = region.x;
    for (const photo of row) {
      const width = rowHeight * photo.aspectRatio;
      cells.push({
        photoId: photo.id,
        x,
        y,
        width,
        height: rowHeight,  // Same height used for cells
      });
      x += width + gap;
    }
    
    y += rowHeight + gap;  // Same height used for Y advancement
  }
  
  return cells;
}

/**
 * Calculate the natural aspect ratio of a set of rows.
 * This is the aspect ratio the content would have if packed without constraints.
 */
export function calculateNaturalAspectRatio(
  photos: PhotoDimension[],
  gap: number,
  targetPhotosPerRow: number = 3.5
): number {
  if (photos.length === 0) return 1;
  
  const rowCount = Math.max(1, Math.round(photos.length / targetPhotosPerRow));
  const photosPerRow = Math.ceil(photos.length / rowCount);
  
  // Calculate average row aspect ratio
  let totalRowAR = 0;
  for (let i = 0; i < photos.length; i += photosPerRow) {
    const row = photos.slice(i, Math.min(i + photosPerRow, photos.length));
    const rowAR = sum(row.map(p => p.aspectRatio));
    totalRowAR += rowAR;
  }
  
  const avgRowAR = totalRowAR / rowCount;
  
  // Overall AR considers row stacking
  // With gaps, actual AR is more complex, but this is a good approximation
  return avgRowAR / rowCount;
}

// ============================================================================
// Beside Packing (for hero-side layouts)
// ============================================================================

export interface BesidePackResult {
  cells: LayoutCell[];
  combinedHeight: number;
}

/**
 * Pack photos as a single horizontal row beside the hero.
 * All photos share the same height and fill the target width exactly.
 */
export function packBeside1Row(
  photos: PhotoDimension[],
  targetWidth: number,
  gap: number,
  offsetX: number,
  offsetY: number
): BesidePackResult {
  if (photos.length === 0) return { cells: [], combinedHeight: 0 };
  
  const totalGaps = gap * (photos.length - 1);
  const availableWidth = targetWidth - totalGaps;
  const aspectSum = sum(photos.map(p => p.aspectRatio));
  const rowHeight = availableWidth / aspectSum;
  
  const cells: LayoutCell[] = [];
  let x = offsetX;
  
  for (const photo of photos) {
    const width = rowHeight * photo.aspectRatio;
    cells.push({
      photoId: photo.id,
      x,
      y: offsetY,
      width,
      height: rowHeight,
    });
    x += width + gap;
  }
  
  return { cells, combinedHeight: rowHeight };
}

/**
 * Pack photos as 2 horizontal rows beside the hero.
 * Each row fills the target width exactly.
 */
export function packBeside2Rows(
  photos: PhotoDimension[],
  targetWidth: number,
  gap: number,
  offsetX: number,
  offsetY: number
): BesidePackResult {
  if (photos.length === 0) return { cells: [], combinedHeight: 0 };
  if (photos.length === 1) return packBeside1Row(photos, targetWidth, gap, offsetX, offsetY);
  
  // Split photos between 2 rows
  const midpoint = Math.ceil(photos.length / 2);
  const row1Photos = photos.slice(0, midpoint);
  const row2Photos = photos.slice(midpoint);
  
  // Calculate heights for each row to fill targetWidth
  const row1Gaps = gap * (row1Photos.length - 1);
  const row1AspectSum = sum(row1Photos.map(p => p.aspectRatio));
  const row1Height = (targetWidth - row1Gaps) / row1AspectSum;
  
  const row2Gaps = gap * (row2Photos.length - 1);
  const row2AspectSum = sum(row2Photos.map(p => p.aspectRatio));
  const row2Height = (targetWidth - row2Gaps) / row2AspectSum;
  
  const combinedHeight = row1Height + gap + row2Height;
  
  const cells: LayoutCell[] = [];
  
  // Row 1
  let x = offsetX;
  for (const photo of row1Photos) {
    const width = row1Height * photo.aspectRatio;
    cells.push({
      photoId: photo.id,
      x,
      y: offsetY,
      width,
      height: row1Height,
    });
    x += width + gap;
  }
  
  // Row 2
  x = offsetX;
  for (const photo of row2Photos) {
    const width = row2Height * photo.aspectRatio;
    cells.push({
      photoId: photo.id,
      x,
      y: offsetY + row1Height + gap,
      width,
      height: row2Height,
    });
    x += width + gap;
  }
  
  return { cells, combinedHeight };
}

/**
 * Pack photos as 3 horizontal rows beside the hero.
 * Each row fills the target width exactly.
 */
export function packBeside3Rows(
  photos: PhotoDimension[],
  targetWidth: number,
  gap: number,
  offsetX: number,
  offsetY: number
): BesidePackResult {
  if (photos.length === 0) return { cells: [], combinedHeight: 0 };
  if (photos.length <= 2) return packBeside1Row(photos, targetWidth, gap, offsetX, offsetY);
  if (photos.length <= 4) return packBeside2Rows(photos, targetWidth, gap, offsetX, offsetY);
  
  // Split photos into 3 rows (first rows get extras)
  const basePerRow = Math.floor(photos.length / 3);
  const remainder = photos.length % 3;
  
  const row1Count = basePerRow + (remainder >= 1 ? 1 : 0);
  const row2Count = basePerRow + (remainder >= 2 ? 1 : 0);
  
  const row1Photos = photos.slice(0, row1Count);
  const row2Photos = photos.slice(row1Count, row1Count + row2Count);
  const row3Photos = photos.slice(row1Count + row2Count);
  
  // Calculate heights for each row
  const row1Gaps = gap * (row1Photos.length - 1);
  const row1AspectSum = sum(row1Photos.map(p => p.aspectRatio));
  const row1Height = (targetWidth - row1Gaps) / row1AspectSum;
  
  const row2Gaps = gap * (row2Photos.length - 1);
  const row2AspectSum = sum(row2Photos.map(p => p.aspectRatio));
  const row2Height = (targetWidth - row2Gaps) / row2AspectSum;
  
  const row3Gaps = gap * (row3Photos.length - 1);
  const row3AspectSum = sum(row3Photos.map(p => p.aspectRatio));
  const row3Height = (targetWidth - row3Gaps) / row3AspectSum;
  
  const combinedHeight = row1Height + gap + row2Height + gap + row3Height;
  
  const cells: LayoutCell[] = [];
  let currentY = offsetY;
  
  // Row 1
  let x = offsetX;
  for (const photo of row1Photos) {
    const width = row1Height * photo.aspectRatio;
    cells.push({
      photoId: photo.id,
      x,
      y: currentY,
      width,
      height: row1Height,
    });
    x += width + gap;
  }
  currentY += row1Height + gap;
  
  // Row 2
  x = offsetX;
  for (const photo of row2Photos) {
    const width = row2Height * photo.aspectRatio;
    cells.push({
      photoId: photo.id,
      x,
      y: currentY,
      width,
      height: row2Height,
    });
    x += width + gap;
  }
  currentY += row2Height + gap;
  
  // Row 3
  x = offsetX;
  for (const photo of row3Photos) {
    const width = row3Height * photo.aspectRatio;
    cells.push({
      photoId: photo.id,
      x,
      y: currentY,
      width,
      height: row3Height,
    });
    x += width + gap;
  }
  
  return { cells, combinedHeight };
}
