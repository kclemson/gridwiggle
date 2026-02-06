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
 * ALL configurable values live here - no magic numbers in algorithm code.
 */
export interface V2Tuning {
  // === Hero Area ===
  /** Target area multiplier for hero photos (default 2.0 = 2x area) */
  heroAreaMultiplier: number;
  /** Minimum hero area as % of total canvas (default 0.15 = 15%) */
  minHeroCanvasPercent: number;
  /** Maximum hero area as % of total canvas (default 0.30 = 30%) */
  maxHeroCanvasPercent: number;
  
  // === Hero Side Layout ===
  /** Minimum hero width as fraction of row for side layouts */
  heroMinWidthFraction: number;
  /** Maximum hero width as fraction of row for side layouts */
  heroMaxWidthFraction: number;
  /** Maximum photos beside hero in side layouts */
  maxBesidePhotos: number;
  
  // === Row Layout ===
  /** Preferred photos per row for standard content */
  targetPhotosPerRow: number;
  
  // === Shape Thresholds ===
  /** AR >= this is considered landscape */
  landscapeMinAR: number;
  /** AR <= this is considered portrait */
  portraitMaxAR: number;
  /** ±this tolerance from 1.0 for square */
  squareTolerance: number;
  
  // === Scoring Weights ===
  /** Weight for area uniformity in scoring */
  areaUniformityWeight: number;
  /** Weight for shape compliance in scoring */
  shapeComplianceWeight: number;
  /** Weight for hero prominence in scoring */
  heroProminenceWeight: number;
}

export const DEFAULT_V2_TUNING: V2Tuning = {
  // Hero Area
  heroAreaMultiplier: 2.0,
  minHeroCanvasPercent: 0.15,
  maxHeroCanvasPercent: 0.30,
  
  // Hero Side Layout
  heroMinWidthFraction: 0.30,
  heroMaxWidthFraction: 0.60,
  maxBesidePhotos: 4,
  
  // Row Layout
  targetPhotosPerRow: 3.5,
  
  // Shape Thresholds
  landscapeMinAR: 1.2,
  portraitMaxAR: 0.83,
  squareTolerance: 0.1,
  
  // Scoring Weights
  areaUniformityWeight: 1.0,
  shapeComplianceWeight: 2.0,
  heroProminenceWeight: 1.5,
};
