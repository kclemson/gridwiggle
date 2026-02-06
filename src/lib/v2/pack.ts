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
  
  // Calculate row heights that fill the region exactly
  // Each row height is proportional to its "natural height"
  // Natural height of a row = 1 / sum(aspectRatios) * rowWidth
  const totalRowGaps = gap * (rows.length - 1);
  const availableHeight = region.height - totalRowGaps;
  
  // Calculate natural height weight for each row
  const rowWeights = rows.map(row => {
    const sumAR = sum(row.map(p => p.aspectRatio));
    // Natural height at unit width = 1 / sumAR
    return 1 / sumAR;
  });
  
  const totalWeight = sum(rowWeights);
  
  // Allocate height proportionally
  const rowHeights = rowWeights.map(w => (w / totalWeight) * availableHeight);
  
  // Generate cells for each row
  const cells: LayoutCell[] = [];
  let y = region.y;
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowHeight = rowHeights[i];
    const rowRegion: RegionSpec = {
      x: region.x,
      y,
      width: region.width,
      height: rowHeight,
    };
    
    cells.push(...packRow(row, rowRegion, gap));
    y += rowHeight + gap;
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
