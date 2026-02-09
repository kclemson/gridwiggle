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
 * 6 parameters that each serve a clear purpose.
 * All constraints are scale-invariant (ratios, not pixels).
 */
export interface V3Tuning {
  // === Hero Prominence ===
  /** Floor: reject layouts where hero/runnerUp ratio is below this (1.3) */
  hero_minProminence: number;
  /** Target for hero sizing math - hero area = contentArea * this (1.5) */
  hero_targetProminence: number;
  
  // === Decomposition Thresholds ===
  /** Min content photos to attempt edge placement (8) */
  decomp_edgeMinPhotos: number;
  /** Min content photos to attempt floating placement (15) */
  decomp_floatingMinPhotos: number;
  
  // === Final Equalization ===
  /** Smartcrop slack for row height equalization (0.10 = 10%) */
  row_flexPercent: number;
  
  // === Canvas Proportion Limits ===
  /** Minimum canvas aspect ratio (most portrait allowed), e.g. 0.5 = 1:2 */
  canvas_minAR: number;
  /** Maximum canvas aspect ratio (most landscape allowed), e.g. 2.0 = 2:1 */
  canvas_maxAR: number;
  
  // === Row Distribution ===
  /** AR budget jitter for organic variation (0.2 = +/- 20%) */
  row_arBudgetJitter: number;
  /** Max row height relative to average (1.8 = 180% of avg height) */
  row_maxHeightRatio: number;
  
  // === Hero-to-Smallest Constraint ===
  /** Max hero area relative to avg of smallest content photos (45 = hero ≤ 45× smallest) */
  hero_maxToSmallest: number;
  
  // === Low Photo Count Accommodation ===
  /** Content photo threshold for reduced prominence (6 = apply to ≤5 content photos) */
  hero_lowCountThreshold: number;
  /** Multiplier applied to hero_minProminence for low counts (0.85 = 1.3 → 1.1) */
  hero_lowCountMultiplier: number;
  
  // === Prominence Calculation ===
  /** Top fraction of content photos used for prominence comparison (0.25 = top 25%) */
  hero_prominenceTopFraction: number;
}

export const DEFAULT_V3_TUNING: V3Tuning = {
  hero_minProminence: 0.70,
  hero_targetProminence: 1.5,
  decomp_edgeMinPhotos: 8,
  decomp_floatingMinPhotos: 15,
  row_flexPercent: 0.10,
  canvas_minAR: 0.5,
  canvas_maxAR: 2.25,
  row_arBudgetJitter: 0.6,
  row_maxHeightRatio: 1.8,
  hero_maxToSmallest: 45,
  hero_lowCountThreshold: 8,
  hero_lowCountMultiplier: 0.85,
  hero_prominenceTopFraction: 0.25,
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
// Normalized Space Types (hero height = 1)
// ============================================================================

/**
 * A region in normalized space where hero height = 1.
 * All dimensions are in AR units, not pixels.
 */
export interface NormalizedRegion {
  x: number;
  y: number;
  width: number;  // In AR units (heroWidth = heroAR when heroHeight = 1)
  height: number; // Relative to hero height (1.0)
}

/**
 * A cell in normalized space.
 */
export interface NormalizedCell extends NormalizedRegion {
  photoId: string;
}

/**
 * Result of packing in normalized space.
 */
export interface NormalizedPackResult {
  cells: NormalizedCell[];
  width: number;   // Total width used (in AR units)
  height: number;  // Total height used (relative to hero = 1)
  rowCount: number;
}

/**
 * A hero proposal in normalized space.
 */
export interface NormalizedHeroProposal {
  /** Hero dimensions in normalized space (height = 1) */
  rect: NormalizedRegion;
  /** How the canvas is decomposed around the hero */
  mode: DecompositionMode;
  /** Which corner/edge the hero is placed at */
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'left' | 'right' | 'center';
}

/**
 * Result of region assignment search.
 * Currently supports 2 regions (beside/below) for corner mode.
 * Will extend to 3 regions (above/beside/below) for edge mode.
 */
export interface RegionAssignment {
  besidePhotos: PhotoDimension[];
  belowPhotos: PhotoDimension[];
  besideRowCount: number;
  belowRowCount: number;
  score: number;
  /** Soft rejection info - layout is valid but outside aesthetic bounds */
  softRejection?: { reason: string; details: Record<string, unknown> };
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
  /** Derived canvas width (geometry-driven) */
  canvasWidth: number;
  /** Derived canvas height */
  canvasHeight: number;
  /** Hero prominence ratio achieved */
  prominenceRatio: number;
  /** Overall score for ranking */
  score: number;
  /** Soft rejection info if layout is outside aesthetic bounds but still valid */
  softRejection?: {
    reason: string;
    details: Record<string, unknown>;
  };
}

// ============================================================================
// Soft Rejection Types
// ============================================================================

/** Soft rejection reasons (layout exists but outside aesthetic bounds) */
export const SOFT_REJECTION_REASONS = ['canvas_too_tall', 'canvas_too_wide'] as const;

/** Check if a rejection reason is soft (aesthetic) vs hard (impossible) */
export function isSoftRejection(reason: string): boolean {
  return SOFT_REJECTION_REASONS.includes(reason as typeof SOFT_REJECTION_REASONS[number]);
}

// ============================================================================
// Rejected Layout Types (for debugging)
// ============================================================================

/**
 * A layout that was rejected during validation.
 * Stores cell geometry so rejected layouts can be visualized for debugging.
 */
export interface RejectedLayout {
  /** Cell coordinates (null if rejection happened before packing) */
  cells: LayoutCell[] | null;
  /** Canvas width in normalized space */
  canvasWidth: number | null;
  /** Canvas height in normalized space */
  canvasHeight: number | null;
  /** Rejection reason identifier */
  reason: string;
  /** Detailed metrics that triggered rejection */
  details: Record<string, unknown>;
  /** Timestamp for correlation with logs */
  timestamp: number;
}
