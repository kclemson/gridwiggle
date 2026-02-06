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
import { proposePositions, validateProminence, findHeroPhoto, getContentPhotos } from './entities/hero';
import { devLogger } from '@/lib/devLogger';

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
  gap: number,
  tuning: V3Tuning = DEFAULT_V3_TUNING
): ScoredConfiguration | null {
  // Find hero and content photos
  const heroPhoto = findHeroPhoto(photos);
  const contentPhotos = getContentPhotos(photos);
  
  // If no hero, generate simple rows layout
  if (!heroPhoto) {
    return generateSimpleRowsLayout(photos, canvasWidth, gap, tuning);
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
      gap,
      tuning
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
  gap: number,
  tuning: V3Tuning
): ScoredConfiguration | null {
  const heroAR = heroPhoto.aspectRatio;
  
  // Calculate normalized gap (as fraction of hero height)
  // We'll refine this after we know the scale factor
  const estimatedNormalizedGap = 0.02; // ~2% of hero height
  
  devLogger.log('v3', 'Evaluating normalized proposal', {
    mode: proposal.mode,
    position: proposal.position,
    heroAR: heroAR.toFixed(2),
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
    estimatedNormalizedGap,
    tuning
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
      estimatedNormalizedGap,
      splitResult.besideRowCount
    );
    heroRowWidth = heroAR + estimatedNormalizedGap + besideResult.width;
  }
  
  // Use the belowRowCount that was validated during split search
  const belowRowCount = splitResult.belowRowCount;
  
  // Pack BELOW at hero row width
  const belowResult = packToFillWidth(
    splitResult.belowPhotos,
    heroRowWidth,
    estimatedNormalizedGap,
    belowRowCount
  );
  
  // Calculate total normalized canvas
  const normalizedWidth = heroRowWidth;
  const normalizedHeight = 1.0 + estimatedNormalizedGap + belowResult.height;
  
  // Calculate scale factor to convert to pixels
  const scaleFactor = canvasWidth / normalizedWidth;
  const pixelGap = gap; // Use actual pixel gap
  
  // Recalculate with correct normalized gap
  const correctedNormalizedGap = pixelGap / scaleFactor;
  
  // If gap correction is significant, repack (for now, accept small error)
  // This could be iterative for higher precision
  
  // Convert all cells to pixels
  const pixelCells = convertToPixels(
    heroPhoto,
    proposal.position,
    heroAR,
    besideResult.cells,
    belowResult.cells,
    scaleFactor,
    pixelGap,
    normalizedWidth
  );
  
  // Calculate actual canvas dimensions
  const canvasHeight = normalizedHeight * scaleFactor;
  const canvasAR = canvasWidth / canvasHeight;
  
  // Validate canvas AR
  if (canvasAR < tuning.canvas_minAR) {
    devLogger.log('v3', 'Canvas too tall', {
      canvasAR: canvasAR.toFixed(2),
      minAR: tuning.canvas_minAR,
    });
    return null;
  }
  
  if (canvasAR > tuning.canvas_maxAR) {
    devLogger.log('v3', 'Canvas too wide', {
      canvasAR: canvasAR.toFixed(2),
      maxAR: tuning.canvas_maxAR,
    });
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
    return null;
  }
  
  // Validate minimum cell sizes
  const minCellSize = Math.min(tuning.region_minWidth, tuning.region_minHeight);
  const hasSmallCells = pixelCells.some(c => 
    c.width < minCellSize || c.height < minCellSize
  );
  
  if (hasSmallCells) {
    devLogger.log('v3', 'Cells too small', { minCellSize });
    return null;
  }
  
  // Score the configuration
  const score = scoreConfiguration(prominence.ratio, pixelCells, tuning);
  
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
    canvasHeight,
    prominenceRatio: prominence.ratio,
    score,
  };
}

// ============================================================================
// Pixel Conversion
// ============================================================================

/**
 * Convert normalized cells to pixel cells.
 */
function convertToPixels(
  heroPhoto: PhotoDimension,
  position: string,
  heroAR: number,
  besideCells: { photoId: string; x: number; y: number; width: number; height: number }[],
  belowCells: { photoId: string; x: number; y: number; width: number; height: number }[],
  scaleFactor: number,
  gap: number,
  normalizedWidth: number
): LayoutCell[] {
  const cells: LayoutCell[] = [];
  
  // Hero cell
  const heroNormalizedWidth = heroAR;
  const heroNormalizedHeight = 1.0;
  
  let heroX: number;
  if (position === 'top-right' || position === 'right') {
    // Hero on right side
    heroX = (normalizedWidth - heroNormalizedWidth) * scaleFactor;
  } else {
    // Hero on left side (default)
    heroX = 0;
  }
  
  cells.push({
    photoId: heroPhoto.id,
    x: heroX,
    y: 0,
    width: heroNormalizedWidth * scaleFactor,
    height: heroNormalizedHeight * scaleFactor,
  });
  
  // BESIDE cells - offset based on hero position
  const besideNormalizedGap = gap / scaleFactor;
  let besideOffsetX: number;
  
  if (position === 'top-right' || position === 'right') {
    // BESIDE is to the LEFT of hero
    besideOffsetX = 0;
  } else {
    // BESIDE is to the RIGHT of hero
    besideOffsetX = heroNormalizedWidth + besideNormalizedGap;
  }
  
  for (const cell of besideCells) {
    cells.push({
      photoId: cell.photoId,
      x: (besideOffsetX + cell.x) * scaleFactor,
      y: cell.y * scaleFactor,
      width: cell.width * scaleFactor,
      height: cell.height * scaleFactor,
    });
  }
  
  // BELOW cells - full width, offset below hero row
  const belowOffsetY = 1.0 + besideNormalizedGap;
  
  for (const cell of belowCells) {
    cells.push({
      photoId: cell.photoId,
      x: cell.x * scaleFactor,
      y: (belowOffsetY + cell.y) * scaleFactor,
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
  tuning: V3Tuning
): number {
  // Base score from prominence (higher prominence = better)
  const prominenceScore = prominenceRatio / tuning.hero_targetProminence;
  
  // Cell area uniformity (lower variance = better)
  const areas = cells.slice(1).map(c => c.width * c.height); // Exclude hero
  const areaUniformity = areas.length > 1 ? 1 / (1 + coefficientOfVariation(areas)) : 1;
  
  return (prominenceScore * 0.6) + (areaUniformity * 0.4);
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
  gap: number,
  tuning: V3Tuning
): ScoredConfiguration | null {
  if (photos.length === 0) {
    return null;
  }
  
  // Calculate normalized gap
  const estimatedHeight = canvasWidth; // Rough estimate
  const normalizedGap = gap / estimatedHeight;
  
  // Determine row count using geometry-aware calculation (enforces both min and max AR)
  const rowCount = calculateBelowRowCount(
    photos, 
    1.0, 
    normalizedGap, 
    tuning.canvas_minAR,
    tuning.canvas_maxAR
  );
  
  // Pack in normalized space (use width = 1.0 as reference)
  const normalizedResult = packToFillWidth(photos, 1.0, normalizedGap, rowCount);
  
  // Scale to canvas width
  const scaleFactor = canvasWidth;
  
  const cells: LayoutCell[] = normalizedResult.cells.map(cell => ({
    photoId: cell.photoId,
    x: cell.x * scaleFactor,
    y: cell.y * scaleFactor,
    width: cell.width * scaleFactor,
    height: cell.height * scaleFactor,
  }));
  
  const canvasHeight = normalizedResult.height * scaleFactor;
  const canvasAR = canvasWidth / canvasHeight;
  
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
    canvasHeight,
    prominenceRatio: 1,
    score: areaUniformity,
  };
}
