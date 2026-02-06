/**
 * V3 Layout Types
 * 
 * First-principles type definitions for constraint intersection layout.
 * Row counts are derived from geometry, not specified as parameters.
 */

// ============================================================================
// Tuning Configuration
// ============================================================================

/**
 * Minimal tuning parameters for V3 layout.
 * 8 parameters that each serve a clear purpose.
 */
export interface V3Tuning {
  // === Hero Prominence ===
  /** Floor: reject layouts where hero/runnerUp ratio is below this (1.3) */
  hero_minProminence: number;
  /** Target for hero sizing math - hero area = contentArea * this (1.5) */
  hero_targetProminence: number;
  
  // === Region Viability ===
  /** Minimum region height in pixels - below this is not viable (80) */
  region_minHeight: number;
  /** Minimum region width in pixels - below this is not viable (80) */
  region_minWidth: number;
  
  // === Decomposition Thresholds ===
  /** Min content photos to attempt edge placement (8) */
  decomp_edgeMinPhotos: number;
  /** Min content photos to attempt floating placement (15) */
  decomp_floatingMinPhotos: number;
  
  // === Final Equalization ===
  /** Smartcrop slack for row height equalization (0.10 = 10%) */
  row_flexPercent: number;
}

export const DEFAULT_V3_TUNING: V3Tuning = {
  hero_minProminence: 1.3,
  hero_targetProminence: 1.5,
  region_minHeight: 80,
  region_minWidth: 80,
  decomp_edgeMinPhotos: 8,
  decomp_floatingMinPhotos: 15,
  row_flexPercent: 0.10,
};

// ============================================================================
// Core Types
// ============================================================================

/**
 * Photo dimensions for layout calculations.
 * Weight determines hero status (weight > 1 = hero).
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

// ============================================================================
// Hero Types
// ============================================================================

/**
 * Decomposition mode - how the hero carves the canvas.
 */
export type DecompositionMode = 'corner' | 'edge' | 'floating';

/**
 * A proposed hero position with its decomposition mode.
 */
export interface HeroProposal {
  /** The hero's position and dimensions */
  rect: RegionSpec;
  /** How the canvas is decomposed around the hero */
  mode: DecompositionMode;
  /** Which corner/edge the hero is placed at */
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'left' | 'right' | 'center';
}

// ============================================================================
// Content Pool Types
// ============================================================================

/**
 * Aggregate statistics about content photos.
 */
export interface ContentStats {
  /** Number of content photos (excluding hero) */
  count: number;
  /** Mean aspect ratio of content photos */
  meanAR: number;
  /** Variance in aspect ratios (for diversity scoring) */
  arVariance: number;
}

/**
 * Assignment of photos to regions.
 */
export interface PhotoDistribution {
  /** Map of region index to assigned photo IDs */
  assignments: Map<number, string[]>;
  /** Total photos distributed */
  totalAssigned: number;
}

// ============================================================================
// Canvas Types
// ============================================================================

/**
 * Result of canvas decomposition.
 */
export interface DecompositionResult {
  /** Content regions carved by the hero */
  regions: RegionSpec[];
  /** Whether all regions meet minimum viability */
  valid: boolean;
  /** Reason if invalid */
  invalidReason?: string;
}

// ============================================================================
// Layout Result Types
// ============================================================================

/**
 * A scored layout configuration.
 */
export interface ScoredConfiguration {
  /** The hero proposal used */
  proposal: HeroProposal;
  /** Photo distribution across regions */
  distribution: PhotoDistribution;
  /** Final positioned cells */
  cells: LayoutCell[];
  /** Total canvas height */
  canvasHeight: number;
  /** Hero prominence ratio achieved */
  prominenceRatio: number;
  /** Overall score for ranking */
  score: number;
}
