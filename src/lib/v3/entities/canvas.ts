/**
 * Canvas Entity
 * 
 * Manages canvas space and performs sub-rectangle decomposition.
 * The hero "carves" the canvas into 2-4 content regions.
 * 
 * Note: This module works in normalized space (hero height = 1.0).
 * No pixel-based constraints - all viability is handled through
 * scale-invariant ratios (canvas AR, prominence, etc.)
 */

import { 
  RegionSpec, 
  DecompositionMode, 
  DecompositionResult,
  V3Tuning 
} from '../types';
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
      return decomposeCorner(canvasWidth, heroRect, gap, position);
    case 'edge':
      devLogger.log('v3', 'Edge mode fallback', {
        position,
        reason: 'Edge decomposition not yet implemented, using corner',
      });
      return decomposeCorner(canvasWidth, heroRect, gap, position);
    case 'floating':
      devLogger.log('v3', 'Floating mode fallback', {
        position,
        reason: 'Floating decomposition not yet implemented, using corner',
      });
      return decomposeCorner(canvasWidth, heroRect, gap, position);
    default:
      return { regions: [], valid: false, invalidReason: `Unknown mode: ${mode}` };
  }
}

/**
 * Corner decomposition: Hero in corner, content beside and below.
 * Position determines which side the BESIDE region is on.
 * 
 * All dimensions are in normalized space - no pixel-based viability checks.
 */
function decomposeCorner(
  canvasWidth: number,
  heroRect: RegionSpec,
  gap: number,
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
  
  // Only add BESIDE region if it has positive width
  if (besideWidth > 0) {
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
  
  // In normalized space, all regions with positive dimensions are valid
  // Viability is enforced through canvas AR and prominence constraints at the intersection level
  return { regions, valid: true };
}

/**
 * Check if a set of regions can accommodate a minimum number of photos.
 * In normalized space, any region with positive dimensions can hold photos.
 */
export function canRegionsAccommodate(
  regions: RegionSpec[],
  photoCount: number,
  _tuning: V3Tuning
): boolean {
  // In normalized space, any positive-dimension region can hold at least one photo
  const viableRegions = regions.filter(r => r.width > 0 && (r.height > 0 || !Number.isFinite(r.height)));
  
  return viableRegions.length > 0 && photoCount > 0;
}
