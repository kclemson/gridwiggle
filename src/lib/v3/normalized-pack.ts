/**
 * Normalized Space Packing
 * 
 * Packs photos in AR space where hero height = 1.
 * Widths are derived from geometry, not constrained upfront.
 */

import { PhotoDimension, NormalizedCell, NormalizedPackResult, V3Tuning, DEFAULT_V3_TUNING } from './types';
import { distributeByARBudget } from './utils';

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
 * @param tuning - V3Tuning for AR-budget distribution
 * @returns Packed cells and total width used
 */
export function packToFillHeight(
  photos: PhotoDimension[],
  targetHeight: number,
  normalizedGap: number,
  rowCount: number,
  tuning: V3Tuning = DEFAULT_V3_TUNING,
  randomize: boolean = false
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
  
  // Distribute photos across rows using AR-budget algorithm
  const rows = distributeByARBudget(photos, rowCount, tuning, randomize);
  
  // Calculate total gap height between rows
  const totalGapHeight = (rows.length - 1) * normalizedGap;
  
  // Calculate each row's "effective aspect ratio" (sum of photo ARs + intra-row gaps)
  // For a row at height H: width = H × rowAR, where rowAR accounts for gaps
  // Gap contribution: each gap adds normalizedGap to width, which at height H means AR += gap/H
  // Since we don't know H yet, we express gaps as AR contribution relative to row height
  const rowARs = rows.map(row => {
    const photoARSum = row.reduce((sum, p) => sum + p.aspectRatio, 0);
    // Intra-row gaps: (row.length - 1) gaps, each contributing gap/rowHeight to width
    // But rowHeight varies per row. The gap contribution to "effective AR" is tricky.
    // Solution: treat row as unit. At width W: rowHeight = W / (photoARSum + gapContrib)
    // gapContrib in AR-space = (row.length - 1) * normalizedGap / rowHeight
    // This is circular. Instead, use the formula:
    // rowWidth = rowHeight × photoARSum + (row.length - 1) × gap
    // rowAR = rowWidth / rowHeight = photoARSum + (row.length - 1) × gap / rowHeight
    // 
    // For unified formula: we need 1/rowAR in terms of rowHeight.
    // Actually, the simpler approach: given regionWidth W, 
    // rowHeight = (W - intraRowGaps) / photoARSum
    // We'll solve for W directly using the constraint that heights sum to targetHeight.
    return photoARSum;
  });
  
  // Calculate intra-row gap counts
  const intraRowGaps = rows.map(row => (row.length - 1) * normalizedGap);
  
  // Solve for regionWidth W such that:
  // sum of rowHeights + inter-row gaps = targetHeight
  // rowHeight_i = (W - intraRowGaps_i) / rowAR_i
  // 
  // Σ[(W - intraRowGaps_i) / rowAR_i] = targetHeight - totalGapHeight
  // W × Σ(1/rowAR_i) - Σ(intraRowGaps_i / rowAR_i) = targetHeight - totalGapHeight
  // W = [targetHeight - totalGapHeight + Σ(intraRowGaps_i / rowAR_i)] / Σ(1/rowAR_i)
  
  const sumInverseRowAR = rowARs.reduce((sum, ar) => sum + 1 / ar, 0);
  const sumGapOverAR = rows.reduce((sum, row, i) => sum + intraRowGaps[i] / rowARs[i], 0);
  const regionWidth = (targetHeight - totalGapHeight + sumGapOverAR) / sumInverseRowAR;
  
  if (regionWidth <= 0) {
    return { cells: [], width: 0, height: 0, rowCount: 0 };
  }
  
  // Pack each row at regionWidth (variable row heights)
  const cells: NormalizedCell[] = [];
  let currentY = 0;
  
  rows.forEach((row, rowIndex) => {
    const rowAR = rowARs[rowIndex];
    const rowIntraGap = intraRowGaps[rowIndex];
    // rowHeight such that: rowHeight × rowAR + rowIntraGap = regionWidth
    const rowHeight = (regionWidth - rowIntraGap) / rowAR;
    
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
  
  return {
    cells,
    width: regionWidth,
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
 * @param tuning - V3Tuning for AR-budget distribution
 * @returns Packed cells and total height used
 */
export function packToFillWidth(
  photos: PhotoDimension[],
  targetWidth: number,
  normalizedGap: number,
  rowCount: number,
  tuning: V3Tuning = DEFAULT_V3_TUNING,
  randomize: boolean = false
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
  
  // Distribute photos across rows using AR-budget algorithm
  const rows = distributeByARBudget(photos, rowCount, tuning, randomize);
  
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
 * Enforces:
 * - canvas_minAR (prevents too-tall canvas)
 * - canvas_maxAR (prevents too-wide canvas)  
 * - hero_maxToSmallest (prevents tiny content cells)
 */
/**
 * Result of calculateBelowRowCount containing value and valid range.
 */
export interface BelowRowCountResult {
  value: number;
  minRows: number;
  maxRows: number;
  /** Raw constraint values for diagnostics */
  constraints: {
    maxRowsByMinAR: number;    // Prevents canvas too tall
    minRowsByMaxAR: number;    // Prevents canvas too wide  
    minRowsByCellSize: number; // Prevents tiny cells
    targetWidth: number;       // The width being packed into
  };
}

/**
 * Calculate optimal row count for BELOW packing given width and photo geometry.
 * Enforces:
 * - canvas_minAR (prevents too-tall canvas)
 * - canvas_maxAR (prevents too-wide canvas)  
 * - hero_maxToSmallest (prevents tiny content cells)
 * 
 * @param randomize - When true, picks randomly within valid range for variety
 * @returns Object with selected value and valid range (minRows, maxRows)
 */
export function calculateBelowRowCount(
  photos: PhotoDimension[],
  targetWidth: number,
  normalizedGap: number,
  heroAR: number,
  tuning: V3Tuning,
  randomize: boolean = false
): BelowRowCountResult {
  const n = photos.length;
  if (n <= 1) return { 
    value: 1, 
    minRows: 1, 
    maxRows: 1,
    constraints: {
      maxRowsByMinAR: 1,
      minRowsByMaxAR: 1,
      minRowsByCellSize: 1,
      targetWidth,
    }
  };
  
  // Photo geometry
  const meanAR = photos.reduce((sum, p) => sum + p.aspectRatio, 0) / n;
  const minAR = Math.min(...photos.map(p => p.aspectRatio));
  
  // === Constraint 1: Prevent too-tall (minAR) ===
  const heroRowHeight = heroAR > 0 ? 1.0 : 0;
  const maxBelowHeight = targetWidth / tuning.canvas_minAR - heroRowHeight - normalizedGap;
  const maxRowsByMinAR = Math.floor(Math.sqrt(Math.max(0, maxBelowHeight * n * meanAR / targetWidth)));
  
  // === Constraint 2: Prevent too-wide (maxAR) ===
  const minRowsByMaxAR = Math.ceil(Math.sqrt(n * meanAR / tuning.canvas_maxAR));
  
  // === Constraint 3: Prevent tiny cells (hero_maxToSmallest) ===
  // Only applies when there's a hero
  let minRowsByCellSize = 1;
  if (heroAR > 0) {
    // Conservative estimate: use 0.6x minAR to account for distribution variance
    const effectiveMinAR = minAR * 0.6;
    minRowsByCellSize = Math.ceil(
      Math.sqrt(heroAR * n * n * meanAR * meanAR / 
        (effectiveMinAR * targetWidth * targetWidth * tuning.hero_maxToSmallest))
    );
  }
  
  // === Combine constraints ===
  const minRows = Math.max(1, minRowsByMaxAR, minRowsByCellSize);
  const maxRows = Math.max(minRows, Math.min(n, maxRowsByMinAR, Math.ceil(n / 2)));
  
  // When randomizing, pick uniformly from valid range for variety
  let value: number;
  if (randomize && minRows < maxRows) {
    value = minRows + Math.floor(Math.random() * (maxRows - minRows + 1));
  } else {
    // Deterministic: choose middle of valid range for balance
    value = Math.max(minRows, Math.min(maxRows, Math.ceil((minRows + maxRows) / 2)));
  }
  
  return { 
    value, 
    minRows, 
    maxRows,
    constraints: {
      maxRowsByMinAR,
      minRowsByMaxAR,
      minRowsByCellSize,
      targetWidth,
    }
  };
}
