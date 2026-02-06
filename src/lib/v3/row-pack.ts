/**
 * Row Packing
 * 
 * Packs photos into rows within a region.
 * Row count is derived from geometry, not specified.
 */

import { PhotoDimension, RegionSpec, LayoutCell, V3Tuning } from './types';
import { mean } from './utils';

// ============================================================================
// Row Packing
// ============================================================================

/**
 * Pack photos into a region using row-based layout.
 * 
 * The algorithm:
 * 1. Calculate optimal row count from region geometry and photo ARs
 * 2. Distribute photos across rows
 * 3. Scale each row to fill region width
 * 4. Stack rows with gaps
 */
export function packPhotosIntoRegion(
  photos: PhotoDimension[],
  region: RegionSpec,
  gap: number,
  tuning: V3Tuning
): { cells: LayoutCell[]; actualHeight: number } {
  if (photos.length === 0) {
    return { cells: [], actualHeight: 0 };
  }
  
  // Single photo: fill the region width, maintain aspect ratio
  if (photos.length === 1) {
    const photo = photos[0];
    const width = region.width;
    const height = width / photo.aspectRatio;
    
    return {
      cells: [{
        photoId: photo.id,
        x: region.x,
        y: region.y,
        width,
        height,
      }],
      actualHeight: height,
    };
  }
  
  // Calculate optimal row count from geometry
  const rowCount = calculateOptimalRowCount(photos, region, gap, tuning);
  
  // Distribute photos across rows
  const rows = distributeToRows(photos, rowCount);
  
  // Pack each row and stack them
  return packRows(rows, region, gap);
}

/**
 * Calculate optimal row count based on region geometry and photo ARs.
 * 
 * Goal: Find row count that gives roughly equal-height rows while
 * respecting region_minWidth for cells.
 */
function calculateOptimalRowCount(
  photos: PhotoDimension[],
  region: RegionSpec,
  gap: number,
  tuning: V3Tuning
): number {
  const avgAR = mean(photos.map(p => p.aspectRatio));
  const n = photos.length;
  
  // Estimate: If we have r rows with n/r photos each
  // Row height ≈ (regionWidth - gaps) / (photosPerRow * avgAR)
  // Total height ≈ r * rowHeight
  // 
  // We want rows where cells aren't too narrow (region_minWidth)
  // Max photos per row ≈ regionWidth / region_minWidth
  const maxPhotosPerRow = Math.floor(region.width / tuning.region_minWidth);
  const minRows = Math.ceil(n / maxPhotosPerRow);
  
  // Also don't want too many rows - estimate based on reasonable cell height
  // A cell with avgAR at minWidth has height = minWidth / avgAR
  // Max rows ≈ regionHeight / (minWidth / avgAR)
  // But region height is dynamic, so we use a heuristic
  const maxRows = Math.ceil(n / 2); // At least 2 photos per row on average
  
  // Target: distribute evenly, respecting bounds
  const targetRows = Math.max(minRows, Math.min(maxRows, Math.ceil(Math.sqrt(n / avgAR))));
  
  return Math.max(1, targetRows);
}

/**
 * Distribute photos across rows as evenly as possible.
 */
function distributeToRows(photos: PhotoDimension[], rowCount: number): PhotoDimension[][] {
  const rows: PhotoDimension[][] = Array.from({ length: rowCount }, () => []);
  const photosPerRow = Math.ceil(photos.length / rowCount);
  
  photos.forEach((photo, index) => {
    const rowIndex = Math.min(Math.floor(index / photosPerRow), rowCount - 1);
    rows[rowIndex].push(photo);
  });
  
  // Remove empty rows
  return rows.filter(row => row.length > 0);
}

/**
 * Pack rows into the region, scaling each to fill width.
 */
function packRows(
  rows: PhotoDimension[][],
  region: RegionSpec,
  gap: number
): { cells: LayoutCell[]; actualHeight: number } {
  const cells: LayoutCell[] = [];
  let currentY = region.y;
  
  rows.forEach((row, rowIndex) => {
    // Calculate row's natural aspect ratio (sum of photo ARs)
    const rowAR = row.reduce((sum, p) => sum + p.aspectRatio, 0);
    
    // Available width after gaps
    const availableWidth = region.width - (row.length - 1) * gap;
    
    // Row height when scaled to fit available width
    const rowHeight = availableWidth / rowAR;
    
    // Position each photo in the row
    let currentX = region.x;
    row.forEach(photo => {
      const cellWidth = rowHeight * photo.aspectRatio;
      
      cells.push({
        photoId: photo.id,
        x: currentX,
        y: currentY,
        width: cellWidth,
        height: rowHeight,
      });
      
      currentX += cellWidth + gap;
    });
    
    currentY += rowHeight + gap;
  });
  
  // Actual height is total rows + gaps (minus trailing gap)
  const actualHeight = currentY - region.y - gap;
  
  return { cells, actualHeight: Math.max(0, actualHeight) };
}
