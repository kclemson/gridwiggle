/**
 * V2 Layout Types
 * 
 * Clean type definitions for the v2 layout algorithm.
 * Designed for area-based allocation rather than row-first thinking.
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Photo dimensions for layout calculations.
 * Weight determines relative area allocation (hero=2.0, standard=1.0).
 */
export interface PhotoDimension {
  id: string;
  aspectRatio: number;
  weight: number;
}

/**
 * A rectangular region on the canvas.
 * All coordinates are in logical pixels.
 */
export interface RegionSpec {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A cell in the final layout - a photo placed in a region.
 */
export interface LayoutCell extends RegionSpec {
  photoId: string;
}

/**
 * A complete layout candidate with scoring metadata.
 */
export interface LayoutCandidate {
  cells: LayoutCell[];
  canvasWidth: number;
  canvasHeight: number;
  score: number;
  metadata?: {
    strategy: string;
    areaCV?: number;
    directionPenalty?: number;
  };
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Target canvas aspect ratio constraints.
 */
export type ShapeTarget = 'auto' | 'landscape' | 'portrait' | 'square';

/**
 * Options for layout generation.
 */
export interface LayoutOptions {
  /** Canvas width in logical pixels */
  canvasWidth: number;
  /** Gap between photos in pixels */
  gap: number;
  /** Target canvas shape */
  shape: ShapeTarget;
  /** Randomize for variety vs deterministic best */
  randomize: boolean;
}

/**
 * Tuning parameters for v2 algorithm.
 * All based on continuous values, not discrete thresholds.
 */
export interface V2Tuning {
  /** Target area multiplier for hero photos (default 2.0 = 2x area) */
  heroAreaMultiplier: number;
  
  /** Minimum hero area as % of total canvas (default 0.15 = 15%) */
  minHeroCanvasPercent: number;
  
  /** Maximum hero area as % of total canvas (default 0.30 = 30%) */
  maxHeroCanvasPercent: number;
  
  /** Weight for area uniformity in scoring (default 1.0) */
  areaUniformityWeight: number;
  
  /** Weight for shape compliance in scoring (default 2.0) */
  shapeComplianceWeight: number;
  
  /** Preferred photos per row for standard content (default 3.5) */
  targetPhotosPerRow: number;
}

export const DEFAULT_V2_TUNING: V2Tuning = {
  heroAreaMultiplier: 2.0,
  minHeroCanvasPercent: 0.15,
  maxHeroCanvasPercent: 0.30,
  areaUniformityWeight: 1.0,
  shapeComplianceWeight: 2.0,
  targetPhotosPerRow: 3.5,
};
