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
  
  // Step 2: Compute minimum photos per row to prevent sparse rows
  // 0.7× average ensures jitter can't create jarring count imbalances (e.g. 6,2,5)
  const avgPerRow = n / targetRowCount;
  const minPerRow = Math.max(2, Math.floor(avgPerRow * 0.7));
  
  // Step 3: Greedy pack with jitter + look-ahead guard
  const rows: PhotoDimension[][] = [];
  let currentRow: PhotoDimension[] = [];
  let currentAR = 0;
  let consumed = 0; // total photos placed in finalized rows
  
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    
    // Calculate jittered target for this decision point
    // Only apply jitter when randomizing for variety
    const jitterMultiplier = randomize 
      ? 1 + (Math.random() * 2 - 1) * jitter  // random in [1-jitter, 1+jitter]
      : 1.0;  // No jitter when deterministic
    const jitteredTarget = baseRowAR * jitterMultiplier;
    
    // Should we start a new row?
    // Only if: row has minimum photos AND current AR has reached jittered budget
    if (currentRow.length >= minPerRow && currentAR >= jitteredTarget) {
      const rowsStillNeeded = targetRowCount - rows.length - 1; // excluding this row
      const photosLeft = n - consumed - currentRow.length;       // not yet in any row
      
      // Look-ahead guard: only break if remaining photos can fill remaining rows
      if (rowsStillNeeded <= 0 || photosLeft >= rowsStillNeeded * minPerRow) {
        rows.push(currentRow);
        consumed += currentRow.length;
        currentRow = [];
        currentAR = 0;
      }
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
 * Derive content photo counts for a 3-region diagonal-corners layout.
 *
 * Splits proportionally by geometric area of each region:
 *   Region 0 (beside H1): (canvasAR - wH1) * hH1
 *   Region 1 (middle band): canvasAR * (1 - hH1 - hH2)
 *   Region 2 (beside H2): (canvasAR - wH2) * hH2
 *
 * Ensures at least 1 photo per region when contentCount >= 3.
 */
export function deriveRegionCountsThreeWay(
  hero1AR: number,
  hero2AR: number,
  canvasAR: number,
  areaFraction: number,
  contentCount: number
): [number, number, number] {
  if (contentCount <= 0) return [0, 0, 0];

  const halfFrac = areaFraction / 2;

  let hH1 = Math.sqrt(halfFrac * canvasAR / hero1AR);
  hH1 = Math.max(0.1, Math.min(0.40, hH1));
  const wH1 = hero1AR * hH1;

  let hH2 = Math.sqrt(halfFrac * canvasAR / hero2AR);
  hH2 = Math.max(0.1, Math.min(0.40, hH2));
  const wH2 = hero2AR * hH2;

  const a0 = Math.max(0, canvasAR - wH1) * hH1;
  const a1 = canvasAR * Math.max(0, 1.0 - hH1 - hH2);
  const a2 = Math.max(0, canvasAR - wH2) * hH2;
  const total = a0 + a1 + a2;

  if (total <= 0) return [0, 0, contentCount];

  let r0 = Math.round(contentCount * a0 / total);
  let r2 = Math.round(contentCount * a2 / total);
  let r1 = contentCount - r0 - r2;

  // Fix rounding overshoot
  if (r1 < 0) {
    const s = r0 + r2;
    r0 = Math.round(contentCount * r0 / s);
    r2 = contentCount - r0;
    r1 = 0;
  }

  // Ensure at least 1 per region when we have enough photos
  if (contentCount >= 3) {
    if (r0 < 1) { r0 = 1; r1 = contentCount - r0 - r2; if (r1 < 1) { r1 = 1; r2 = contentCount - r0 - r1; } }
    if (r2 < 1) { r2 = 1; r1 = contentCount - r0 - r2; if (r1 < 1) { r1 = 1; r0 = contentCount - r1 - r2; } }
    if (r1 < 1) { r1 = 1; const rem = contentCount - 1; r0 = Math.round(rem * a0 / (a0 + a2)); r2 = rem - r0; }
  }

  return [Math.max(0, r0), Math.max(0, r1), Math.max(0, r2)];
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
 * Sample hero area fraction values within [min, effectiveMax].
 * The caller is responsible for computing effectiveMax via
 * effectiveAreaFractionMax() from hero-constraints.ts.
 */
export function sampleAreaFractions(
  min: number,
  effectiveMax: number,
  count: number
): number[] {
  const clamped = Math.max(min, effectiveMax);
  if (count <= 1) return [(min + clamped) / 2];
  
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    values.push(min + t * (clamped - min));
  }
  return values;
}

// ============================================================================
// AR-Aware Row Count Derivation
// ============================================================================

/**
 * Derive the optimal row count for a region of given dimensions.
 * 
 * The formula answers: "How many rows make cells whose aspect ratio
 * matches this rectangle?" Works for both height-constrained and
 * width-constrained regions.
 * 
 * Formula: round(sqrt(photoCount * meanAR * targetHeight / targetWidth))
 * Clamped to [1, ceil(photoCount / 2)].
 * 
 * @param photoCount - Number of photos in the region
 * @param meanAR - Mean aspect ratio of photos in the region
 * @param targetWidth - Target width of the region
 * @param targetHeight - Target height of the region
 * @returns Optimal row count (≥ 1)
 */
export function deriveTargetRowCount(
  photoCount: number,
  meanAR: number,
  targetWidth: number,
  targetHeight: number
): number {
  if (photoCount <= 0) return 0;
  if (targetWidth <= 0) return Math.max(1, Math.ceil(photoCount / 2));
  
  const raw = Math.sqrt(photoCount * meanAR * targetHeight / targetWidth);
  const clamped = Math.max(1, Math.min(Math.ceil(photoCount / 2), Math.round(raw)));
  return clamped;
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
