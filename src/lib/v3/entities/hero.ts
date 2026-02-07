/**
 * Hero Entity
 * 
 * Proposes hero positions in normalized space.
 * Hero sizing is derived from its AR - NO pixel width constraints.
 * 
 * In normalized space: hero height = 1, hero width = heroAR
 */

import { 
  PhotoDimension,
  ContentStats, 
  NormalizedHeroProposal, 
  NormalizedRegion,
  V3Tuning,
  DecompositionMode
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
 * Position proposals are based on decomposition mode thresholds:
 * - Corner: Always available (2 regions)
 * - Edge: Requires decomp_edgeMinPhotos (3 regions)
 * - Floating: Requires decomp_floatingMinPhotos (4 regions)
 */
export function proposePositions(
  heroPhoto: PhotoDimension,
  contentStats: ContentStats,
  tuning: V3Tuning
): NormalizedHeroProposal[] {
  const heroWidth = heroPhoto.aspectRatio;  // Width when height = 1
  const heroHeight = 1.0;
  
  const proposals: NormalizedHeroProposal[] = [];
  
  // Corner placement: Always available
  // Hero at origin (0, 0) - position is 'top-left' in normalized space
  // The 'top-right' position is determined after we know the total width
  proposals.push({
    rect: { x: 0, y: 0, width: heroWidth, height: heroHeight },
    mode: 'corner',
    position: 'top-left',
  });
  
  // We also propose 'top-right' but x will be adjusted during assembly
  proposals.push({
    rect: { x: 0, y: 0, width: heroWidth, height: heroHeight },
    mode: 'corner',
    position: 'top-right',
  });
  
  // Bottom-left: hero at bottom-left, BELOW region above
  proposals.push({
    rect: { x: 0, y: 0, width: heroWidth, height: heroHeight },
    mode: 'corner',
    position: 'bottom-left',
  });

  // Bottom-right: hero at bottom-right, BELOW region above  
  proposals.push({
    rect: { x: 0, y: 0, width: heroWidth, height: heroHeight },
    mode: 'corner',
    position: 'bottom-right',
  });
  
  // Edge placement: Requires enough content photos
  if (contentStats.count >= tuning.decomp_edgeMinPhotos) {
    proposals.push({
      rect: { x: 0, y: 0, width: heroWidth, height: heroHeight },
      mode: 'edge',
      position: 'left',
    });
    
    proposals.push({
      rect: { x: 0, y: 0, width: heroWidth, height: heroHeight },
      mode: 'edge',
      position: 'right',
    });
  }
  
  // Floating placement: Requires many content photos
  if (contentStats.count >= tuning.decomp_floatingMinPhotos) {
    proposals.push({
      rect: { x: 0, y: 0, width: heroWidth, height: heroHeight },
      mode: 'floating',
      position: 'center',
    });
  }
  
  return proposals;
}

// ============================================================================
// Prominence Validation
// ============================================================================

/**
 * Validate that the hero achieves minimum prominence.
 * 
 * Prominence = heroArea / runnerUpArea
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
  
  const runnerUpArea = Math.max(...contentAreas);
  const ratio = heroArea / runnerUpArea;
  
  return {
    valid: ratio >= tuning.hero_minProminence,
    ratio,
  };
}

/**
 * Validate that hero isn't too large compared to smallest content cells.
 * Uses average of bottom 10% of content areas (minimum 1 photo).
 * 
 * This prevents layouts where the hero dominates so much that the smallest
 * content photos become unreadably small thumbnails.
 */
export function validateSmallestCellRatio(
  heroArea: number,
  contentAreas: number[],
  tuning: V3Tuning
): { valid: boolean; ratio: number } {
  if (contentAreas.length === 0) {
    return { valid: true, ratio: 0 };
  }
  
  // Sort ascending, take bottom 10% (min 1)
  const sorted = [...contentAreas].sort((a, b) => a - b);
  const bottomCount = Math.max(1, Math.ceil(sorted.length * 0.1));
  const smallest = sorted.slice(0, bottomCount);
  
  // Average of smallest photos
  const avgSmallest = smallest.reduce((s, v) => s + v, 0) / smallest.length;
  
  const ratio = heroArea / avgSmallest;
  
  return {
    valid: ratio <= tuning.hero_maxToSmallest,
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
