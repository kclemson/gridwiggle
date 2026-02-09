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
  
  // Log removed: Height validation - intermediate validation step
  
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
          
          // Log removed: Merged row with previous - low-level detail
          break;
        } else if (i < result.length - 1) {
          // Merge with next row
          result[i] = [...result[i], ...result[i + 1]];
          result.splice(i + 1, 1);
          needsRedistribution = true;
          
          // Log removed: Merged row with next - low-level detail
          break;
        }
      }
    }
  }
  
  // If we ended up with just one row but started with more, that's acceptable
  // The geometry demanded it
  
  return result;
}

// ============================================================================
// AR-Stratified Distribution
// ============================================================================

// AR bucket thresholds
const AR_BUCKET_PORTRAIT = 0.8;
const AR_BUCKET_LANDSCAPE = 1.25;

type ARBucket = 'portrait' | 'square' | 'landscape';

/**
 * Classify a photo into an AR bucket.
 */
function getARBucket(ar: number): ARBucket {
  if (ar < AR_BUCKET_PORTRAIT) return 'portrait';
  if (ar > AR_BUCKET_LANDSCAPE) return 'landscape';
  return 'square';
}

/**
 * Distribute photos to two regions using stratified sampling by AR bucket.
 * 
 * Each region receives a proportional sample from each AR bucket,
 * ensuring shape diversity rather than clustering all portraits together.
 * 
 * @param photos - All content photos (should already be ordered/shuffled)
 * @param besideCount - Target number for BESIDE region
 * @param randomize - Whether to shuffle within buckets
 * @returns [besidePhotos, belowPhotos]
 */
export function stratifiedARDistribution(
  photos: PhotoDimension[],
  besideCount: number,
  randomize: boolean
): [PhotoDimension[], PhotoDimension[]] {
  // Edge cases
  if (besideCount <= 0) return [[], photos];
  if (besideCount >= photos.length) return [photos, []];
  
  // Group photos by AR bucket
  const buckets: Record<ARBucket, PhotoDimension[]> = {
    portrait: [],
    square: [],
    landscape: [],
  };
  
  for (const photo of photos) {
    buckets[getARBucket(photo.aspectRatio)].push(photo);
  }
  
  // Shuffle within buckets if randomizing
  if (randomize) {
    buckets.portrait = shuffleArray(buckets.portrait);
    buckets.square = shuffleArray(buckets.square);
    buckets.landscape = shuffleArray(buckets.landscape);
  }
  
  // Calculate proportional allocation per bucket
  const total = photos.length;
  const besideFraction = besideCount / total;
  
  const besideFromPortrait = Math.round(buckets.portrait.length * besideFraction);
  const besideFromSquare = Math.round(buckets.square.length * besideFraction);
  // Remaining goes to landscape (adjusts for rounding)
  let besideFromLandscape = besideCount - besideFromPortrait - besideFromSquare;
  besideFromLandscape = Math.max(0, Math.min(besideFromLandscape, buckets.landscape.length));
  
  // Build arrays
  const beside: PhotoDimension[] = [
    ...buckets.portrait.slice(0, besideFromPortrait),
    ...buckets.square.slice(0, besideFromSquare),
    ...buckets.landscape.slice(0, besideFromLandscape),
  ];
  
  const below: PhotoDimension[] = [
    ...buckets.portrait.slice(besideFromPortrait),
    ...buckets.square.slice(besideFromSquare),
    ...buckets.landscape.slice(besideFromLandscape),
  ];
  
  // Handle rounding errors
  while (beside.length > besideCount && below.length < photos.length - besideCount) {
    below.push(beside.pop()!);
  }
  while (beside.length < besideCount && below.length > 0) {
    beside.push(below.shift()!);
  }
  
  // Final shuffle to mix buckets within each region
  const finalBeside = randomize ? shuffleArray(beside) : beside;
  const finalBelow = randomize ? shuffleArray(below) : below;
  
  return [finalBeside, finalBelow];
}
