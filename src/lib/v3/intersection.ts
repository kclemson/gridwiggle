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
import { calculateContentStats, coefficientOfVariation } from './utils';
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
 * 5. Validate constraints (canvas AR, prominence)
 * 6. Return best valid config (or null - no silent fallbacks)
 */
export function findValidConfiguration(
  photos: PhotoDimension[],
  normalizedGap: number,  // Already in normalized space (0-0.04)
  tuning: V3Tuning = DEFAULT_V3_TUNING,
  randomize: boolean = false
): ScoredConfiguration | null {
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
  
  // Evaluate each proposal
  const validConfigs: ScoredConfiguration[] = [];
  
  for (const proposal of proposals) {
    const config = evaluateNormalizedProposal(
      proposal,
      heroPhoto,
      contentPhotos,
      normalizedGap,
      tuning,
      randomize
    );
    
    if (config) {
      validConfigs.push(config);
    }
  }
  
  // Return null if no valid configurations (no silent fallback)
  if (validConfigs.length === 0) {
    devLogger.warn('layout-reject', 'No valid configurations found');
    return null;
  }
  
  // Sort by score and return best
  validConfigs.sort((a, b) => b.score - a.score);
  
  devLogger.log('layout', 'Best configuration selected', {
    score: validConfigs[0].score.toFixed(3),
    prominenceRatio: validConfigs[0].prominenceRatio.toFixed(2),
    canvasHeight: Math.round(validConfigs[0].canvasHeight),
  });
  
  return validConfigs[0];
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
): ScoredConfiguration | null {
  const heroAR = heroPhoto.aspectRatio;
  
  devLogger.log('layout', 'Evaluating normalized proposal', {
    mode: proposal.mode,
    position: proposal.position,
    heroAR: heroAR.toFixed(2),
    normalizedGap: normalizedGap.toFixed(3),
  });
  
  // Edge and floating modes not yet implemented - use corner decomposition
  if (proposal.mode !== 'corner') {
    devLogger.log('layout', 'Mode not implemented, skipping', { mode: proposal.mode });
    return null;
  }
  
  // Find valid region assignment
  const regionResult = findValidRegionAssignment(
    contentPhotos,
    heroAR,
    normalizedGap,
    tuning,
    randomize
  );
  
  if (!regionResult.assignment) {
    // Capture last rejected pack if available
    if (regionResult.lastRejectedPack) {
      setRejectedLayout({
        cells: regionResult.lastRejectedPack.cells,
        canvasWidth: regionResult.lastRejectedPack.canvasWidth,
        canvasHeight: regionResult.lastRejectedPack.canvasHeight,
        reason: regionResult.lastRejectedPack.reason,
        details: regionResult.lastRejectedPack.details,
        timestamp: Date.now(),
      });
    }
    devLogger.warn('layout-reject', 'No valid region assignment', {
      mode: proposal.mode,
      position: proposal.position,
      hasLastRejectedPack: !!regionResult.lastRejectedPack,
    });
    return null;
  }
  
  const regionAssignment = regionResult.assignment;
  
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
  
  if (canvasAR < tuning.canvas_minAR - AR_EPSILON) {
    const rejectedCells = computeRejectedCells();
    setRejectedLayout({
      cells: rejectedCells,
      canvasWidth,
      canvasHeight,
      reason: 'canvas_too_tall',
      details: { canvasAR: +canvasAR.toFixed(2), minAR: tuning.canvas_minAR },
      timestamp: Date.now(),
    });
    devLogger.warn('layout-reject', 'Canvas too tall', {
      canvasAR: canvasAR.toFixed(2),
      minAR: tuning.canvas_minAR,
    });
    setRejection('Canvas too tall', { canvasAR: +canvasAR.toFixed(2), minAR: tuning.canvas_minAR });
    return null;
  }
  
  if (canvasAR > tuning.canvas_maxAR + AR_EPSILON) {
    const rejectedCells = computeRejectedCells();
    setRejectedLayout({
      cells: rejectedCells,
      canvasWidth,
      canvasHeight,
      reason: 'canvas_too_wide',
      details: { canvasAR: +canvasAR.toFixed(2), maxAR: tuning.canvas_maxAR },
      timestamp: Date.now(),
    });
    devLogger.warn('layout-reject', 'Canvas too wide', {
      canvasAR: canvasAR.toFixed(2),
      maxAR: tuning.canvas_maxAR,
    });
    setRejection('Canvas too wide', { canvasAR: +canvasAR.toFixed(2), maxAR: tuning.canvas_maxAR });
    return null;
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
    setRejectedLayout({
      cells: rejectedCells,
      canvasWidth,
      canvasHeight,
      reason: 'prominence_too_low',
      details: { ratio: +prominence.ratio.toFixed(2), required: tuning.hero_minProminence },
      timestamp: Date.now(),
    });
    devLogger.warn('layout-reject', 'Prominence too low', {
      ratio: prominence.ratio.toFixed(2),
      required: tuning.hero_minProminence,
    });
    setRejection('Prominence too low', { ratio: +prominence.ratio.toFixed(2), required: tuning.hero_minProminence });
    return null;
  }
  
  // Validate hero-to-smallest ratio (prevent tiny content cells)
  const smallestCheck = validateSmallestCellRatio(heroArea, contentAreas, tuning);
  
  if (!smallestCheck.valid) {
    const rejectedCells = computeRejectedCells();
    // Include smallest 3 areas for debugging
    const sortedAreas = contentAreas.sort((a, b) => a - b);
    const smallestAreas = sortedAreas.slice(0, 3).map(a => +a.toFixed(4));
    setRejectedLayout({
      cells: rejectedCells,
      canvasWidth,
      canvasHeight,
      reason: 'hero_too_large_vs_smallest_cells',
      details: { 
        ratio: +smallestCheck.ratio.toFixed(1), 
        maxAllowed: tuning.hero_maxToSmallest,
        heroArea: +heroArea.toFixed(3),
        smallestAreas,
      },
      timestamp: Date.now(),
    });
    devLogger.warn('layout-reject', 'Hero too large vs smallest cells', {
      ratio: smallestCheck.ratio.toFixed(1),
      maxAllowed: tuning.hero_maxToSmallest,
    });
    setRejection('Hero too large vs smallest cells', { ratio: +smallestCheck.ratio.toFixed(1), maxAllowed: tuning.hero_maxToSmallest });
    return null;
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
): ScoredConfiguration | null {
  if (photos.length === 0) {
    return null;
  }
  
  // Determine row count using geometry-aware calculation (enforces both min and max AR)
  const rowCount = calculateBelowRowCount(
    photos, 
    1.0, 
    normalizedGap, 
    0,     // No hero
    tuning
  );
  
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
  
  // Validate canvas AR bounds
  if (canvasAR < tuning.canvas_minAR || canvasAR > tuning.canvas_maxAR) {
    // Capture rejected layout for visualization
    setRejectedLayout({
      cells,
      canvasWidth,
      canvasHeight,
      reason: canvasAR < tuning.canvas_minAR ? 'canvas_too_tall' : 'canvas_too_wide',
      details: { 
        canvasAR: +canvasAR.toFixed(2), 
        minAR: tuning.canvas_minAR,
        maxAR: tuning.canvas_maxAR,
      },
      timestamp: Date.now(),
    });
    
    devLogger.log('layout', 'Simple rows layout outside AR bounds', {
      canvasAR: canvasAR.toFixed(2),
      minAR: tuning.canvas_minAR,
      maxAR: tuning.canvas_maxAR,
    });
    return null;
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
  };
}
