/**
 * V3 Layout Utilities
 * 
 * Shared math functions for the V3 layout engine.
 * SIMPLIFIED: Removed effective threshold functions and row merging.
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
 * 3. Return rows as-is (no merging - let F-ratio scoring handle variety)
 * 
 * @param photos - Photos to distribute (should be pre-shuffled)
 * @param targetRowCount - Target number of rows
 * @param tuning - V3Tuning for jitter param
 * @param randomize - Whether to apply jitter
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
  
  const { row_arBudgetJitter: jitter } = tuning;
  
  // Step 1: Calculate AR budget per row
  const totalAR = photos.reduce((sum, p) => sum + p.aspectRatio, 0);
  const baseRowAR = totalAR / targetRowCount;
  
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
  
  // SIMPLIFIED: No row validation/merging
  // F-ratio scoring will reward good tier separation
  return rows;
}

// ============================================================================
// Area-Proportional Region Count Derivation
// ============================================================================

/**
 * Derive how many content photos go "beside" vs "below" the hero,
 * based on the geometric areas of those two regions.
 * 
 * For a corner-anchor template on a normalized canvas (H=1, W=canvasAR):
 *   h_hero = sqrt(areaFraction * canvasAR / heroAR)
 *   w_hero = heroAR * h_hero
 *   beside_area = (W - w_hero) * h_hero
 *   below_area  = W * (1 - h_hero)
 *   besideCount = round(contentCount * beside_area / (beside_area + below_area))
 * 
 * Portrait heroes leave wide beside regions → more photos beside.
 * Landscape heroes consume width → most photos go below.
 */
export function deriveRegionCounts(
  heroAR: number,
  canvasAR: number,
  areaFraction: number,
  contentCount: number
): { besideCount: number; belowCount: number } {
  if (contentCount <= 0) return { besideCount: 0, belowCount: 0 };
  
  // Step 1: Derive hero dimensions from area fraction
  let hHero = Math.sqrt(areaFraction * canvasAR / heroAR);
  
  // Step 2: Clamp to avoid degenerate layouts
  hHero = Math.max(0.1, Math.min(0.95, hHero));
  
  const wHero = heroAR * hHero;
  
  // Step 3: If hero fills the width, everything goes below
  if (wHero >= canvasAR * 0.95) {
    return { besideCount: 0, belowCount: contentCount };
  }
  
  // Step 4: Compute region areas
  const besideArea = (canvasAR - wHero) * hHero;
  const belowArea = canvasAR * (1 - hHero);
  const totalArea = besideArea + belowArea;
  
  if (totalArea <= 0) {
    return { besideCount: 0, belowCount: contentCount };
  }
  
  // Step 5: Proportional split
  const besideFraction = besideArea / totalArea;
  let besideCount = Math.round(contentCount * besideFraction);
  
  // Step 6: Clamp
  besideCount = Math.max(0, Math.min(contentCount, besideCount));
  
  return { besideCount, belowCount: contentCount - besideCount };
}

/**
 * Sample canvas AR values within a range, with optional jitter.
 * Returns evenly spaced values between min and max.
 */
export function sampleCanvasARValues(
  minAR: number,
  maxAR: number,
  count: number,
  randomize: boolean
): number[] {
  if (count <= 1) return [(minAR + maxAR) / 2];
  
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1); // 0 to 1
    let value = minAR + t * (maxAR - minAR);
    if (randomize) {
      // Add jitter: ±10% of step size
      const step = (maxAR - minAR) / (count - 1);
      value += (Math.random() * 2 - 1) * step * 0.1;
      value = Math.max(minAR, Math.min(maxAR, value));
    }
    values.push(value);
  }
  return values;
}

/**
 * Sample hero area fraction values, respecting squareMax ceiling
 * when the canvas AR is near-square (0.85-1.15).
 */
export function sampleAreaFractions(
  min: number,
  max: number,
  squareMax: number,
  canvasAR: number,
  count: number
): number[] {
  // Apply squareMax ceiling for near-square canvases
  const effectiveMax = (canvasAR >= 0.85 && canvasAR <= 1.15)
    ? Math.min(max, squareMax)
    : max;
  
  if (count <= 1) return [(min + effectiveMax) / 2];
  
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    values.push(min + t * (effectiveMax - min));
  }
  return values;
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
