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
import { devLogger } from '@/lib/devLogger';

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
  tuning: V3Tuning,
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'left' | 'right' | 'center' = 'top-left'
): DecompositionResult {
  switch (mode) {
    case 'corner':
      return decomposeCorner(canvasWidth, heroRect, gap, tuning, position);
    case 'edge':
      devLogger.log('v3', 'Edge mode fallback', {
        position,
        reason: 'Edge decomposition not yet implemented, using corner',
      });
      return decomposeCorner(canvasWidth, heroRect, gap, tuning, position);
    case 'floating':
      devLogger.log('v3', 'Floating mode fallback', {
        position,
        reason: 'Floating decomposition not yet implemented, using corner',
      });
      return decomposeCorner(canvasWidth, heroRect, gap, tuning, position);
    default:
      return { regions: [], valid: false, invalidReason: `Unknown mode: ${mode}` };
  }
}

/**
 * Corner decomposition: Hero in corner, content beside and below.
 * Position determines which side the BESIDE region is on.
 */
function decomposeCorner(
  canvasWidth: number,
  heroRect: RegionSpec,
  gap: number,
  tuning: V3Tuning,
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'left' | 'right' | 'center'
): DecompositionResult {
  const regions: RegionSpec[] = [];
  
  // BESIDE region: position depends on hero placement
  let besideX: number;
  let besideWidth: number;
  
  if (position === 'top-left' || position === 'bottom-left' || position === 'left') {
    // Hero on left: BESIDE is to the RIGHT
    besideX = heroRect.x + heroRect.width + gap;
    besideWidth = canvasWidth - besideX;
  } else {
    // Hero on right: BESIDE is to the LEFT
    besideX = 0;
    besideWidth = heroRect.x - gap;
  }
  
  if (besideWidth > tuning.region_minWidth) {
    regions.push({
      x: besideX,
      y: heroRect.y,
      width: besideWidth,
      height: heroRect.height,
    });
  }
  
  // BELOW region: full width, below hero row
  // Height is Infinity to indicate unbounded (grows as needed during packing)
  const belowY = heroRect.y + heroRect.height + gap;
  
  regions.push({
    x: 0,
    y: belowY,
    width: canvasWidth,
    height: Infinity, // Unbounded - actual height determined by row packing
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
