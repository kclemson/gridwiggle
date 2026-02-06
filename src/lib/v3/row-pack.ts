/**
 * Row Packing
 * 
 * Packs photos into rows within a region.
 * Row count is derived from geometry, not specified.
 * Supports constraint-aware packing (maxCellArea, maxHeight).
 */

import { PhotoDimension, RegionSpec, LayoutCell, V3Tuning } from './types';
import { randomInt, mean } from './utils';
import { devLogger } from '@/lib/devLogger';

// ============================================================================
// Types
// ============================================================================

export interface PackingConstraints {
  maxCellArea?: number;
  maxHeight?: number;
  /** Scale content to fill this exact height (for bounded regions like BESIDE) */
  fillHeight?: number;
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
 * 6. If fillHeight specified and content is shorter, scale up to fill
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
    let width = region.width;
    let height = width / photo.aspectRatio;
    
    // Check constraints for single photo
    const violatesArea = constraints.maxCellArea && (width * height) > constraints.maxCellArea;
    const violatesHeight = constraints.maxHeight && height > constraints.maxHeight;
    
    if (violatesArea || violatesHeight) {
      // Can't satisfy constraints with single photo - return failure indicator
      return { 
        cells: [], 
        actualHeight: height, 
        maxCellArea: width * height, 
        usedRowCount: 1 
      };
    }
    
    // Apply fillHeight scaling for single photo
    if (constraints.fillHeight && height < constraints.fillHeight) {
      const scaleFactor = constraints.fillHeight / height;
      height = constraints.fillHeight;
      width = height * photo.aspectRatio;
      // Center horizontally after width scaling
      const xOffset = (region.width - width) / 2;
      
      return {
        cells: [{
          photoId: photo.id,
          x: region.x + xOffset,
          y: region.y,
          width,
          height,
        }],
        actualHeight: height,
        maxCellArea: width * height,
        usedRowCount: 1,
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
      maxCellArea: width * height,
      usedRowCount: 1,
    };
  }
  
  // Calculate row count bounds
  const maxPhotosPerRow = Math.floor(region.width / tuning.region_minWidth);
  const minRows = Math.max(1, Math.ceil(photos.length / maxPhotosPerRow));
  
  // Start with optimal row count
  let rowCount = pickRandomRowCount(photos, region.width, tuning);
  
  // Iteratively reduce row count until constraints are satisfied
  // Fewer rows = more photos per row = smaller cells = lower height
  while (rowCount >= minRows) {
    const result = packWithRowCount(photos, region, gap, rowCount);
    
    const violatesArea = constraints.maxCellArea && result.maxCellArea > constraints.maxCellArea;
    const violatesHeight = constraints.maxHeight && result.actualHeight > constraints.maxHeight;
    
    if (!violatesArea && !violatesHeight) {
      // Apply fillHeight scaling if needed
      if (constraints.fillHeight && result.actualHeight < constraints.fillHeight) {
        return scaleToFillHeight(result, region, constraints.fillHeight, gap);
      }
      return result;
    }
    
    // Try fewer rows
    rowCount--;
  }
  
  // Couldn't satisfy constraints - return the best attempt (minRows)
  const result = packWithRowCount(photos, region, gap, minRows);
  
  // Still apply fillHeight scaling if applicable
  if (constraints.fillHeight && result.actualHeight < constraints.fillHeight) {
    return scaleToFillHeight(result, region, constraints.fillHeight, gap);
  }
  
  return result;
}

/**
 * Scale packed cells to fill a target height.
 * Scales all cells proportionally and centers horizontally.
 */
function scaleToFillHeight(
  result: PackingResult,
  region: RegionSpec,
  fillHeight: number,
  gap: number
): PackingResult {
  const scaleFactor = fillHeight / result.actualHeight;
  
  // Scale all cells
  const scaledCells = result.cells.map(cell => {
    const newHeight = cell.height * scaleFactor;
    const newWidth = cell.width * scaleFactor;
    
    // Scale Y offset from region top
    const yOffset = (cell.y - region.y) * scaleFactor;
    
    return {
      photoId: cell.photoId,
      x: cell.x,
      y: region.y + yOffset,
      width: newWidth,
      height: newHeight,
    };
  });
  
  // Group cells by row (same Y position within threshold)
  const rows: typeof scaledCells[] = [];
  scaledCells.forEach(cell => {
    const existingRow = rows.find(row => 
      row.length > 0 && Math.abs(row[0].y - cell.y) < 1
    );
    if (existingRow) {
      existingRow.push(cell);
    } else {
      rows.push([cell]);
    }
  });
  
  // Scale gap proportionally
  const scaledGap = gap * scaleFactor;
  
  // Pack each row to fit region width, clamping if needed
  rows.forEach(row => {
    row.sort((a, b) => a.x - b.x);
    const totalCellWidth = row.reduce((sum, cell) => sum + cell.width, 0);
    const totalGapWidth = (row.length - 1) * scaledGap;
    const rowWidth = totalCellWidth + totalGapWidth;
    
    // If row exceeds region width, scale down cells to fit
    if (rowWidth > region.width) {
      const clampScale = region.width / rowWidth;
      row.forEach(cell => {
        cell.width *= clampScale;
        cell.height *= clampScale;
      });
    }
    
    // Recalculate row width after clamping
    const finalCellWidth = row.reduce((sum, cell) => sum + cell.width, 0);
    const finalGapWidth = (row.length - 1) * scaledGap * (rowWidth > region.width ? region.width / rowWidth : 1);
    const finalRowWidth = finalCellWidth + finalGapWidth;
    const actualGap = row.length > 1 ? finalGapWidth / (row.length - 1) : 0;
    
    // Center horizontally
    const xOffset = Math.max(0, (region.width - finalRowWidth) / 2);
    
    let currentX = region.x + xOffset;
    row.forEach(cell => {
      cell.x = currentX;
      currentX += cell.width + actualGap;
    });
  });
  
  // Recalculate max cell area
  const maxCellArea = scaledCells.reduce(
    (max, cell) => Math.max(max, cell.width * cell.height),
    0
  );
  
  return {
    cells: scaledCells,
    actualHeight: fillHeight,
    maxCellArea,
    usedRowCount: result.usedRowCount,
  };
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
 * Pick a random row count from the valid geometric range.
 * 
 * Row count is determined by physical constraints only.
 * Canvas AR is enforced at the intersection level (single source of truth).
 * 
 * Physical constraints:
 * - minRows: ensures cells aren't narrower than region_minWidth
 * - maxRows: ceil(n/2) ensures at least 2 photos per row on average
 */
function pickRandomRowCount(
  photos: PhotoDimension[],
  regionWidth: number,
  tuning: V3Tuning
): number {
  const n = photos.length;
  
  // Physical constraint: cells can't be narrower than region_minWidth
  const maxPhotosPerRow = Math.floor(regionWidth / tuning.region_minWidth);
  const physicalMinRows = Math.max(1, Math.ceil(n / maxPhotosPerRow));
  
  // Upper bound: at least 2 photos per row on average (prevents extreme pillar layouts)
  const minRows = physicalMinRows;
  const maxRows = Math.max(minRows, Math.min(n, Math.ceil(n / 2)));
  
  const chosen = randomInt(minRows, maxRows);
  
  devLogger.log('v3', 'Row count selection', {
    n,
    physicalMinRows,
    minRows,
    maxRows,
    chosen,
  });
  
  return chosen;
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
