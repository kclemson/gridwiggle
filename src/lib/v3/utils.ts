/**
 * V3 Layout Utilities
 * 
 * Shared math functions for the V3 layout engine.
 * Reuses proven logic from v2 where applicable.
 */

import { PhotoDimension, ContentStats, V3Tuning } from './types';
import { devLogger } from '@/lib/devLogger';

// ============================================================================
// Statistical Functions
// ============================================================================

/**
 * Calculate the mean of an array of numbers.
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate the variance of an array of numbers.
 */
export function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
}

/**
 * Calculate content statistics from photo dimensions.
 */
export function calculateContentStats(photos: PhotoDimension[]): ContentStats {
  if (photos.length === 0) {
    return { count: 0, meanAR: 1, arVariance: 0 };
  }
  
  const aspectRatios = photos.map(p => p.aspectRatio);
  
  return {
    count: photos.length,
    meanAR: mean(aspectRatios),
    arVariance: variance(aspectRatios),
  };
}

// ============================================================================
// Geometry Functions
// ============================================================================

/**
 * Calculate area of a region.
 */
export function regionArea(width: number, height: number): number {
  return width * height;
}

/**
 * Estimate typical content photo area given canvas width and content stats.
 * 
 * This is derived from geometry:
 * - If we pack photos in rows to fill canvas width
 * - Row height = canvasWidth / (photosPerRow * avgAR)
 * - Photo area ≈ rowHeight² * avgAR
 * 
 * We estimate photosPerRow from the region width and a target cell width.
 */
export function estimateContentPhotoArea(
  canvasWidth: number,
  gap: number,
  contentStats: ContentStats
): number {
  // Estimate ~3-4 photos per row as typical
  const estPhotosPerRow = 3.5;
  const availableWidth = canvasWidth - (estPhotosPerRow - 1) * gap;
  const cellWidth = availableWidth / estPhotosPerRow;
  const cellHeight = cellWidth / contentStats.meanAR;
  
  return cellWidth * cellHeight;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if a region meets minimum viability requirements.
 */
export function isRegionViable(
  width: number,
  height: number,
  minWidth: number,
  minHeight: number
): boolean {
  return width >= minWidth && height >= minHeight;
}

// ============================================================================
// Array Utilities
// ============================================================================

/**
 * Random integer in range [min, max] inclusive.
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Shuffle array using Fisher-Yates algorithm.
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ============================================================================
// AR-Budget Row Distribution
// ============================================================================

/**
 * Distribute photos across rows using AR-budget greedy packing.
 * 
 * Instead of rigid round-robin ([5,5,5]), this creates organic 
 * distributions ([4,6,5]) based on actual photo geometry.
 * 
 * The algorithm:
 * 1. Calculate totalAR and baseRowAR = totalAR / targetRowCount
 * 2. Greedy pack: walk photos, accumulate AR, start new row when jittered budget reached
 * 3. Validate: check each row's AR isn't too low (would create tall row)
 * 4. Redistribute if needed: merge tiny rows or steal from large adjacent rows
 * 
 * @param photos - Photos to distribute (should be pre-shuffled)
 * @param targetRowCount - Target number of rows
 * @param tuning - V3Tuning for jitter and height ratio params
 * @returns Array of rows (each row is array of photos)
 */
export function distributeByARBudget(
  photos: PhotoDimension[],
  targetRowCount: number,
  tuning: V3Tuning,
  randomize: boolean = false
): PhotoDimension[][] {
  const n = photos.length;
  
  // Edge cases
  if (n === 0) return [];
  if (n === 1) return [[photos[0]]];
  if (targetRowCount <= 1) return [photos];
  
  const { row_arBudgetJitter: jitter, row_maxHeightRatio: maxHeightRatio } = tuning;
  
  // Step 1: Calculate AR budget per row
  const totalAR = photos.reduce((sum, p) => sum + p.aspectRatio, 0);
  const baseRowAR = totalAR / targetRowCount;
  
  devLogger.log('v3-ar-budget', 'Starting AR-budget distribution', {
    photoCount: n,
    targetRowCount,
    totalAR: totalAR.toFixed(2),
    baseRowAR: baseRowAR.toFixed(2),
    jitter,
  });
  
  // Step 2: Greedy pack with jitter
  const rows: PhotoDimension[][] = [];
  let currentRow: PhotoDimension[] = [];
  let currentAR = 0;
  
  for (const photo of photos) {
    // Calculate jittered target for this decision point
    // Only apply jitter when randomizing for variety
    const jitterMultiplier = randomize 
      ? 1 + (Math.random() * 2 - 1) * jitter  // random in [1-jitter, 1+jitter]
      : 1.0;  // No jitter when deterministic
    const jitteredTarget = baseRowAR * jitterMultiplier;
    
    // Should we start a new row?
    // Only if: current row not empty AND current AR has reached jittered budget
    if (currentRow.length > 0 && currentAR >= jitteredTarget) {
      rows.push(currentRow);
      currentRow = [];
      currentAR = 0;
    }
    
    // Add photo to current row
    currentRow.push(photo);
    currentAR += photo.aspectRatio;
  }
  
  // Finalize last row
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }
  
  devLogger.log('v3-ar-budget', 'After greedy packing', {
    rowCount: rows.length,
    rowSizes: rows.map(r => r.length),
    rowARs: rows.map(r => r.reduce((s, p) => s + p.aspectRatio, 0).toFixed(2)),
  });
  
  // Step 3: Validate row heights and redistribute if needed
  const validatedRows = validateAndRedistribute(rows, maxHeightRatio);
  
  devLogger.log('v3-ar-budget', 'Final distribution', {
    rowCount: validatedRows.length,
    rowSizes: validatedRows.map(r => r.length),
  });
  
  return validatedRows;
}

/**
 * Validate row heights and redistribute if any row would be too tall.
 * 
 * A row is "too tall" if its AR sum is below avgRowAR / maxHeightRatio.
 * This prevents singleton portrait rows that would tower over others.
 */
function validateAndRedistribute(
  rows: PhotoDimension[][],
  maxHeightRatio: number
): PhotoDimension[][] {
  if (rows.length <= 1) return rows;
  
  const result = rows.map(r => [...r]); // Deep copy
  
  // Calculate average row AR
  const rowARs = result.map(row => row.reduce((sum, p) => sum + p.aspectRatio, 0));
  const avgRowAR = rowARs.reduce((s, ar) => s + ar, 0) / rowARs.length;
  const minAllowedAR = avgRowAR / maxHeightRatio;
  
  devLogger.log('v3-ar-budget', 'Height validation', {
    avgRowAR: avgRowAR.toFixed(2),
    minAllowedAR: minAllowedAR.toFixed(2),
    maxHeightRatio,
  });
  
  // Find rows that are too small (would be too tall)
  let needsRedistribution = true;
  let iterations = 0;
  const maxIterations = result.length * 2; // Prevent infinite loop
  
  while (needsRedistribution && iterations < maxIterations) {
    needsRedistribution = false;
    iterations++;
    
    // Recalculate row ARs
    const currentARs = result.map(row => row.reduce((sum, p) => sum + p.aspectRatio, 0));
    const currentAvgAR = currentARs.reduce((s, ar) => s + ar, 0) / result.length;
    const currentMinAllowedAR = currentAvgAR / maxHeightRatio;
    
    for (let i = 0; i < result.length; i++) {
      if (currentARs[i] < currentMinAllowedAR && result[i].length > 0) {
        // This row is too small - try to merge with adjacent row
        
        // Prefer merging with smaller adjacent row
        const prevAR = i > 0 ? currentARs[i - 1] : Infinity;
        const nextAR = i < result.length - 1 ? currentARs[i + 1] : Infinity;
        
        if (prevAR <= nextAR && i > 0) {
          // Merge with previous row
          result[i - 1] = [...result[i - 1], ...result[i]];
          result.splice(i, 1);
          needsRedistribution = true;
          
          devLogger.log('v3-ar-budget', 'Merged row with previous', {
            mergedIndex: i,
            newRowSize: result[i - 1].length,
          });
          break;
        } else if (i < result.length - 1) {
          // Merge with next row
          result[i] = [...result[i], ...result[i + 1]];
          result.splice(i + 1, 1);
          needsRedistribution = true;
          
          devLogger.log('v3-ar-budget', 'Merged row with next', {
            mergedIndex: i,
            newRowSize: result[i].length,
          });
          break;
        }
      }
    }
  }
  
  // If we ended up with just one row but started with more, that's acceptable
  // The geometry demanded it
  
  return result;
}
