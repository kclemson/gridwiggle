/**
 * Normalized Space Packing
 * 
 * Packs photos in AR space where hero height = 1.
 * Widths are derived from geometry, not constrained upfront.
 */

import { PhotoDimension, NormalizedCell, NormalizedPackResult, V3Tuning } from './types';

// ============================================================================
// Pack to Fill Height (for BESIDE region)
// ============================================================================

/**
 * Pack photos into rows at a fixed height.
 * Returns the width needed to fit all rows.
 * 
 * This is the key function for BESIDE: given photos and height = 1,
 * derive the width needed to pack them.
 * 
 * @param photos - Photos to pack
 * @param targetHeight - Height to fill (1.0 for BESIDE)
 * @param normalizedGap - Gap as fraction of hero height
 * @param rowCount - Number of rows to use
 * @returns Packed cells and total width used
 */
export function packToFillHeight(
  photos: PhotoDimension[],
  targetHeight: number,
  normalizedGap: number,
  rowCount: number
): NormalizedPackResult {
  if (photos.length === 0) {
    return { cells: [], width: 0, height: 0, rowCount: 0 };
  }
  
  // Single photo case
  if (photos.length === 1) {
    const photo = photos[0];
    // At targetHeight, width = targetHeight * AR
    const cellHeight = targetHeight;
    const cellWidth = cellHeight * photo.aspectRatio;
    
    return {
      cells: [{
        photoId: photo.id,
        x: 0,
        y: 0,
        width: cellWidth,
        height: cellHeight,
      }],
      width: cellWidth,
      height: targetHeight,
      rowCount: 1,
    };
  }
  
  // Distribute photos across rows using round-robin
  const rows = distributeToRowsRoundRobin(photos, rowCount);
  
  // === Handle column mode: all photos stacked vertically ===
  // When each row has exactly 1 photo, we're in column mode.
  // In this case, all photos should have the SAME WIDTH, and the
  // column should fit exactly within targetHeight.
  const allSinglePhotoRows = rows.every(row => row.length === 1);
  
  if (allSinglePhotoRows) {
    // Column mode: derive width from targetHeight constraint
    // Total height = W × sum(1/AR) + (n-1) × gap = targetHeight
    // So: W = (targetHeight - (n-1) × gap) / sum(1/AR)
    
    const sumInverseAR = photos.reduce((sum, p) => sum + 1 / p.aspectRatio, 0);
    const totalGapHeight = (photos.length - 1) * normalizedGap;
    const columnWidth = (targetHeight - totalGapHeight) / sumInverseAR;
    
    if (columnWidth <= 0) {
      return { cells: [], width: 0, height: 0, rowCount: 0 };
    }
    
    // Position photos vertically at columnWidth
    const columnCells: NormalizedCell[] = [];
    let y = 0;
    
    photos.forEach(photo => {
      const cellHeight = columnWidth / photo.aspectRatio;
      columnCells.push({
        photoId: photo.id,
        x: 0,
        y,
        width: columnWidth,
        height: cellHeight,
      });
      y += cellHeight + normalizedGap;
    });
    
    return {
      cells: columnCells,
      width: columnWidth,
      height: targetHeight,  // Exactly fills the target
      rowCount: photos.length,
    };
  }
  
  // Calculate row height (accounting for gaps between rows)
  const totalGapHeight = (rows.length - 1) * normalizedGap;
  const rowHeight = (targetHeight - totalGapHeight) / rows.length;
  
  if (rowHeight <= 0) {
    // Too many rows for the height - return empty
    return { cells: [], width: 0, height: 0, rowCount: 0 };
  }
  
  // Pack rows and find max width
  let maxRowWidth = 0;
  const cells: NormalizedCell[] = [];
  let currentY = 0;
  
  rows.forEach(row => {
    // Row width = sum of photo widths at this row height + gaps
    const cellWidths = row.map(p => p.aspectRatio * rowHeight);
    const rowWidth = cellWidths.reduce((sum, w) => sum + w, 0) + (row.length - 1) * normalizedGap;
    
    if (rowWidth > maxRowWidth) {
      maxRowWidth = rowWidth;
    }
    
    // Place cells left-aligned
    let currentX = 0;
    row.forEach((photo, i) => {
      const cellWidth = cellWidths[i];
      cells.push({
        photoId: photo.id,
        x: currentX,
        y: currentY,
        width: cellWidth,
        height: rowHeight,
      });
      currentX += cellWidth + normalizedGap;
    });
    
    currentY += rowHeight + normalizedGap;
  });
  
  return {
    cells,
    width: maxRowWidth,
    height: targetHeight,
    rowCount: rows.length,
  };
}

// ============================================================================
// Pack to Fill Width (for BELOW region)
// ============================================================================

/**
 * Pack photos into rows at a fixed width.
 * Returns the height needed to fit all rows.
 * 
 * This is standard row packing: given photos and width, derive height.
 * 
 * @param photos - Photos to pack
 * @param targetWidth - Width to fill
 * @param normalizedGap - Gap as fraction of hero height
 * @param rowCount - Number of rows to use
 * @returns Packed cells and total height used
 */
export function packToFillWidth(
  photos: PhotoDimension[],
  targetWidth: number,
  normalizedGap: number,
  rowCount: number
): NormalizedPackResult {
  if (photos.length === 0) {
    return { cells: [], width: 0, height: 0, rowCount: 0 };
  }
  
  // Single photo case
  if (photos.length === 1) {
    const photo = photos[0];
    const cellWidth = targetWidth;
    const cellHeight = cellWidth / photo.aspectRatio;
    
    return {
      cells: [{
        photoId: photo.id,
        x: 0,
        y: 0,
        width: cellWidth,
        height: cellHeight,
      }],
      width: targetWidth,
      height: cellHeight,
      rowCount: 1,
    };
  }
  
  // Distribute photos across rows using round-robin
  const rows = distributeToRowsRoundRobin(photos, rowCount);
  
  // Pack rows
  const cells: NormalizedCell[] = [];
  let currentY = 0;
  
  rows.forEach(row => {
    // Calculate row's natural aspect ratio (sum of photo ARs)
    const rowAR = row.reduce((sum, p) => sum + p.aspectRatio, 0);
    
    // Available width after gaps
    const availableWidth = targetWidth - (row.length - 1) * normalizedGap;
    
    // Row height when scaled to fit available width
    const rowHeight = availableWidth / rowAR;
    
    // Position each photo in the row
    let currentX = 0;
    row.forEach(photo => {
      const cellWidth = rowHeight * photo.aspectRatio;
      
      cells.push({
        photoId: photo.id,
        x: currentX,
        y: currentY,
        width: cellWidth,
        height: rowHeight,
      });
      
      currentX += cellWidth + normalizedGap;
    });
    
    currentY += rowHeight + normalizedGap;
  });
  
  // Total height is currentY minus trailing gap
  const totalHeight = Math.max(0, currentY - normalizedGap);
  
  return {
    cells,
    width: targetWidth,
    height: totalHeight,
    rowCount: rows.length,
  };
}

// ============================================================================
// Row Distribution
// ============================================================================

/**
 * Distribute photos across rows using round-robin.
 * Prevents singleton last rows (e.g., 7 photos into 3 rows → [3, 2, 2] not [3, 3, 1])
 */
function distributeToRowsRoundRobin(photos: PhotoDimension[], rowCount: number): PhotoDimension[][] {
  const rows: PhotoDimension[][] = Array.from({ length: rowCount }, () => []);
  
  photos.forEach((photo, index) => {
    rows[index % rowCount].push(photo);
  });
  
  // Remove empty rows (safety check)
  return rows.filter(row => row.length > 0);
}

// ============================================================================
// Row Count Calculation
// ============================================================================

/**
 * Calculate viable row count range for packing photos at a target height.
 * 
 * @param photos - Photos to pack
 * @param targetHeight - Normalized target height (1.0 for BESIDE)
 * @param normalizedGap - Gap as fraction of target height
 * @param minCellHeightRatio - Minimum cell height as ratio of target height
 * @returns [minRows, maxRows] range
 */
export function calculateRowCountRange(
  photos: PhotoDimension[],
  targetHeight: number,
  normalizedGap: number,
  minCellHeightRatio: number = 0.2  // Cells must be at least 20% of target height
): [number, number] {
  const n = photos.length;
  if (n === 0) return [0, 0];
  if (n === 1) return [1, 1];
  
  // Max rows limited by minimum cell height
  // With R rows and (R-1) gaps: rowHeight = (targetHeight - (R-1)*gap) / R
  // rowHeight >= minCellHeight → R <= (targetHeight + gap) / (minCellHeight + gap)
  const minCellHeight = targetHeight * minCellHeightRatio;
  const maxRowsByHeight = Math.floor((targetHeight + normalizedGap) / (minCellHeight + normalizedGap));
  
  // Max rows also limited by photo count (at least 1 photo per row)
  const maxRows = Math.min(maxRowsByHeight, n);
  
  // Min rows: at least 1, and ensure reasonable distribution
  const minRows = 1;
  
  return [minRows, Math.max(minRows, maxRows)];
}

/**
 * Calculate optimal row count for BELOW packing given width and photo geometry.
 */
/**
 * Calculate optimal row count for BELOW packing given width and photo geometry.
 * Enforces both canvas_minAR (prevents too-tall) and canvas_maxAR (prevents too-wide).
 */
export function calculateBelowRowCount(
  photos: PhotoDimension[],
  targetWidth: number,
  normalizedGap: number,
  canvasMinAR: number,
  canvasMaxAR: number = 2.0,
  heroRowHeight: number = 1.0
): number {
  const n = photos.length;
  if (n <= 1) return 1;
  
  // Mean AR of photos
  const meanAR = photos.reduce((sum, p) => sum + p.aspectRatio, 0) / n;
  
  // === Constraint 1: Prevent too-tall (minAR) ===
  // Canvas AR = targetWidth / (heroRowHeight + gap + belowHeight)
  // For canvas AR to stay above canvasMinAR:
  // belowHeight <= targetWidth / canvasMinAR - heroRowHeight - gap
  const maxBelowHeight = targetWidth / canvasMinAR - heroRowHeight - normalizedGap;
  
  // From belowHeight = R² * targetWidth / (n * meanAR):
  // R² <= maxBelowHeight * n * meanAR / targetWidth
  // R <= sqrt(maxBelowHeight * n * meanAR / targetWidth)
  const maxRowsByMinAR = Math.floor(Math.sqrt(Math.max(0, maxBelowHeight * n * meanAR / targetWidth)));
  
  // === Constraint 2: Prevent too-wide (maxAR) ===
  // canvasAR = width / height <= maxAR
  // For hero-less: height = R² * width / (n * meanAR)
  // So: n * meanAR / R² <= maxAR → R >= sqrt(n * meanAR / maxAR)
  const minRowsByMaxAR = Math.ceil(Math.sqrt(n * meanAR / canvasMaxAR));
  
  // === Combine constraints ===
  const minRows = Math.max(1, minRowsByMaxAR);
  const maxRows = Math.max(minRows, Math.min(n, maxRowsByMinAR, Math.ceil(n / 2)));
  
  // Choose middle of valid range for balance
  return Math.max(minRows, Math.min(maxRows, Math.ceil((minRows + maxRows) / 2)));
}
