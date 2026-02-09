/**
 * Hero Entity
 * 
 * Proposes hero positions in normalized space.
 * Hero sizing is derived from its AR - NO pixel width constraints.
 * 
 * In normalized space: hero height = 1, hero width = heroAR
 * 
 * SIMPLIFIED: Removed edge/floating proposals (never implemented),
 * removed validateSmallestCellRatio (disabled via tuning).
 */

import { 
  PhotoDimension,
  ContentStats, 
  NormalizedHeroProposal, 
  V3Tuning
} from '../types';

// ============================================================================
// Position Proposals (Normalized Space)
// ============================================================================

/**
 * Generate hero position proposals in normalized space.
 * 
 * In normalized space:
 * - Hero height = 1.0
 * - Hero width = heroAR
 * - All other dimensions are relative to hero height
 * 
 * Currently only corner mode is implemented.
 * Edge/floating modes are preserved in tuning for future use.
 */
export function proposePositions(
  heroPhoto: PhotoDimension,
  _contentStats: ContentStats,
  _tuning: V3Tuning
): NormalizedHeroProposal[] {
  const heroWidth = heroPhoto.aspectRatio;  // Width when height = 1
  const heroHeight = 1.0;
  
  const proposals: NormalizedHeroProposal[] = [];
  
  // Corner placement: Always available
  // All 4 corner positions are symmetric - they produce identical region 
  // assignments, packing, and scores. Only the final coordinate mapping differs.
  // We evaluate ONE canonical corner, then apply random position selection 
  // after validation for variety.
  proposals.push({
    rect: { x: 0, y: 0, width: heroWidth, height: heroHeight },
    mode: 'corner',
    position: 'top-left', // Canonical - actual position applied after evaluation
  });
  
  // Note: Edge and floating modes are not implemented.
  // The tuning thresholds are preserved for future development.
  
  return proposals;
}

// ============================================================================
// Prominence Validation
// ============================================================================

/**
 * Validate that the hero achieves minimum prominence.
 * 
 * Prominence = heroArea / avg(top N% of contentAreas)
 * This is more forgiving than comparing against the single largest photo,
 * allowing one or two content photos to be similar in size to the hero
 * as long as the hero is prominent relative to the group of large photos.
 * 
 * Must be >= hero_minProminence to be valid.
 */
export function validateProminence(
  heroArea: number,
  contentAreas: number[],
  tuning: V3Tuning
): { valid: boolean; ratio: number } {
  if (contentAreas.length === 0) {
    return { valid: true, ratio: Infinity };
  }
  
  // Sort descending, take top N% (minimum 1)
  const sorted = [...contentAreas].sort((a, b) => b - a);
  const topCount = Math.max(1, Math.ceil(sorted.length * tuning.hero_prominenceTopFraction));
  const topAreas = sorted.slice(0, topCount);
  
  // Average of top N%
  const avgTopArea = topAreas.reduce((s, v) => s + v, 0) / topAreas.length;
  
  const ratio = heroArea / avgTopArea;
  
  return {
    valid: ratio >= tuning.hero_minProminence,
    ratio,
  };
}

/**
 * Find the hero photo from a list of photos.
 * Hero has weight > 1.
 */
export function findHeroPhoto(photos: PhotoDimension[]): PhotoDimension | null {
  return photos.find(p => p.weight > 1) ?? null;
}

/**
 * Get content photos (non-hero) from a list of photos.
 */
export function getContentPhotos(photos: PhotoDimension[]): PhotoDimension[] {
  return photos.filter(p => p.weight <= 1);
}
