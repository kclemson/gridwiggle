/**
 * V3 Layout Utilities
 * 
 * Shared math functions for the V3 layout engine.
 * Reuses proven logic from v2 where applicable.
 */

import { PhotoDimension, ContentStats, V3Tuning } from './types';

// ============================================================================
// Prominence Helper
// ============================================================================

/**
 * Calculate effective minimum prominence based on content count.
 * Returns reduced threshold for low photo counts to improve success rate.
 */
export function getEffectiveMinProminence(
  contentCount: number,
  tuning: V3Tuning
): number {
  if (contentCount < tuning.hero_lowCountThreshold) {
    return tuning.hero_minProminence * tuning.hero_lowCountMultiplier;
  }
  return tuning.hero_minProminence;
}

/**
 * Calculate effective hero_maxToSmallest based on content count.
 * Returns HIGHER threshold (more permissive) for low photo counts.
 */
export function getEffectiveMaxToSmallest(
  contentCount: number,
  tuning: V3Tuning
): number {
  if (contentCount < tuning.hero_lowCountThreshold) {
    // Divide by multiplier to RAISE the limit (more permissive)
    return tuning.hero_maxToSmallest / tuning.hero_lowCountMultiplier;
  }
  return tuning.hero_maxToSmallest;
}

/**
 * Calculate effective canvas_minAR based on content count.
 * Returns LOWER threshold (more permissive) for low photo counts.
 */
export function getEffectiveCanvasMinAR(
  contentCount: number,
  tuning: V3Tuning
): number {
  if (contentCount < tuning.hero_lowCountThreshold) {
    return tuning.canvas_minAR * tuning.hero_lowCountMultiplier;
  }
  return tuning.canvas_minAR;
}

/**
 * Calculate effective canvas_maxAR based on content count.
 * Returns HIGHER threshold (more permissive) for low photo counts.
 */
export function getEffectiveCanvasMaxAR(
  contentCount: number,
  tuning: V3Tuning
): number {
  if (contentCount < tuning.hero_lowCountThreshold) {
    return tuning.canvas_maxAR / tuning.hero_lowCountMultiplier;
  }
  return tuning.canvas_maxAR;
}
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
 * Calculate coefficient of variation (std dev / mean).
 * Measures relative variability - useful for comparing uniformity across different scales.
 */
export function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  if (avg === 0) return 0;
  const v = values.reduce((s, val) => s + (val - avg) ** 2, 0) / values.length;
  return Math.sqrt(v) / avg;
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
  
  // Log removed: Starting AR-budget distribution - input params visible in region-level logs
  
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
  
  // Log removed: After greedy packing - intermediate state, covered by final
  
  // Step 3: Validate row heights and redistribute if needed
  const validatedRows = validateAndRedistribute(rows, maxHeightRatio);
  
  // Log removed: Final distribution - not needed for failure debugging
  
  return validatedRows;
}

/**
 * Validate row heights - SIMPLIFIED.
 * 
 * Previously merged rows that were "too different" in height.
 * Now just returns rows as-is - let F-ratio scoring handle variety.
 * Keeping function signature for backwards compatibility.
 */
function validateAndRedistribute(
  rows: PhotoDimension[][],
  _maxHeightRatio: number
): PhotoDimension[][] {
  // Simplified: just return rows as-is, no merging
  // F-ratio scoring will reward good tier separation
  return rows;
}

// ============================================================================
// Simplified Distribution (replaced stratified sampling)
// ============================================================================

/**
 * Distribute photos to two regions using simple slice.
 * 
 * SIMPLIFIED: Previous stratified sampling enforced proportional AR representation,
 * which created "sameness". Now just slice - the input order (shuffled or sorted)
 * determines which photos go where. Let randomization create variety.
 * 
 * @param photos - All content photos (should already be ordered/shuffled)
 * @param besideCount - Target number for BESIDE region
 * @param _randomize - Unused (kept for API compatibility)
 * @returns [besidePhotos, belowPhotos]
 */
export function stratifiedARDistribution(
  photos: PhotoDimension[],
  besideCount: number,
  _randomize: boolean
): [PhotoDimension[], PhotoDimension[]] {
  // Edge cases
  if (besideCount <= 0) return [[], photos];
  if (besideCount >= photos.length) return [photos, []];
  
  // Simple slice - input order determines distribution
  const beside = photos.slice(0, besideCount);
  const below = photos.slice(besideCount);
  
  return [beside, below];
}
