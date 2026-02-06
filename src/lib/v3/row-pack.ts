/**
 * Row Packing
 * 
 * Packs photos into rows within a region.
 * Row count is derived from geometry, not specified.
 * Supports constraint-aware packing (maxCellArea, maxHeight).
 */

import { PhotoDimension, RegionSpec, LayoutCell, V3Tuning } from './types';
import { mean } from './utils';

// ============================================================================
// Types
// ============================================================================

export interface PackingConstraints {
  maxCellArea?: number;
  maxHeight?: number;
}

export interface PackingResult {
  cells: LayoutCell[];
  actualHeight: number;
  maxCellArea: number;
  usedRowCount: number;
}

// ============================================================================
// Row Packing
// ============================================================================

/**
 * Pack photos into a region using row-based layout.
 * 
 * The algorithm:
 * 1. Calculate optimal row count from region geometry and photo ARs
 * 2. Distribute photos across rows (round-robin for even distribution)
 * 3. Scale each row to fill region width
 * 4. Stack rows with gaps
 * 5. If constraints violated, reduce row count and retry
 */
export function packPhotosIntoRegion(
  photos: PhotoDimension[],
  region: RegionSpec,
  gap: number,
  tuning: V3Tuning,
  constraints: PackingConstraints = {}
): PackingResult {
  if (photos.length === 0) {
    return { cells: [], actualHeight: 0, maxCellArea: 0, usedRowCount: 0 };
  }
  
  // Single photo: fill the region width, maintain aspect ratio
  if (photos.length === 1) {
    const photo = photos[0];
    const width = region.width;
    const height = width / photo.aspectRatio;
    const cellArea = width * height;
    
    // Check constraints for single photo
    const violatesArea = constraints.maxCellArea && cellArea > constraints.maxCellArea;
    const violatesHeight = constraints.maxHeight && height > constraints.maxHeight;
    
    if (violatesArea || violatesHeight) {
      // Can't satisfy constraints with single photo - return failure indicator
      return { 
        cells: [], 
        actualHeight: height, 
        maxCellArea: cellArea, 
        usedRowCount: 1 
      };
    }
    
    return {
      cells: [{
        photoId: photo.id,
        x: region.x,
        y: region.y,
        width,
        height,
      }],
      actualHeight: height,
      maxCellArea: cellArea,
      usedRowCount: 1,
    };
  }
  
  // Calculate row count bounds
  const maxPhotosPerRow = Math.floor(region.width / tuning.region_minWidth);
  const minRows = Math.max(1, Math.ceil(photos.length / maxPhotosPerRow));
  
  // Start with optimal row count
  let rowCount = calculateOptimalRowCount(photos, region, gap, tuning);
  
  // Iteratively reduce row count until constraints are satisfied
  // Fewer rows = more photos per row = smaller cells = lower height
  while (rowCount >= minRows) {
    const result = packWithRowCount(photos, region, gap, rowCount);
    
    const violatesArea = constraints.maxCellArea && result.maxCellArea > constraints.maxCellArea;
    const violatesHeight = constraints.maxHeight && result.actualHeight > constraints.maxHeight;
    
    if (!violatesArea && !violatesHeight) {
      return result;
    }
    
    // Try fewer rows
    rowCount--;
  }
  
  // Couldn't satisfy constraints - return the best attempt (minRows)
  return packWithRowCount(photos, region, gap, minRows);
}

/**
 * Pack photos with a specific row count.
 */
function packWithRowCount(
  photos: PhotoDimension[],
  region: RegionSpec,
  gap: number,
  rowCount: number
): PackingResult {
  // Distribute photos across rows using round-robin
  const rows = distributeToRowsRoundRobin(photos, rowCount);
  
  // Pack each row and stack them
  return packRows(rows, region, gap, rowCount);
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
 * Distribute photos across rows using round-robin (prevents singleton last rows).
 * e.g., 7 photos into 3 rows → [3, 2, 2] instead of [3, 3, 1]
 */
function distributeToRowsRoundRobin(photos: PhotoDimension[], rowCount: number): PhotoDimension[][] {
  const rows: PhotoDimension[][] = Array.from({ length: rowCount }, () => []);
  
  photos.forEach((photo, index) => {
    rows[index % rowCount].push(photo);
  });
  
  // Remove empty rows (shouldn't happen with round-robin, but safety check)
  return rows.filter(row => row.length > 0);
}

/**
 * Pack rows into the region, scaling each to fill width.
 */
function packRows(
  rows: PhotoDimension[][],
  region: RegionSpec,
  gap: number,
  usedRowCount: number
): PackingResult {
  const cells: LayoutCell[] = [];
  let currentY = region.y;
  let maxCellArea = 0;
  
  rows.forEach((row) => {
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
      const cellArea = cellWidth * rowHeight;
      
      if (cellArea > maxCellArea) {
        maxCellArea = cellArea;
      }
      
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
  
  return { 
    cells, 
    actualHeight: Math.max(0, actualHeight), 
    maxCellArea,
    usedRowCount
  };
}
