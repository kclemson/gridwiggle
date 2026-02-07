/**
 * Constraint Intersection Engine
 * 
 * Orchestrates the normalized space layout algorithm:
 * 1. Hero proposes positions (normalized)
 * 2. Find best BESIDE/BELOW split
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
import { findBestSplit } from './split-search';
import { calculateContentStats } from './utils';
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
  canvasWidth: number,
  normalizedGap: number,  // Already in normalized space (0-0.04)
  tuning: V3Tuning = DEFAULT_V3_TUNING,
  randomize: boolean = false
): ScoredConfiguration | null {
  // Find hero and content photos
  const heroPhoto = findHeroPhoto(photos);
  const contentPhotos = getContentPhotos(photos);
  
  // If no hero, generate simple rows layout
  if (!heroPhoto) {
    return generateSimpleRowsLayout(photos, canvasWidth, normalizedGap, tuning);
  }
  
  // Get content statistics
  const contentStats = calculateContentStats(contentPhotos);
  
  // Generate hero position proposals in normalized space
  const proposals = proposePositions(heroPhoto, contentStats, tuning);
  
  devLogger.log('v3', 'Normalized proposals generated', {
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
      canvasWidth,
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
    devLogger.log('v3', 'No valid configurations found');
    return null;
  }
  
  // Sort by score and return best
  validConfigs.sort((a, b) => b.score - a.score);
  
  devLogger.log('v3', 'Best configuration selected', {
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
  canvasWidth: number,
  normalizedGap: number,  // Already in normalized space (0-0.04)
  tuning: V3Tuning,
  randomize: boolean
): ScoredConfiguration | null {
  const heroAR = heroPhoto.aspectRatio;
  
  devLogger.log('v3', 'Evaluating normalized proposal', {
    mode: proposal.mode,
    position: proposal.position,
    heroAR: heroAR.toFixed(2),
    normalizedGap: normalizedGap.toFixed(3),
  });
  
  // Edge and floating modes not yet implemented - use corner decomposition
  if (proposal.mode !== 'corner') {
    devLogger.log('v3', 'Mode not implemented, skipping', { mode: proposal.mode });
    return null;
  }
  
  // Find best BESIDE/BELOW split
  const splitResult = findBestSplit(
    contentPhotos,
    heroAR,
    normalizedGap,
    tuning,
    randomize
  );
  
  if (!splitResult) {
    devLogger.log('v3', 'No valid split found for proposal', {
      mode: proposal.mode,
      position: proposal.position,
    });
    return null;
  }
  
  // Handle "no BESIDE" vs "with BESIDE" cases
  let besideResult: { cells: { photoId: string; x: number; y: number; width: number; height: number }[]; width: number; height: number };
  let heroRowWidth: number;
  
  if (splitResult.besidePhotos.length === 0) {
    // No BESIDE region - hero takes full width
    besideResult = { cells: [], width: 0, height: 1.0 };
    heroRowWidth = heroAR;
  } else {
    // Pack BESIDE at height = 1
    besideResult = packToFillHeight(
      splitResult.besidePhotos,
      1.0,
      normalizedGap,
      splitResult.besideRowCount,
      tuning,
      randomize
    );
    heroRowWidth = heroAR + normalizedGap + besideResult.width;
  }
  
  // Use the belowRowCount that was validated during split search
  const belowRowCount = splitResult.belowRowCount;
  
  // Pack BELOW at hero row width
  const belowResult = packToFillWidth(
    splitResult.belowPhotos,
    heroRowWidth,
    normalizedGap,
    belowRowCount,
    tuning,
    randomize
  );
  
  // Calculate total normalized canvas
  const normalizedWidth = heroRowWidth;
  const normalizedHeight = 1.0 + normalizedGap + belowResult.height;
  
  // ============================================================================
  // Bottom-Up: Derive scale factor from geometry
  // ============================================================================
  
  // Find minimum normalized cell dimensions (content cells only)
  const allNormalizedCells = [
    ...besideResult.cells,
    ...belowResult.cells,
  ];
  
  let minNormalizedCellWidth = Infinity;
  let minNormalizedCellHeight = Infinity;
  
  for (const cell of allNormalizedCells) {
    minNormalizedCellWidth = Math.min(minNormalizedCellWidth, cell.width);
    minNormalizedCellHeight = Math.min(minNormalizedCellHeight, cell.height);
  }
  
  // Calculate minimum scale factor for cell size constraints
  // pixelWidth = normalizedWidth × scale >= minCellWidth
  // → scale >= minCellWidth / normalizedWidth
  const scaleForWidth = allNormalizedCells.length > 0 
    ? tuning.region_minWidth / minNormalizedCellWidth 
    : 1;
  const scaleForHeight = allNormalizedCells.length > 0 
    ? tuning.region_minHeight / minNormalizedCellHeight 
    : 1;
  const minScale = Math.max(scaleForWidth, scaleForHeight);
  
  // Include border in normalized canvas dimensions
  const normalizedWidthWithBorder = normalizedWidth + 2 * normalizedGap;
  const normalizedHeightWithBorder = normalizedHeight + 2 * normalizedGap;
  
  // Use the larger of: minimum required scale, or preferred scale for target width
  const preferredScale = canvasWidth / normalizedWidthWithBorder;
  const scaleFactor = Math.max(minScale, preferredScale);
  
  // Derive actual canvas dimensions (includes border)
  const actualCanvasWidth = normalizedWidthWithBorder * scaleFactor;
  const actualCanvasHeight = normalizedHeightWithBorder * scaleFactor;
  
  devLogger.log('v3', 'Derived canvas dimensions', {
    normalizedWidth: normalizedWidth.toFixed(2),
    normalizedHeight: normalizedHeight.toFixed(2),
    withBorder: `${normalizedWidthWithBorder.toFixed(2)} x ${normalizedHeightWithBorder.toFixed(2)}`,
    minScale: minScale.toFixed(2),
    preferredScale: preferredScale.toFixed(2),
    scaleFactor: scaleFactor.toFixed(2),
    actualWidth: Math.round(actualCanvasWidth),
    actualHeight: Math.round(actualCanvasHeight),
  });
  
  // Convert all cells to pixels - gaps are already in normalized coords
  const pixelCells = convertToPixels(
    heroPhoto,
    proposal.position,
    heroAR,
    besideResult.cells,
    belowResult.cells,
    belowResult.height,
    scaleFactor,
    normalizedGap,
    normalizedWidth
  );
  
  // Calculate canvas AR for validation
  const canvasAR = actualCanvasWidth / actualCanvasHeight;
  
  // Validate canvas AR (with epsilon tolerance for floating-point precision)
  const AR_EPSILON = 0.01;
  if (canvasAR < tuning.canvas_minAR - AR_EPSILON) {
    devLogger.log('v3', 'Canvas too tall', {
      canvasAR: canvasAR.toFixed(2),
      minAR: tuning.canvas_minAR,
    });
    setRejection('Canvas too tall', { canvasAR: +canvasAR.toFixed(2), minAR: tuning.canvas_minAR });
    return null;
  }
  
  if (canvasAR > tuning.canvas_maxAR + AR_EPSILON) {
    devLogger.log('v3', 'Canvas too wide', {
      canvasAR: canvasAR.toFixed(2),
      maxAR: tuning.canvas_maxAR,
    });
    setRejection('Canvas too wide', { canvasAR: +canvasAR.toFixed(2), maxAR: tuning.canvas_maxAR });
    return null;
  }
  
  // Validate hero prominence
  const heroPixelArea = (heroAR * scaleFactor) * scaleFactor; // heroWidth × heroHeight in pixels
  const contentAreas = pixelCells.slice(1).map(c => c.width * c.height);
  const prominence = validateProminence(heroPixelArea, contentAreas, tuning);
  
  if (!prominence.valid) {
    devLogger.log('v3', 'Prominence too low', {
      ratio: prominence.ratio.toFixed(2),
      required: tuning.hero_minProminence,
    });
    setRejection('Prominence too low', { ratio: +prominence.ratio.toFixed(2), required: tuning.hero_minProminence });
    return null;
  }
  
  // Validate hero-to-smallest ratio (prevent tiny content cells)
  const smallestCheck = validateSmallestCellRatio(heroPixelArea, contentAreas, tuning);
  
  if (!smallestCheck.valid) {
    devLogger.log('v3', 'Hero too large vs smallest cells', {
      ratio: smallestCheck.ratio.toFixed(1),
      maxAllowed: tuning.hero_maxToSmallest,
    });
    setRejection('Hero too large vs smallest cells', { ratio: +smallestCheck.ratio.toFixed(1), maxAllowed: tuning.hero_maxToSmallest });
    return null;
  }
  
  // Cell sizes are now guaranteed valid by construction (we derived scale from them)
  
  // Score the configuration
  const score = scoreConfiguration(prominence.ratio, pixelCells, tuning, randomize);
  
  // Create legacy-format proposal for ScoredConfiguration compatibility
  const heroCell = pixelCells[0];
  const legacyProposal: HeroProposal = {
    rect: { x: heroCell.x, y: heroCell.y, width: heroCell.width, height: heroCell.height },
    mode: proposal.mode,
    position: proposal.position,
  };
  
  devLogger.log('v3', 'Proposal accepted', {
    mode: proposal.mode,
    position: proposal.position,
    prominenceRatio: prominence.ratio.toFixed(2),
    canvasAR: canvasAR.toFixed(2),
    score: score.toFixed(3),
  });
  
  return {
    proposal: legacyProposal,
    distribution: { 
      assignments: new Map([
        [0, splitResult.besidePhotos.map(p => p.id)],
        [1, splitResult.belowPhotos.map(p => p.id)],
      ]), 
      totalAssigned: contentPhotos.length 
    },
    cells: pixelCells,
    canvasHeight: actualCanvasHeight,
    canvasWidth: actualCanvasWidth,
    prominenceRatio: prominence.ratio,
    score,
  };
}

// ============================================================================
// Pixel Conversion
// ============================================================================

/**
 * Convert normalized cells to pixel cells.
 * Gaps are already included in normalized coordinates - just scale everything.
 */
function convertToPixels(
  heroPhoto: PhotoDimension,
  position: string,
  heroAR: number,
  besideCells: { photoId: string; x: number; y: number; width: number; height: number }[],
  belowCells: { photoId: string; x: number; y: number; width: number; height: number }[],
  belowHeight: number,
  scaleFactor: number,
  normalizedGap: number,
  normalizedWidth: number
): LayoutCell[] {
  const cells: LayoutCell[] = [];
  
  const heroNormalizedWidth = heroAR;
  const heroNormalizedHeight = 1.0;
  
  // Border offset - all cells shift by normalizedGap to create edge padding
  const borderOffset = normalizedGap * scaleFactor;
  
  // Determine position type
  const isBottom = position === 'bottom-left' || position === 'bottom-right';
  const isRight = position === 'top-right' || position === 'bottom-right' || position === 'right';
  
  // Hero X position (add border offset)
  const heroX = isRight 
    ? borderOffset + (normalizedWidth - heroNormalizedWidth) * scaleFactor 
    : borderOffset;
  
  // Hero Y position (flip for bottom corners) - gap is in normalized coords
  const heroY = isBottom 
    ? borderOffset + (belowHeight + normalizedGap) * scaleFactor 
    : borderOffset;
  
  cells.push({
    photoId: heroPhoto.id,
    x: heroX,
    y: heroY,
    width: heroNormalizedWidth * scaleFactor,
    height: heroNormalizedHeight * scaleFactor,
  });
  
  // BESIDE cells - offset based on hero position
  const besideOffsetX = isRight 
    ? borderOffset  // BESIDE is to the LEFT of hero
    : borderOffset + (heroNormalizedWidth + normalizedGap) * scaleFactor;  // RIGHT of hero
  
  // BESIDE Y offset (same row as hero)
  const besideOffsetY = isBottom 
    ? borderOffset + (belowHeight + normalizedGap) * scaleFactor 
    : borderOffset;
  
  for (const cell of besideCells) {
    const cellX = isRight 
      ? borderOffset + cell.x * scaleFactor  // LEFT of hero - add border + scale
      : besideOffsetX + cell.x * scaleFactor;  // RIGHT of hero
    cells.push({
      photoId: cell.photoId,
      x: cellX,
      y: besideOffsetY + cell.y * scaleFactor,
      width: cell.width * scaleFactor,
      height: cell.height * scaleFactor,
    });
  }
  
  // BELOW cells - full width, position depends on top/bottom
  const belowOffsetY = isBottom 
    ? borderOffset  // BELOW goes at top for bottom corners
    : borderOffset + (1.0 + normalizedGap) * scaleFactor;  // BELOW goes below hero row for top corners

  for (const cell of belowCells) {
    const cellY = isBottom 
      ? borderOffset + cell.y * scaleFactor  // BELOW at top - add border + scale
      : belowOffsetY + cell.y * scaleFactor;  // BELOW below hero
    cells.push({
      photoId: cell.photoId,
      x: borderOffset + cell.x * scaleFactor,
      y: cellY,
      width: cell.width * scaleFactor,
      height: cell.height * scaleFactor,
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

/**
 * Calculate coefficient of variation (std dev / mean).
 */
function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  if (avg === 0) return 0;
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance) / avg;
}

// ============================================================================
// Hero-less Layout Generation
// ============================================================================

/**
 * Generate a layout with no hero - all photos in rows.
 */
function generateSimpleRowsLayout(
  photos: PhotoDimension[],
  canvasWidth: number,
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
    tuning.canvas_minAR,
    tuning.canvas_maxAR
  );
  
  // Pack in normalized space (use width = 1.0 as reference)
  // Simple rows always use deterministic packing (no hero = no shuffle)
  const normalizedResult = packToFillWidth(photos, 1.0, normalizedGap, rowCount, tuning, false);
  
  // ============================================================================
  // Bottom-Up: Derive scale factor from geometry
  // ============================================================================
  
  // Find minimum normalized cell dimensions
  let minNormalizedCellWidth = Infinity;
  let minNormalizedCellHeight = Infinity;
  
  for (const cell of normalizedResult.cells) {
    minNormalizedCellWidth = Math.min(minNormalizedCellWidth, cell.width);
    minNormalizedCellHeight = Math.min(minNormalizedCellHeight, cell.height);
  }
  
  // Calculate minimum scale factor for cell size constraints
  const scaleForWidth = normalizedResult.cells.length > 0 
    ? tuning.region_minWidth / minNormalizedCellWidth 
    : 1;
  const scaleForHeight = normalizedResult.cells.length > 0 
    ? tuning.region_minHeight / minNormalizedCellHeight 
    : 1;
  const minScale = Math.max(scaleForWidth, scaleForHeight);
  
  // Include border in normalized canvas dimensions
  const normalizedWidthWithBorder = 1.0 + 2 * normalizedGap;
  const normalizedHeightWithBorder = normalizedResult.height + 2 * normalizedGap;
  
  // Use the larger of: minimum required scale, or preferred scale for target width
  const preferredScale = canvasWidth / normalizedWidthWithBorder;
  const scaleFactor = Math.max(minScale, preferredScale);
  
  // Derive actual canvas dimensions (includes border)
  const actualCanvasWidth = normalizedWidthWithBorder * scaleFactor;
  const actualCanvasHeight = normalizedHeightWithBorder * scaleFactor;
  
  // Border offset - all cells shift by normalizedGap to create edge padding
  const borderOffset = normalizedGap * scaleFactor;
  
  // Convert cells to pixels - offset by border, then scale
  const cells: LayoutCell[] = normalizedResult.cells.map(cell => ({
    photoId: cell.photoId,
    x: borderOffset + cell.x * scaleFactor,
    y: borderOffset + cell.y * scaleFactor,
    width: cell.width * scaleFactor,
    height: cell.height * scaleFactor,
  }));
  
  devLogger.log('v3', 'Simple rows: derived canvas dimensions', {
    normalizedHeight: normalizedResult.height.toFixed(2),
    withBorder: `${normalizedWidthWithBorder.toFixed(2)} x ${normalizedHeightWithBorder.toFixed(2)}`,
    minScale: minScale.toFixed(2),
    scaleFactor: scaleFactor.toFixed(2),
    actualWidth: Math.round(actualCanvasWidth),
    actualHeight: Math.round(actualCanvasHeight),
  });
  
  const canvasAR = actualCanvasWidth / actualCanvasHeight;
  
  // Validate canvas AR bounds
  if (canvasAR < tuning.canvas_minAR || canvasAR > tuning.canvas_maxAR) {
    devLogger.log('v3', 'Simple rows layout outside AR bounds', {
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
  
  // Score based on area uniformity
  const areas = cells.map(c => c.width * c.height);
  const areaUniformity = 1 / (1 + coefficientOfVariation(areas));
  
  return {
    proposal: dummyProposal,
    distribution: { assignments: new Map([[0, photos.map(p => p.id)]]), totalAssigned: photos.length },
    cells,
    canvasHeight: actualCanvasHeight,
    canvasWidth: actualCanvasWidth,
    prominenceRatio: 1,
    score: areaUniformity,
  };
}
