/**
 * V2 Math Utilities
 * 
 * Pure mathematical functions with zero side effects.
 * No layout concepts, no DOM, no state - just math.
 */

import { PhotoDimension } from './types';

// ============================================================================
// Array Utilities
// ============================================================================

/** Fisher-Yates shuffle - returns new shuffled array */
export function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Pick N random items from array */
export function pickRandom<T>(arr: T[], n: number): T[] {
  if (n >= arr.length) return [...arr];
  return shuffleArray(arr).slice(0, n);
}

// ============================================================================
// Statistical Utilities
// ============================================================================

/** Calculate sum of numeric array */
export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Calculate mean of numeric array */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return sum(values) / values.length;
}

/** Calculate variance of numeric array */
export function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  return values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / values.length;
}

/** Standard deviation */
export function stddev(values: number[]): number {
  return Math.sqrt(variance(values));
}

/** Coefficient of variation: stddev / mean (0 = perfectly uniform) */
export function coefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  if (avg === 0) return 0;
  return stddev(values) / avg;
}

/** Clamp value to [min, max] range */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

// ============================================================================
// Geometry Utilities
// ============================================================================

/** Calculate area of a rectangle */
export function area(width: number, height: number): number {
  return width * height;
}

/** Calculate aspect ratio (width / height) */
export function aspectRatio(width: number, height: number): number {
  if (height === 0) return 1;
  return width / height;
}

/**
 * Calculate how much to scale a photo to fit a target area while preserving aspect ratio.
 * Returns the scale factor.
 */
export function scaleToArea(
  photoAR: number, 
  targetArea: number
): { width: number; height: number; scale: number } {
  // area = width * height = (height * ar) * height = height² * ar
  // height = sqrt(area / ar)
  const height = Math.sqrt(targetArea / photoAR);
  const width = height * photoAR;
  const scale = height; // Scale is arbitrary here, height is the reference
  return { width, height, scale };
}

/**
 * Calculate dimensions when fitting a photo into a fixed width.
 */
export function fitToWidth(
  photoAR: number,
  targetWidth: number
): { width: number; height: number } {
  return {
    width: targetWidth,
    height: targetWidth / photoAR,
  };
}

/**
 * Calculate dimensions when fitting a photo into a fixed height.
 */
export function fitToHeight(
  photoAR: number,
  targetHeight: number
): { width: number; height: number } {
  return {
    width: targetHeight * photoAR,
    height: targetHeight,
  };
}

// ============================================================================
// Partitioning Utilities
// ============================================================================

/**
 * Partition an array into groups based on a predicate.
 */
export function partition<T>(
  arr: T[], 
  predicate: (item: T) => boolean
): [T[], T[]] {
  const truthy: T[] = [];
  const falsy: T[] = [];
  for (const item of arr) {
    if (predicate(item)) {
      truthy.push(item);
    } else {
      falsy.push(item);
    }
  }
  return [truthy, falsy];
}

/**
 * Split an array into chunks of specified size.
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/**
 * Distribute items into N roughly equal groups.
 */
export function distributeEvenly<T>(arr: T[], groups: number): T[][] {
  if (groups <= 0) return [arr];
  const baseSize = Math.floor(arr.length / groups);
  const remainder = arr.length % groups;
  const result: T[][] = [];
  let index = 0;
  
  for (let i = 0; i < groups; i++) {
    // First `remainder` groups get one extra item
    const size = baseSize + (i < remainder ? 1 : 0);
    result.push(arr.slice(index, index + size));
    index += size;
  }
  
  return result;
}

// ============================================================================
// Hero Fraction Calculation
// ============================================================================

interface RowAspectInfo {
  aspectSums: number[];    // Aspect sum for each row
  photoCounts: number[];   // Photo count per row
}

/**
 * Calculate aspect sums for each row using the same split logic as packing functions.
 */
function getRowAspectInfo(photos: PhotoDimension[], rowCount: 2 | 3): RowAspectInfo {
  if (rowCount === 2) {
    const midpoint = Math.ceil(photos.length / 2);
    const row1Photos = photos.slice(0, midpoint);
    const row2Photos = photos.slice(midpoint);
    
    return {
      aspectSums: [
        row1Photos.reduce((sum, p) => sum + p.aspectRatio, 0),
        row2Photos.reduce((sum, p) => sum + p.aspectRatio, 0),
      ],
      photoCounts: [row1Photos.length, row2Photos.length],
    };
  }
  
  // 3-row split (same logic as packBesideAs3Rows)
  const basePerRow = Math.floor(photos.length / 3);
  const remainder = photos.length % 3;
  
  const row1Count = basePerRow + (remainder >= 1 ? 1 : 0);
  const row2Count = basePerRow + (remainder >= 2 ? 1 : 0);
  const row3Count = basePerRow;
  
  const row1Photos = photos.slice(0, row1Count);
  const row2Photos = photos.slice(row1Count, row1Count + row2Count);
  const row3Photos = photos.slice(row1Count + row2Count);
  
  return {
    aspectSums: [
      row1Photos.reduce((sum, p) => sum + p.aspectRatio, 0),
      row2Photos.reduce((sum, p) => sum + p.aspectRatio, 0),
      row3Photos.reduce((sum, p) => sum + p.aspectRatio, 0),
    ],
    photoCounts: [row1Photos.length, row2Photos.length, row3Photos.length],
  };
}

/**
 * Calculate the heroWidthFraction that produces scaleFactor ≈ 1.0
 * given the specific beside photos and hero aspect ratio.
 * 
 * Mathematical derivation (2-row case):
 * 
 * Let B = besideWidth, W = canvasWidth, g = gap, heroAR = hero aspect ratio
 * R1, R2 = row aspect sums, n1, n2 = photos per row
 * 
 * Row heights: h1 = (B - (n1-1)g) / R1, h2 = (B - (n2-1)g) / R2
 * Combined height: H = h1 + g + h2 = B × (1/R1 + 1/R2) + g × (1 - (n1-1)/R1 - (n2-1)/R2)
 * 
 * For perfect fit: heroWidth + g + B = W
 *   → H × heroAR + g + B = W
 *   → B × [heroAR × (1/R1 + 1/R2) + 1] = W - g - g × heroAR × (1 - (n1-1)/R1 - (n2-1)/R2)
 * 
 * Solving for B, then: f = 1 - (B + g) / W
 */
export function calculateOptimalHeroFraction(
  heroAspect: number,
  besidePhotos: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  rowCount: 1 | 2 | 3,
  minFraction: number = 0.30,
  maxFraction: number = 0.60
): { fraction: number; clamped: boolean } {
  const MIN_FRACTION = minFraction;
  const MAX_FRACTION = maxFraction;
  
  // For 1-row: simpler geometry - photos in single row beside hero
  if (rowCount === 1) {
    // Single row: h = B / sum(AR), hero fills same height
    // heroWidth = h * heroAR = B * heroAR / sum(AR)
    // W = heroWidth + g + B = B * heroAR / sum(AR) + g + B
    // W = B * (1 + heroAR / sum(AR)) + g
    // B = (W - g) / (1 + heroAR / sum(AR))
    // f = 1 - (B + g) / W
    const aspectSum = besidePhotos.reduce((sum, p) => sum + p.aspectRatio, 0);
    if (aspectSum <= 0) {
      return { fraction: 0.45, clamped: true };
    }
    
    const k = 1 + heroAspect / aspectSum;
    const optimalBesideWidth = (canvasWidth - gap) / k;
    const optimalFraction = 1 - (optimalBesideWidth + gap) / canvasWidth;
    
    const clamped = optimalFraction < MIN_FRACTION || optimalFraction > MAX_FRACTION;
    const clampedFraction = Math.max(MIN_FRACTION, Math.min(MAX_FRACTION, optimalFraction));
    
    return { fraction: clampedFraction, clamped };
  }
  
  // For 2-row and 3-row: use existing algebraic derivation
  const { aspectSums, photoCounts } = getRowAspectInfo(besidePhotos, rowCount);
  
  // Validate we have valid rows
  if (aspectSums.some(s => s <= 0) || photoCounts.some(c => c <= 0)) {
    return { fraction: 0.45, clamped: true }; // Fallback to middle value
  }
  
  // Calculate k1 = heroAR × sum(1/Ri) + 1
  const inverseAspectSum = aspectSums.reduce((sum, R) => sum + 1 / R, 0);
  const k1 = heroAspect * inverseAspectSum + 1;
  
  // Calculate k2 = 1 - sum((ni-1)/Ri) for gap contribution to height
  // This accounts for how gaps between photos in each row affect combined height
  let gapContribution = 1;
  for (let i = 0; i < rowCount; i++) {
    gapContribution -= (photoCounts[i] - 1) / aspectSums[i];
  }
  // Add (rowCount - 1) for gaps between rows
  gapContribution += (rowCount - 1);
  
  // B = (W - g - g × heroAR × k2) / k1
  const numerator = canvasWidth - gap - gap * heroAspect * gapContribution;
  const optimalBesideWidth = numerator / k1;
  
  // f = 1 - (B + g) / W = heroWidthFraction
  const optimalFraction = 1 - (optimalBesideWidth + gap) / canvasWidth;
  
  // Clamp to reasonable range
  const clamped = optimalFraction < MIN_FRACTION || optimalFraction > MAX_FRACTION;
  const clampedFraction = Math.max(MIN_FRACTION, Math.min(MAX_FRACTION, optimalFraction));
  
  return { fraction: clampedFraction, clamped };
}
