/**
 * Layout Math Utilities
 * 
 * Pure mathematical functions for layout calculations.
 * No side effects, no DOM, no state - just math.
 */

import { PhotoItem, LayoutTuning } from '@/types/collage';
import { getDisplayCrop } from '@/lib/cropUtils';

// ============================================================================
// Shared Types
// ============================================================================

/**
 * Photo dimensions extracted for layout calculations.
 * This is THE canonical type used across all layout modules.
 */
export interface PhotoDimension {
  id: string;
  width: number;
  height: number;
  aspectRatio: number;
  weight: number;
}

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

// ============================================================================
// Statistical Utilities
// ============================================================================

/** Calculate mean of numeric array */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Calculate variance of numeric array */
export function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  return values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
}

/** Coefficient of variation: stddev / mean (0 = perfectly uniform) */
export function coefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  if (avg === 0) return 0;
  return Math.sqrt(variance(values)) / avg;
}

// ============================================================================
// Photo Dimension Extraction
// ============================================================================

/**
 * Extract layout-relevant dimensions from PhotoItems.
 * Uses display crop (manual or smart) when available.
 */
export function getPhotoDimensions(
  photos: PhotoItem[], 
  weights: Record<string, number> = {}
): PhotoDimension[] {
  return photos.map((photo) => {
    const crop = getDisplayCrop(photo);
    const width = crop ? crop.width : photo.originalWidth;
    const height = crop ? crop.height : photo.originalHeight;
    return {
      id: photo.id,
      width,
      height,
      aspectRatio: width / height,
      weight: weights[photo.id] ?? 1,
    };
  });
}

// ============================================================================
// Aspect Ratio Geometry
// ============================================================================

/**
 * Calculate maximum beside photo count based on total photos and aspect contrast.
 * 
 * Aspect contrast (heroAR / avgBesideAR) affects perception:
 * - High contrast (landscape hero + portrait beside) → photos feel smaller
 *   → can pack more beside while maintaining hero prominence
 * - Low contrast (similar shapes) → photos compete visually
 *   → need fewer beside to preserve hero dominance
 * 
 * Formula: maxBeside = (totalCount - minBelow) * baseFraction * contrastModifier
 */
export function calculateMaxBesideCount(
  heroAspect: number,
  candidatePhotos: PhotoDimension[],
  totalNonHeroCount: number,
  tuning: Pick<LayoutTuning, 
    'baseMaxBesideFraction' | 'minBelowPhotos' | 
    'aspectContrastFloor' | 'aspectContrastCap'>
): number {
  // Calculate aspect contrast
  const avgCandidateAR = candidatePhotos.length > 0
    ? mean(candidatePhotos.map(p => p.aspectRatio))
    : 1.0;
  
  const aspectContrast = heroAspect / avgCandidateAR;
  
  // Clamp contrast modifier to reasonable range
  const contrastModifier = Math.max(
    tuning.aspectContrastFloor,
    Math.min(tuning.aspectContrastCap, aspectContrast)
  );
  
  // Calculate max beside with contrast-adjusted fraction
  const adjustedFraction = tuning.baseMaxBesideFraction * contrastModifier;
  const maxFromFraction = Math.floor(totalNonHeroCount * adjustedFraction);
  
  // Ensure we reserve minBelowPhotos for the below zone
  const maxFromReserve = totalNonHeroCount - tuning.minBelowPhotos;
  
  return Math.max(0, Math.min(maxFromFraction, maxFromReserve));
}

/**
 * Calculate aspect contrast between hero and beside photos.
 * 
 * Returns ratio > 1 when hero is wider than beside photos (landscape hero + portrait beside).
 * Returns ratio < 1 when hero is taller than beside photos (portrait hero + landscape beside).
 */
export function calculateAspectContrast(
  heroAspect: number,
  besidePhotos: PhotoDimension[]
): number {
  if (besidePhotos.length === 0) return 1.0;
  const avgBesideAR = mean(besidePhotos.map(p => p.aspectRatio));
  return heroAspect / avgBesideAR;
}
