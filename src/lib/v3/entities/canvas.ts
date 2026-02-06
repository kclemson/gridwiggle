/**
 * Canvas Entity
 * 
 * Manages canvas space and performs sub-rectangle decomposition.
 * The hero "carves" the canvas into 2-4 content regions.
 */

import { 
  RegionSpec, 
  DecompositionMode, 
  DecompositionResult,
  V3Tuning 
} from '../types';
import { isRegionViable } from '../utils';

// ============================================================================
// Canvas Decomposition
// ============================================================================

/**
 * Decompose canvas into content regions based on hero placement.
 * 
 * Corner placement (2 regions):
 * +------------------+--------+
 * |      HERO        | BESIDE |
 * +------------------+--------+
 * |          BELOW            |
 * +---------------------------+
 * 
 * Edge placement (3 regions): Phase 2
 * Floating placement (4 regions): Phase 3
 */
export function decomposeCanvas(
  canvasWidth: number,
  heroRect: RegionSpec,
  mode: DecompositionMode,
  gap: number,
  tuning: V3Tuning
): DecompositionResult {
  switch (mode) {
    case 'corner':
      return decomposeCorner(canvasWidth, heroRect, gap, tuning);
    case 'edge':
      // Phase 2: For now, fall back to corner
      return decomposeCorner(canvasWidth, heroRect, gap, tuning);
    case 'floating':
      // Phase 3: For now, fall back to corner
      return decomposeCorner(canvasWidth, heroRect, gap, tuning);
    default:
      return { regions: [], valid: false, invalidReason: `Unknown mode: ${mode}` };
  }
}

/**
 * Corner decomposition: Hero in top-left, content beside and below.
 */
function decomposeCorner(
  canvasWidth: number,
  heroRect: RegionSpec,
  gap: number,
  tuning: V3Tuning
): DecompositionResult {
  const regions: RegionSpec[] = [];
  
  // BESIDE region: to the right of hero, same height
  const besideX = heroRect.x + heroRect.width + gap;
  const besideWidth = canvasWidth - besideX;
  
  if (besideWidth > 0) {
    regions.push({
      x: besideX,
      y: heroRect.y,
      width: besideWidth,
      height: heroRect.height,
    });
  }
  
  // BELOW region: full width, below hero row
  const belowY = heroRect.y + heroRect.height + gap;
  // Note: Canvas height is not yet known - it will be determined by content packing
  // For now, we use a placeholder height that will be replaced during intersection
  const belowHeight = tuning.region_minHeight; // Minimum viable - will grow during packing
  
  regions.push({
    x: 0,
    y: belowY,
    width: canvasWidth,
    height: belowHeight, // Placeholder - actual height determined by row packing
  });
  
  // Validate regions meet minimum viability
  const allViable = regions.every(r => 
    isRegionViable(r.width, r.height, tuning.region_minWidth, tuning.region_minHeight)
  );
  
  if (!allViable) {
    const tooNarrow = regions.find(r => r.width < tuning.region_minWidth);
    const tooShort = regions.find(r => r.height < tuning.region_minHeight);
    
    return {
      regions,
      valid: false,
      invalidReason: tooNarrow 
        ? `Region too narrow: ${Math.round(tooNarrow.width)}px < ${tuning.region_minWidth}px`
        : `Region too short: ${Math.round(tooShort?.height ?? 0)}px < ${tuning.region_minHeight}px`,
    };
  }
  
  return { regions, valid: true };
}

/**
 * Check if a set of regions can accommodate a minimum number of photos.
 * Uses region_minWidth to estimate max photos per row.
 */
export function canRegionsAccommodate(
  regions: RegionSpec[],
  photoCount: number,
  tuning: V3Tuning
): boolean {
  // Rough estimate: each region can fit at least 1 photo if it meets minimum dimensions
  // More sophisticated check during actual distribution
  const viableRegions = regions.filter(r => 
    isRegionViable(r.width, r.height, tuning.region_minWidth, tuning.region_minHeight)
  );
  
  return viableRegions.length > 0 && photoCount > 0;
}
