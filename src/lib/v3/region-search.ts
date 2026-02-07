/**
 * Region Search
 *
 * Finds valid distributions of photos across content regions.
 * Uses normalized space packing to evaluate candidate assignments.
 */

import { PhotoDimension, RegionAssignment, V3Tuning, LayoutCell } from './types';
import { packToFillHeight, packToFillWidth, calculateRowCountRange, calculateBelowRowCount } from './normalized-pack';
import { devLogger } from '@/lib/devLogger';
import { shuffleArray, coefficientOfVariation } from './utils';
import { canMeetProminenceConstraints, canBesideCountMeetCanvasAR } from './feasibility';

// ============================================================================
// Rejected Pack Type (for capturing last rejected layout)
// ============================================================================

/**
 * Captured state of a rejected pack for debugging visualization.
 * Only populated when packing was attempted but validation failed.
 */
export interface RejectedPack {
  cells: LayoutCell[];
  canvasWidth: number;
  canvasHeight: number;
  reason: string;
  details: Record<string, unknown>;
}

/**
 * Result of region assignment search.
 * Includes optional lastRejectedPack when no valid assignment found but packing was attempted.
 */
export interface RegionSearchResult {
  assignment: RegionAssignment | null;
  lastRejectedPack?: RejectedPack;
}

// ============================================================================
// Region Search Algorithm
// ============================================================================

/**
 * Find a valid region assignment for photos.
 * 
 * Strategy:
 * 1. Sort photos by AR (narrower photos pack taller → better for BESIDE)
 * 2. Try different beside counts (0 to min(12, n))
 * 3. For each assignment, try different row counts for BESIDE
 * 4. Score by layout balance and uniformity
 * 5. Return a valid assignment (random or best)
 * 
 * @param photos - Content photos (excluding hero)
 * @param heroAR - Hero aspect ratio (hero width in normalized space)
 * @param normalizedGap - Gap as fraction of hero height
 * @param tuning - Tuning parameters
 * @returns Valid region assignment, or null if none found
 */
export function findValidRegionAssignment(
  photos: PhotoDimension[],
  heroAR: number,
  heroPhotoId: string,
  normalizedGap: number,
  tuning: V3Tuning,
  randomize: boolean = false
): RegionSearchResult {
  if (photos.length === 0) {
    return { assignment: null };
  }
  
  // Edge case: only 1 photo - must go to BELOW (BESIDE would leave BELOW empty)
  if (photos.length === 1) {
    return {
      assignment: {
        besidePhotos: [],
        belowPhotos: photos,
        besideRowCount: 0,
        belowRowCount: 1,
        score: 0,
      }
    };
  }
  
  // Order photos: shuffle for variety OR sort by AR for determinism
  const orderedPhotos = randomize
    ? shuffleArray(photos)
    : [...photos].sort((a, b) => a.aspectRatio - b.aspectRatio);
  
  // Search parameters - canvas AR constraint naturally limits valid assignments
  const minBesidePhotos = 0;  // Allow "hero at top, all below"
  const maxBesidePhotos = Math.min(photos.length, 12); // Reasonable upper bound for search
  
  // Collect all valid assignments instead of tracking best
  const validRegionAssignments: RegionAssignment[] = [];
  
  // Track last rejected pack for debugging when all packs fail
  let lastRejectedPack: RejectedPack | undefined;
  
  // Calculate avgContentAR once before the loop
  const avgContentAR = photos.reduce((s, p) => s + p.aspectRatio, 0) / photos.length;
  
  devLogger.log('region', 'Starting region assignment search', {
    photoCount: photos.length,
    heroAR: heroAR.toFixed(2),
    avgContentAR: avgContentAR.toFixed(2),
    searchRange: `${minBesidePhotos} to ${maxBesidePhotos} beside photos`,
    randomize,
  });
  
  for (let besideCount = minBesidePhotos; besideCount <= maxBesidePhotos; besideCount++) {
    // Slice from ordered array (shuffled or sorted)
    const besidePhotos = orderedPhotos.slice(0, besideCount);
    const belowPhotos = orderedPhotos.slice(besideCount);
    
    // Early feasibility checks for beside configurations
    if (besideCount > 0) {
      // Canvas AR feasibility check at besideCount level (now accounts for BELOW height)
      const canvasARFeasibility = canBesideCountMeetCanvasAR(
        heroAR, besidePhotos, photos.length, avgContentAR, normalizedGap, tuning
      );
      if (!canvasARFeasibility.feasible) {
        continue; // Skip entire besideCount — no row config can work
      }
      
      const avgBesideAR = besidePhotos.reduce((s, p) => s + p.aspectRatio, 0) / besideCount;
      
      // Check if ANY row count can satisfy both prominence constraints
      const prominenceFeasibility = canMeetProminenceConstraints(
        heroAR,
        besideCount,
        avgBesideAR,
        tuning
      );
      
      if (!prominenceFeasibility.feasible) {
        devLogger.log('region', 'Skipping besideCount (prominence constraints unsatisfiable)', {
          besideCount,
          validRowRange: `[${prominenceFeasibility.minRows}, ${prominenceFeasibility.maxRows}]`,
          reason: prominenceFeasibility.reason,
        });
        continue; // Skip entire besideCount iteration
      }
    }
    
    // Handle "no BESIDE" case (hero at top, all content below)
    if (besideCount === 0) {
      const heroRowWidth = heroAR; // Just the hero, no beside region
      
      // Calculate BELOW row count
      const belowRowCount = calculateBelowRowCount(
        belowPhotos, 
        heroRowWidth, 
        normalizedGap,
        heroAR,
        tuning
      );
      
      // Pack BELOW
      const belowResult = packToFillWidth(belowPhotos, heroRowWidth, normalizedGap, belowRowCount, tuning, randomize);
      
      if (belowResult.cells.length === 0) continue;
      
      // Validate canvas AR (include border to match final validation)
      const totalHeight = 1.0 + normalizedGap + belowResult.height;
      const normalizedWidthWithBorder = heroRowWidth + 2 * normalizedGap;
      const normalizedHeightWithBorder = totalHeight + 2 * normalizedGap;
      const canvasAR = normalizedWidthWithBorder / normalizedHeightWithBorder;
      
      const AR_EPSILON = 0.01;
      if (canvasAR < tuning.canvas_minAR - AR_EPSILON || canvasAR > tuning.canvas_maxAR + AR_EPSILON) {
        // Capture rejected pack for visualization
        lastRejectedPack = {
          cells: buildRejectedCells(heroAR, heroPhotoId, null, belowResult, normalizedGap),
          canvasWidth: normalizedWidthWithBorder,
          canvasHeight: normalizedHeightWithBorder,
          reason: canvasAR < tuning.canvas_minAR ? 'canvas_too_tall' : 'canvas_too_wide',
          details: { canvasAR: +canvasAR.toFixed(2), besideCount: 0, belowRowCount },
        };
        devLogger.warn('region-reject', 'Canvas AR out of range (no BESIDE)', {
          besideCount: 0,
          canvasAR: canvasAR.toFixed(2),
          allowed: `${tuning.canvas_minAR.toFixed(2)} - ${tuning.canvas_maxAR.toFixed(2)}`,
        });
        continue;
      }
      
      // Check prominence before accepting this split
      const belowAreas = belowResult.cells.map(c => c.width * c.height);
      const heroAreaNoAside = heroAR * 1.0;
      const maxContentAreaNoAside = Math.max(...belowAreas, 0);
      const prominenceRatioNoAside = maxContentAreaNoAside > 0 ? heroAreaNoAside / maxContentAreaNoAside : Infinity;
      
      if (prominenceRatioNoAside < tuning.hero_minProminence) {
        // Capture rejected pack for visualization
        lastRejectedPack = {
          cells: buildRejectedCells(heroAR, heroPhotoId, null, belowResult, normalizedGap),
          canvasWidth: normalizedWidthWithBorder,
          canvasHeight: normalizedHeightWithBorder,
          reason: 'prominence_too_low',
          details: { prominenceRatio: +prominenceRatioNoAside.toFixed(2), required: tuning.hero_minProminence, besideCount: 0 },
        };
        devLogger.warn('region-reject', 'Prominence too low (no BESIDE)', {
          besideCount: 0,
          prominenceRatio: prominenceRatioNoAside.toFixed(2),
          required: tuning.hero_minProminence,
        });
        continue;
      }
      
      // Score this assignment (empty BESIDE result)
      const emptyBesideResult = { cells: [], width: 0, height: 1.0 };
      const score = scoreRegionAssignment(heroAR, emptyBesideResult, belowResult, normalizedGap, tuning);
      
      devLogger.log('region', 'Valid assignment candidate (no BESIDE)', {
        besideCount: 0,
        belowCount: belowPhotos.length,
        belowRowCount,
        belowHeight: belowResult.height.toFixed(2),
        canvasAR: canvasAR.toFixed(2),
        score: score.toFixed(3),
      });
      
      validRegionAssignments.push({
        besidePhotos: [],
        belowPhotos,
        besideRowCount: 0,
        belowRowCount,
        score,
      });
      continue;
    }
    
    // Try different row counts for BESIDE
    const [minRows, maxRows] = calculateRowCountRange(besidePhotos, 1.0, normalizedGap);
    
    for (let besideRowCount = minRows; besideRowCount <= maxRows; besideRowCount++) {
      // Pack BESIDE at height = 1
      const besideResult = packToFillHeight(besidePhotos, 1.0, normalizedGap, besideRowCount, tuning, randomize);
      
      if (besideResult.cells.length === 0) continue;
      
      // Calculate hero row width
      const heroRowWidth = heroAR + normalizedGap + besideResult.width;
      
      // Canvas AR validation (post-pack check, no logging — outer loop already filtered)
      const minCanvasHeight = 1.0 + 2 * normalizedGap;
      const canvasWidth = heroRowWidth + 2 * normalizedGap;
      const bestCaseAR = canvasWidth / minCanvasHeight;
      
      if (bestCaseAR > tuning.canvas_maxAR * 1.1) {
        continue; // Skip — canvas too wide
      }
      
      // Calculate optimal row count for BELOW (respecting both min and max AR)
      const belowRowCount = calculateBelowRowCount(
        belowPhotos, 
        heroRowWidth, 
        normalizedGap,
        heroAR,
        tuning
      );
      
      // Pack BELOW at derived width
      const belowResult = packToFillWidth(belowPhotos, heroRowWidth, normalizedGap, belowRowCount, tuning, randomize);
      
      if (belowPhotos.length > 0 && belowResult.cells.length === 0) continue;
      
      // Validate canvas AR (include border to match final validation)
      const totalHeight = 1.0 + normalizedGap + belowResult.height;
      const normalizedWidthWithBorder = heroRowWidth + 2 * normalizedGap;
      const normalizedHeightWithBorder = totalHeight + 2 * normalizedGap;
      const canvasAR = normalizedWidthWithBorder / normalizedHeightWithBorder;
      
      const AR_EPSILON = 0.01;
      if (canvasAR < tuning.canvas_minAR - AR_EPSILON || canvasAR > tuning.canvas_maxAR + AR_EPSILON) {
        // Capture rejected pack for visualization
        lastRejectedPack = {
          cells: buildRejectedCells(heroAR, heroPhotoId, besideResult, belowResult, normalizedGap),
          canvasWidth: normalizedWidthWithBorder,
          canvasHeight: normalizedHeightWithBorder,
          reason: canvasAR < tuning.canvas_minAR ? 'canvas_too_tall' : 'canvas_too_wide',
          details: { canvasAR: +canvasAR.toFixed(2), besideCount, besideRowCount, belowRowCount },
        };
        devLogger.warn('region-reject', 'Canvas AR out of range', {
          besideCount,
          besideRowCount,
          canvasAR: canvasAR.toFixed(2),
          allowed: `${tuning.canvas_minAR.toFixed(2)} - ${tuning.canvas_maxAR.toFixed(2)}`,
        });
        continue;
      }
      
      // Check prominence before accepting this split
      const allCellAreas = [
        ...besideResult.cells.map(c => c.width * c.height),
        ...belowResult.cells.map(c => c.width * c.height),
      ];
      const heroArea = heroAR * 1.0;
      const maxContentArea = Math.max(...allCellAreas, 0);
      const prominenceRatio = maxContentArea > 0 ? heroArea / maxContentArea : Infinity;
      
      if (prominenceRatio < tuning.hero_minProminence) {
        // Capture rejected pack for visualization
        lastRejectedPack = {
          cells: buildRejectedCells(heroAR, heroPhotoId, besideResult, belowResult, normalizedGap),
          canvasWidth: normalizedWidthWithBorder,
          canvasHeight: normalizedHeightWithBorder,
          reason: 'prominence_too_low',
          details: { prominenceRatio: +prominenceRatio.toFixed(2), required: tuning.hero_minProminence, besideCount, besideRowCount },
        };
        devLogger.warn('region-reject', 'Prominence too low', {
          besideCount,
          besideRowCount,
          prominenceRatio: prominenceRatio.toFixed(2),
          required: tuning.hero_minProminence,
        });
        continue;
      }
      
      // Score this assignment
      const score = scoreRegionAssignment(
        heroAR,
        besideResult,
        belowResult,
        normalizedGap,
        tuning
      );
      
      devLogger.log('region', 'Valid assignment candidate', {
        besideCount,
        besideRowCount,
        besideWidth: besideResult.width.toFixed(2),
        belowHeight: belowResult.height.toFixed(2),
        canvasAR: canvasAR.toFixed(2),
        prominenceRatio: prominenceRatio.toFixed(2),
        score: score.toFixed(3),
      });
      
      validRegionAssignments.push({
        besidePhotos,
        belowPhotos,
        besideRowCount,
        belowRowCount,
        score,
      });
      
      // Early exit for randomize mode - we don't need exhaustive search
      if (randomize && validRegionAssignments.length >= 8) {
        devLogger.log('region', 'Early exit (enough candidates for randomize)', {
          candidates: validRegionAssignments.length,
        });
        break;
      }
    }
    
    // Check if we should exit outer loop too
    if (randomize && validRegionAssignments.length >= 8) {
      break;
    }
  }
  
  if (validRegionAssignments.length > 0) {
    // Pick randomly for variety OR pick best score for determinism
    const selected = randomize
      ? validRegionAssignments[Math.floor(Math.random() * validRegionAssignments.length)]
      : validRegionAssignments.reduce((best, current) => current.score > best.score ? current : best);
    
    devLogger.log('region', `Assignment selected ${randomize ? 'randomly' : 'by best score'}`, {
      totalCandidates: validRegionAssignments.length,
      besideCount: selected.besidePhotos.length,
      belowCount: selected.belowPhotos.length,
      besideRowCount: selected.besideRowCount,
      score: selected.score.toFixed(3),
    });
    return { assignment: selected };
  }
  
  devLogger.warn('region-reject', 'No valid assignment found', {
    hasLastRejected: lastRejectedPack !== undefined,
  });
  return { assignment: null, lastRejectedPack };
}

// ============================================================================
// Helper: Build Rejected Cells
// ============================================================================

/**
 * Build cell array for rejected pack visualization.
 * Uses top-left hero position (simplest case for debugging).
 */
function buildRejectedCells(
  heroAR: number,
  heroPhotoId: string,
  besideResult: { cells: { photoId: string; x: number; y: number; width: number; height: number }[]; width: number; height: number } | null,
  belowResult: { cells: { photoId: string; x: number; y: number; width: number; height: number }[]; width: number; height: number },
  normalizedGap: number
): LayoutCell[] {
  const cells: LayoutCell[] = [];
  const borderOffset = normalizedGap;
  
  // Hero cell (top-left position)
  cells.push({
    photoId: heroPhotoId,
    x: borderOffset,
    y: borderOffset,
    width: heroAR,
    height: 1.0,
  });
  
  // BESIDE cells (right of hero)
  if (besideResult) {
    const besideOffsetX = borderOffset + heroAR + normalizedGap;
    for (const cell of besideResult.cells) {
      cells.push({
        photoId: cell.photoId,
        x: besideOffsetX + cell.x,
        y: borderOffset + cell.y,
        width: cell.width,
        height: cell.height,
      });
    }
  }
  
  // BELOW cells
  const belowOffsetY = borderOffset + 1.0 + normalizedGap;
  for (const cell of belowResult.cells) {
    cells.push({
      photoId: cell.photoId,
      x: borderOffset + cell.x,
      y: belowOffsetY + cell.y,
      width: cell.width,
      height: cell.height,
    });
  }
  
  return cells;
}

// ============================================================================
// Region Assignment Scoring
// ============================================================================

/**
 * Score a region assignment configuration.
 * Higher is better.
 * 
 * Criteria:
 * 1. Uniformity: cell areas should be similar
 * 2. Prominence: hero should be significantly larger than content cells
 */
function scoreRegionAssignment(
  heroAR: number,
  besideResult: { cells: { width: number; height: number }[]; width: number; height: number },
  belowResult: { cells: { width: number; height: number }[]; width: number; height: number },
  _normalizedGap: number,
  tuning: V3Tuning
): number {
  // Uniformity score: coefficient of variation of cell areas
  const allAreas = [
    ...besideResult.cells.map(c => c.width * c.height),
    ...belowResult.cells.map(c => c.width * c.height),
  ];
  const uniformityScore = 1.0 / (1.0 + coefficientOfVariation(allAreas));
  
  // Hero prominence check (soft constraint)
  // Hero area = heroAR * 1.0 (since height = 1)
  const heroArea = heroAR * 1.0;
  const maxContentArea = Math.max(...allAreas, 0);
  const prominenceRatio = maxContentArea > 0 ? heroArea / maxContentArea : Infinity;
  const prominenceScore = prominenceRatio >= tuning.hero_minProminence ? 1.0 : prominenceRatio / tuning.hero_minProminence;
  
  // Removed balanceScore - was pushing BELOW region to match hero height,
  // causing large cells that threatened prominence
  return (uniformityScore * 0.5) + (prominenceScore * 0.5);
}

