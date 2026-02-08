/**
 * Constraint Intersection Engine
 * 
 * Orchestrates the normalized space layout algorithm:
 * 1. Hero proposes positions (normalized)
 * 2. Find valid region assignment
 * 3. Pack both regions in normalized space
 * 4. Scale to pixels
 * 5. Validate constraints
 */

import { 
  PhotoDimension,
  V3Tuning,
  NormalizedHeroProposal,
  ScoredConfiguration,
  LayoutCell,
  HeroProposal,
  DEFAULT_V3_TUNING
} from './types';
import { packToFillHeight, packToFillWidth, calculateBelowRowCount } from './normalized-pack';
import { findValidRegionAssignment, RejectedPack } from './region-search';
import { calculateContentStats, coefficientOfVariation, getEffectiveMinProminence, getEffectiveMaxToSmallest, getEffectiveCanvasMinAR, getEffectiveCanvasMaxAR } from './utils';
import { proposePositions, validateProminence, validateSmallestCellRatio, findHeroPhoto, getContentPhotos } from './entities/hero';
import { devLogger } from '@/lib/devLogger';

// ============================================================================
// Rejection Tracking (for production logging)
// ============================================================================

let lastRejection: { reason: string; details: Record<string, unknown> } | null = null;

export function setRejection(reason: string, details: Record<string, unknown>) {
  lastRejection = { reason, details };
}

export function getLastRejection() {
  return lastRejection;
}

export function clearRejections() {
  lastRejection = null;
}

// ============================================================================
// Rejected Layout Storage (for debugging visualization)
// ============================================================================

import type { RejectedLayout } from './types';

let lastRejectedLayout: RejectedLayout | null = null;

export function setRejectedLayout(layout: RejectedLayout) {
  lastRejectedLayout = layout;
}

export function getLastRejectedLayout(): RejectedLayout | null {
  return lastRejectedLayout;
}

export function clearRejectedLayout() {
  lastRejectedLayout = null;
}

// ============================================================================
// Main Intersection Algorithm
// ============================================================================

/**
 * Find valid layout configurations through constraint intersection.
 * 
 * New normalized space algorithm:
 * 1. Hero proposes positions (corner, edge, floating) in normalized space
 * 2. For each proposal: find best BESIDE/BELOW split
 * 3. Pack both regions in normalized space (hero height = 1)
 * 4. Scale entire layout to pixel dimensions
 * 5. Validate constraints (canvas AR, prominence) - mark violations as soft rejections
 * 6. Always return best config (soft rejections instead of hard failures)
 */
export function findValidConfiguration(
  photos: PhotoDimension[],
  normalizedGap: number,  // Already in normalized space (0-0.04)
  tuning: V3Tuning = DEFAULT_V3_TUNING,
  randomize: boolean = false
): ScoredConfiguration {
  // Find hero and content photos
  const heroPhoto = findHeroPhoto(photos);
  const contentPhotos = getContentPhotos(photos);
  
  // If no hero, generate simple rows layout
  if (!heroPhoto) {
    return generateSimpleRowsLayout(photos, normalizedGap, tuning);
  }
  
  // Get content statistics
  const contentStats = calculateContentStats(contentPhotos);
  
  // Generate hero position proposals in normalized space
  const proposals = proposePositions(heroPhoto, contentStats, tuning);
  
  devLogger.log('layout', 'Normalized proposals generated', {
    count: proposals.length,
    heroAR: heroPhoto.aspectRatio.toFixed(2),
    contentCount: contentStats.count,
  });
  
  // Evaluate each proposal - all proposals now return configs (never null)
  const allConfigs: ScoredConfiguration[] = [];
  
  for (const proposal of proposals) {
    const config = evaluateNormalizedProposal(
      proposal,
      heroPhoto,
      contentPhotos,
      normalizedGap,
      tuning,
      randomize
    );
    
    // Config is now always non-null (soft rejections instead of hard)
    allConfigs.push(config);
  }
  
  // Sort by score (soft-rejected configs naturally score lower)
  allConfigs.sort((a, b) => b.score - a.score);
  
  // Always return best available
  const best = allConfigs[0];
  
  devLogger.log('layout', 'Best configuration selected', {
    score: best.score.toFixed(3),
    prominenceRatio: best.prominenceRatio.toFixed(2),
    canvasHeight: Math.round(best.canvasHeight),
    hasSoftRejection: !!best.softRejection,
  });
  
  return best;
}

// ============================================================================
// Normalized Proposal Evaluation
// ============================================================================

/**
 * Evaluate a hero proposal using normalized space packing.
 */
function evaluateNormalizedProposal(
  proposal: NormalizedHeroProposal,
  heroPhoto: PhotoDimension,
  contentPhotos: PhotoDimension[],
  normalizedGap: number,  // Already in normalized space (0-0.04)
  tuning: V3Tuning,
  randomize: boolean
): ScoredConfiguration {
  const heroAR = heroPhoto.aspectRatio;
  
  // Track soft rejection (layout is usable but outside ideal bounds)
  let softRejection: ScoredConfiguration['softRejection'] = undefined;
  
  devLogger.log('layout', 'Evaluating normalized proposal', {
    mode: proposal.mode,
    position: proposal.position,
    heroAR: heroAR.toFixed(2),
    normalizedGap: normalizedGap.toFixed(3),
  });
  
  // Edge and floating modes not yet implemented - use corner decomposition
  // For now, treat non-corner as soft rejection and use corner logic
  if (proposal.mode !== 'corner') {
    devLogger.log('layout', 'Mode not implemented, using corner fallback', { mode: proposal.mode });
    // Continue with corner mode logic - softRejection will be set if needed
  }
  
  // Find valid region assignment (now always returns an assignment)
  const regionResult = findValidRegionAssignment(
    contentPhotos,
    heroAR,
    heroPhoto.id,
    normalizedGap,
    tuning,
    randomize
  );
  
  // regionResult.assignment is now always non-null
  const regionAssignment = regionResult.assignment!;
  
  // Carry forward soft rejection from region search (if any)
  if (regionAssignment.softRejection) {
    softRejection = regionAssignment.softRejection;
  }
  
  // Handle "no BESIDE" vs "with BESIDE" cases
  let besideResult: { cells: { photoId: string; x: number; y: number; width: number; height: number }[]; width: number; height: number };
  let heroRowWidth: number;
  
  if (regionAssignment.besidePhotos.length === 0) {
    // No BESIDE region - hero takes full width
    besideResult = { cells: [], width: 0, height: 1.0 };
    heroRowWidth = heroAR;
  } else {
    // Pack BESIDE at height = 1
    besideResult = packToFillHeight(
      regionAssignment.besidePhotos,
      1.0,
      normalizedGap,
      regionAssignment.besideRowCount,
      tuning,
      randomize
    );
    heroRowWidth = heroAR + normalizedGap + besideResult.width;
  }
  
  // Use the belowRowCount that was validated during region search
  const belowRowCount = regionAssignment.belowRowCount;
  
  // For rejection diagnostics - extract early so available to all validation points
  const besideCount = regionAssignment.besidePhotos.length;
  const besideRowCount = regionAssignment.besideRowCount;
  
  // Get constraint breakdown for diagnostics (recompute to have access here)
  const belowRowCalc = calculateBelowRowCount(
    regionAssignment.belowPhotos,
    heroRowWidth,
    normalizedGap,
    heroAR,
    tuning,
    false // Deterministic for diagnostics
  );
  const belowConstraints = belowRowCalc.constraints;
  
  // Pack BELOW at hero row width
  const belowResult = packToFillWidth(
    regionAssignment.belowPhotos,
    heroRowWidth,
    normalizedGap,
    belowRowCount,
    tuning,
    randomize
  );
  
  // Calculate total normalized canvas
  const normalizedWidth = heroRowWidth;
  const normalizedHeight = 1.0 + normalizedGap + belowResult.height;
  
  // Include border in normalized canvas dimensions
  const normalizedWidthWithBorder = normalizedWidth + 2 * normalizedGap;
  const normalizedHeightWithBorder = normalizedHeight + 2 * normalizedGap;
  
  // Final canvas dimensions in normalized space (no pixel scaling)
  const canvasWidth = normalizedWidthWithBorder;
  const canvasHeight = normalizedHeightWithBorder;
  
  devLogger.log('layout', 'Normalized canvas dimensions', {
    normalizedWidth: normalizedWidth.toFixed(3),
    normalizedHeight: normalizedHeight.toFixed(3),
    withBorder: `${canvasWidth.toFixed(3)} x ${canvasHeight.toFixed(3)}`,
  });
  
  // NOTE: cells are computed later after position selection for corner mode
  
  // Calculate canvas AR for validation
  const canvasAR = canvasWidth / canvasHeight;
  
  // Validate canvas AR (with epsilon tolerance for floating-point precision)
  const AR_EPSILON = 0.01;
  
  // Get effective canvas AR bounds (relaxed for low photo counts)
  const effectiveMinAR = getEffectiveCanvasMinAR(contentPhotos.length, tuning);
  const effectiveMaxAR = getEffectiveCanvasMaxAR(contentPhotos.length, tuning);
  
  // Helper to compute cells for rejected layout capture (uses top-left as default position)
  const computeRejectedCells = () => convertToNormalized(
    heroPhoto,
    'top-left', // Default position for rejected layouts
    heroAR,
    besideResult.cells,
    belowResult.cells,
    belowResult.height,
    normalizedGap,
    normalizedWidth
  );
  
  // Track soft rejection for canvas AR violations (layout is valid but outside aesthetic bounds)
  // Only set if not already set by region search
  
  if (!softRejection && canvasAR < effectiveMinAR - AR_EPSILON) {
    const details = { 
      canvasAR: +canvasAR.toFixed(2), 
      allowed: `${effectiveMinAR.toFixed(2)} - ${effectiveMaxAR.toFixed(2)}`,
      besideCount,
      besideRowCount,
      belowRowCount,
      belowConstraints,
      heroAR: +heroAR.toFixed(2),
    };
    softRejection = { reason: 'canvas_too_tall', details };
    devLogger.log('v3', 'Canvas AR below minimum (soft rejection)', details);
    // Continue instead of returning null - layout is geometrically valid
  }
  
  if (!softRejection && canvasAR > effectiveMaxAR + AR_EPSILON) {
    const details = { 
      canvasAR: +canvasAR.toFixed(2), 
      allowed: `${effectiveMinAR.toFixed(2)} - ${effectiveMaxAR.toFixed(2)}`,
      besideCount,
      besideRowCount,
      belowRowCount,
      belowConstraints,
      heroAR: +heroAR.toFixed(2),
    };
    softRejection = { reason: 'canvas_too_wide', details };
    devLogger.log('v3', 'Canvas AR above maximum (soft rejection)', details);
    // Continue instead of returning null - layout is geometrically valid
  }
  
  // Validate hero prominence (area ratios are scale-invariant)
  // Content areas can be computed from packed results before final cell conversion
  const heroArea = heroAR * 1.0; // heroWidth × heroHeight in normalized space
  const contentAreas = [
    ...besideResult.cells.map(c => c.width * c.height),
    ...belowResult.cells.map(c => c.width * c.height),
  ];
  const prominence = validateProminence(heroArea, contentAreas, tuning);
  
  if (!prominence.valid) {
    const rejectedCells = computeRejectedCells();
    const details = { 
      prominenceRatio: +prominence.ratio.toFixed(2), 
      required: tuning.hero_minProminence,
      besideCount,
      besideRowCount,
      belowRowCount,
      belowConstraints,
      heroAR: +heroAR.toFixed(2),
      canvasAR: +canvasAR.toFixed(2),
    };
    
    // Log warning with geometry for dev hover preview
    devLogger.warn('layout-reject', 'Prominence too low (soft)', details, {
      cells: rejectedCells,
      canvasWidth,
      canvasHeight,
    });
    
    // Mark as soft rejection instead of returning null
    if (!softRejection) {
      softRejection = { reason: 'prominence_too_low', details };
    }
    // Continue - layout is geometrically valid
  }
  
  // Validate hero-to-smallest ratio (prevent tiny content cells)
  // Use effective limit (relaxed for low photo counts)
  const effectiveMaxToSmallest = getEffectiveMaxToSmallest(contentPhotos.length, tuning);
  const smallestCheck = validateSmallestCellRatio(heroArea, contentAreas, effectiveMaxToSmallest);
  
  if (!smallestCheck.valid) {
    const rejectedCells = computeRejectedCells();
    // Include smallest 3 areas for debugging
    const sortedAreas = [...contentAreas].sort((a, b) => a - b);
    const smallestAreas = sortedAreas.slice(0, 3).map(a => +a.toFixed(4));
    const details = { 
      ratio: +smallestCheck.ratio.toFixed(1), 
      maxAllowed: effectiveMaxToSmallest,
      heroArea: +heroArea.toFixed(3),
      smallestAreas,
      besideCount,
      besideRowCount,
      belowRowCount,
      belowConstraints,
      heroAR: +heroAR.toFixed(2),
      canvasAR: +canvasAR.toFixed(2),
    };
    
    // Log warning with geometry for dev hover preview
    devLogger.warn('layout-reject', 'Hero too large vs smallest cells (soft)', details, {
      cells: rejectedCells,
      canvasWidth,
      canvasHeight,
    });
    
    // Mark as soft rejection instead of returning null
    if (!softRejection) {
      softRejection = { reason: 'hero_too_large_vs_smallest', details };
    }
    // Continue - layout is geometrically valid
  }
  
  // For corner mode, apply random position selection for variety
  // All 4 corner positions are symmetric - identical region assignments and scores
  const cornerPositions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
  const selectedPosition = proposal.mode === 'corner' && randomize
    ? cornerPositions[Math.floor(Math.random() * cornerPositions.length)]
    : proposal.position;
  
  // Convert all cells to normalized coordinates (with border offset)
  // Use selectedPosition for final coordinate mapping
  const cells = convertToNormalized(
    heroPhoto,
    selectedPosition,
    heroAR,
    besideResult.cells,
    belowResult.cells,
    belowResult.height,
    normalizedGap,
    normalizedWidth
  );
  
  // Score the configuration
  const score = scoreConfiguration(prominence.ratio, cells, tuning, randomize);
  
  // Create legacy-format proposal for ScoredConfiguration compatibility
  const heroCell = cells[0];
  const legacyProposal: HeroProposal = {
    rect: { x: heroCell.x, y: heroCell.y, width: heroCell.width, height: heroCell.height },
    mode: proposal.mode,
    position: selectedPosition,
  };
  
  devLogger.log('layout', 'Proposal accepted', {
    mode: proposal.mode,
    position: selectedPosition,
    prominenceRatio: prominence.ratio.toFixed(2),
    canvasAR: canvasAR.toFixed(2),
    score: score.toFixed(3),
  });
  
  return {
    proposal: legacyProposal,
    distribution: { 
      assignments: new Map([
        [0, regionAssignment.besidePhotos.map(p => p.id)],
        [1, regionAssignment.belowPhotos.map(p => p.id)],
      ]), 
      totalAssigned: contentPhotos.length 
    },
    cells,
    canvasHeight,
    canvasWidth,
    prominenceRatio: prominence.ratio,
    score,
    softRejection,
  };
}

// ============================================================================
// Normalized Coordinate Conversion
// ============================================================================

/**
 * Convert normalized cells to final layout coordinates.
 * No pixel scaling - everything stays in normalized space.
 */
function convertToNormalized(
  heroPhoto: PhotoDimension,
  position: string,
  heroAR: number,
  besideCells: { photoId: string; x: number; y: number; width: number; height: number }[],
  belowCells: { photoId: string; x: number; y: number; width: number; height: number }[],
  belowHeight: number,
  normalizedGap: number,
  normalizedWidth: number
): LayoutCell[] {
  const cells: LayoutCell[] = [];
  
  const heroNormalizedWidth = heroAR;
  const heroNormalizedHeight = 1.0;
  
  // Border offset - all cells shift by normalizedGap to create edge padding
  const borderOffset = normalizedGap;
  
  // Determine position type
  const isBottom = position === 'bottom-left' || position === 'bottom-right';
  const isRight = position === 'top-right' || position === 'bottom-right' || position === 'right';
  
  // Hero X position (add border offset)
  const heroX = isRight 
    ? borderOffset + (normalizedWidth - heroNormalizedWidth) 
    : borderOffset;
  
  // Hero Y position (flip for bottom corners)
  const heroY = isBottom 
    ? borderOffset + (belowHeight + normalizedGap) 
    : borderOffset;
  
  cells.push({
    photoId: heroPhoto.id,
    x: heroX,
    y: heroY,
    width: heroNormalizedWidth,
    height: heroNormalizedHeight,
  });
  
  // BESIDE cells - offset based on hero position
  const besideOffsetX = isRight 
    ? borderOffset  // BESIDE is to the LEFT of hero
    : borderOffset + (heroNormalizedWidth + normalizedGap);  // RIGHT of hero
  
  // BESIDE Y offset (same row as hero)
  const besideOffsetY = isBottom 
    ? borderOffset + (belowHeight + normalizedGap) 
    : borderOffset;
  
  for (const cell of besideCells) {
    const cellX = isRight 
      ? borderOffset + cell.x  // LEFT of hero - add border
      : besideOffsetX + cell.x;  // RIGHT of hero
    cells.push({
      photoId: cell.photoId,
      x: cellX,
      y: besideOffsetY + cell.y,
      width: cell.width,
      height: cell.height,
    });
  }
  
  // BELOW cells - full width, position depends on top/bottom
  const belowOffsetY = isBottom 
    ? borderOffset  // BELOW goes at top for bottom corners
    : borderOffset + (1.0 + normalizedGap);  // BELOW goes below hero row for top corners

  for (const cell of belowCells) {
    const cellY = isBottom 
      ? borderOffset + cell.y  // BELOW at top - add border
      : belowOffsetY + cell.y;  // BELOW below hero
    cells.push({
      photoId: cell.photoId,
      x: borderOffset + cell.x,
      y: cellY,
      width: cell.width,
      height: cell.height,
    });
  }
  
  return cells;
}


// ============================================================================
// Scoring
// ============================================================================

/**
 * Score a configuration.
 * Higher is better.
 */
function scoreConfiguration(
  prominenceRatio: number,
  cells: LayoutCell[],
  tuning: V3Tuning,
  randomize: boolean
): number {
  // Base score from prominence (higher prominence = better)
  const prominenceScore = prominenceRatio / tuning.hero_targetProminence;
  
  // Cell area uniformity (lower variance = better)
  const areas = cells.slice(1).map(c => c.width * c.height); // Exclude hero
  const areaUniformity = areas.length > 1 ? 1 / (1 + coefficientOfVariation(areas)) : 1;
  
  // Random tiebreaker only when shuffling for variety
  const randomTiebreaker = randomize ? Math.random() * 0.01 : 0;
  
  return (prominenceScore * 0.6) + (areaUniformity * 0.4) + randomTiebreaker;
}


// ============================================================================
// Hero-less Layout Generation
// ============================================================================

/**
 * Generate a layout with no hero - all photos in rows.
 * Returns layout in normalized space (no pixel scaling).
 */
function generateSimpleRowsLayout(
  photos: PhotoDimension[],
  normalizedGap: number,  // Already in normalized space (0-0.04)
  tuning: V3Tuning
): ScoredConfiguration {
  // Edge case: no photos - return minimal empty layout
  if (photos.length === 0) {
    const dummyProposal: HeroProposal = {
      rect: { x: 0, y: 0, width: 0, height: 0 },
      mode: 'corner',
      position: 'top-left',
    };
    return {
      proposal: dummyProposal,
      distribution: { assignments: new Map(), totalAssigned: 0 },
      cells: [],
      canvasHeight: 1,
      canvasWidth: 1,
      prominenceRatio: 1,
      score: 0,
      softRejection: { reason: 'no_photos', details: {} },
    };
  }
  
  // Determine row count using geometry-aware calculation (enforces both min and max AR)
  const rowCountResult = calculateBelowRowCount(
    photos, 
    1.0, 
    normalizedGap, 
    0,     // No hero
    tuning
  );
  const rowCount = rowCountResult.value;
  
  // Pack in normalized space (use width = 1.0 as reference)
  // Simple rows always use deterministic packing (no hero = no shuffle)
  const normalizedResult = packToFillWidth(photos, 1.0, normalizedGap, rowCount, tuning, false);
  
  // Include border in normalized canvas dimensions
  const normalizedWidthWithBorder = 1.0 + 2 * normalizedGap;
  const normalizedHeightWithBorder = normalizedResult.height + 2 * normalizedGap;
  
  // Canvas dimensions in normalized space (no scaling)
  const canvasWidth = normalizedWidthWithBorder;
  const canvasHeight = normalizedHeightWithBorder;
  
  // Border offset - all cells shift by normalizedGap to create edge padding
  const borderOffset = normalizedGap;
  
  // Convert cells to normalized coordinates with border offset
  const cells: LayoutCell[] = normalizedResult.cells.map(cell => ({
    photoId: cell.photoId,
    x: borderOffset + cell.x,
    y: borderOffset + cell.y,
    width: cell.width,
    height: cell.height,
  }));
  
  devLogger.log('layout', 'Simple rows: normalized canvas dimensions', {
    normalizedHeight: normalizedResult.height.toFixed(3),
    withBorder: `${canvasWidth.toFixed(3)} x ${canvasHeight.toFixed(3)}`,
  });
  
  const canvasAR = canvasWidth / canvasHeight;
  
  // Track soft rejection for canvas AR bounds
  let softRejection: ScoredConfiguration['softRejection'] = undefined;
  
  // Validate canvas AR bounds - soft rejection (layout is valid, just outside aesthetic bounds)
  if (canvasAR < tuning.canvas_minAR || canvasAR > tuning.canvas_maxAR) {
    const details = { 
      canvasAR: +canvasAR.toFixed(2), 
      allowed: `${tuning.canvas_minAR.toFixed(2)} - ${tuning.canvas_maxAR.toFixed(2)}`,
      rowCount,
      photoCount: photos.length,
    };
    
    // Log warning with geometry for dev hover preview
    devLogger.warn('layout-reject', 'Simple rows AR out of bounds (soft)', details, {
      cells,
      canvasWidth,
      canvasHeight,
    });
    
    softRejection = { 
      reason: canvasAR < tuning.canvas_minAR ? 'canvas_too_tall' : 'canvas_too_wide', 
      details 
    };
    // Continue - layout is geometrically valid
  }
  
  // Create dummy proposal for compatibility
  const dummyProposal: HeroProposal = {
    rect: { x: 0, y: 0, width: 0, height: 0 },
    mode: 'corner',
    position: 'top-left',
  };
  
  // Score based on area uniformity (scale-invariant)
  const areas = cells.map(c => c.width * c.height);
  const areaUniformity = 1 / (1 + coefficientOfVariation(areas));
  
  return {
    proposal: dummyProposal,
    distribution: { assignments: new Map([[0, photos.map(p => p.id)]]), totalAssigned: photos.length },
    cells,
    canvasHeight,
    canvasWidth,
    prominenceRatio: 1,
    score: areaUniformity,
    softRejection,
  };
}
