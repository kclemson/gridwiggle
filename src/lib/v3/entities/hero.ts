/**
 * Hero Entity
 * 
 * Derives hero size from prominence target and proposes positions.
 * Hero sizing is algebraically derived - NO width fraction constraints.
 */

import { 
  PhotoDimension,
  ContentStats, 
  HeroProposal, 
  RegionSpec,
  V3Tuning,
  DecompositionMode
} from '../types';
import { estimateContentPhotoArea } from '../utils';

// ============================================================================
// Hero Sizing
// ============================================================================

/**
 * Compute hero dimensions from prominence target.
 * 
 * Math:
 *   estContentArea = derived from content AR geometry
 *   targetHeroArea = estContentArea * hero_targetProminence
 *   heroHeight = sqrt(targetHeroArea / heroAR)
 *   heroWidth = heroHeight * heroAR
 */
export function computeHeroSize(
  heroAR: number,
  canvasWidth: number,
  gap: number,
  contentStats: ContentStats,
  tuning: V3Tuning
): { width: number; height: number } {
  // Estimate what a typical content photo area will be
  const estContentArea = estimateContentPhotoArea(canvasWidth, gap, contentStats);
  
  // Hero must be targetProminence times larger
  const targetHeroArea = estContentArea * tuning.hero_targetProminence;
  
  // Derive dimensions from target area and hero's aspect ratio
  // heroArea = width * height = height² * heroAR
  const heroHeight = Math.sqrt(targetHeroArea / heroAR);
  const heroWidth = heroHeight * heroAR;
  
  // Clamp to reasonable bounds (don't exceed canvas width)
  const clampedWidth = Math.min(heroWidth, canvasWidth * 0.8);
  const clampedHeight = clampedWidth / heroAR;
  
  return { 
    width: clampedWidth, 
    height: clampedHeight 
  };
}

// ============================================================================
// Position Proposals
// ============================================================================

/**
 * Generate viable hero position proposals based on photo count.
 * 
 * - Corner: Always available (2 regions)
 * - Edge: Requires decomp_edgeMinPhotos (3 regions)
 * - Floating: Requires decomp_floatingMinPhotos (4 regions)
 */
export function proposePositions(
  heroPhoto: PhotoDimension,
  canvasWidth: number,
  gap: number,
  contentStats: ContentStats,
  tuning: V3Tuning
): HeroProposal[] {
  const { width: heroWidth, height: heroHeight } = computeHeroSize(
    heroPhoto.aspectRatio,
    canvasWidth,
    gap,
    contentStats,
    tuning
  );
  
  const proposals: HeroProposal[] = [];
  
  // Corner placement: Always available
  proposals.push({
    rect: { x: 0, y: 0, width: heroWidth, height: heroHeight },
    mode: 'corner',
    position: 'top-left',
  });
  
  // Top-right corner variant
  proposals.push({
    rect: { 
      x: canvasWidth - heroWidth, 
      y: 0, 
      width: heroWidth, 
      height: heroHeight 
    },
    mode: 'corner',
    position: 'top-right',
  });
  
  // Edge placement: Requires enough content photos
  if (contentStats.count >= tuning.decomp_edgeMinPhotos) {
    // Left edge (Phase 2)
    proposals.push({
      rect: { x: 0, y: 0, width: heroWidth, height: heroHeight },
      mode: 'edge',
      position: 'left',
    });
    
    // Right edge (Phase 2)
    proposals.push({
      rect: { 
        x: canvasWidth - heroWidth, 
        y: 0, 
        width: heroWidth, 
        height: heroHeight 
      },
      mode: 'edge',
      position: 'right',
    });
  }
  
  // Floating placement: Requires many content photos
  if (contentStats.count >= tuning.decomp_floatingMinPhotos) {
    // Centered (Phase 3)
    proposals.push({
      rect: { 
        x: (canvasWidth - heroWidth) / 2, 
        y: 0, // Y will be derived during intersection
        width: heroWidth, 
        height: heroHeight 
      },
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
