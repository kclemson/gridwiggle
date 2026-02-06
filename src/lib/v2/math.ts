/**
 * V2 Math Utilities
 * 
 * Pure mathematical functions with zero side effects.
 * No layout concepts, no DOM, no state - just math.
 */

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
