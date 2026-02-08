/**
 * Region Search
 *
 * Finds valid distributions of photos across content regions.
 * Uses normalized space packing to evaluate candidate assignments.
 */

import { PhotoDimension, RegionAssignment, V3Tuning, LayoutCell } from './types';
import { packToFillHeight, packToFillWidth, calculateRowCountRange, calculateBelowRowCount } from './normalized-pack';
import { devLogger } from '@/lib/devLogger';
import { shuffleArray, coefficientOfVariation, getEffectiveMinProminence, getEffectiveCanvasMinAR, getEffectiveCanvasMaxAR, stratifiedARDistribution } from './utils';
import { canMeetProminenceConstraints, canBesideCountMeetCanvasAR, calculateBesideCountRange } from './feasibility';

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
 * Always contains an assignment (fallback used if no valid found).
 */
export interface RegionSearchResult {
  assignment: RegionAssignment;
  lastRejectedPack?: RejectedPack;
}

// ============================================================================
// Weighted Random Selection
// ============================================================================

/**
 * Select a candidate using score-weighted random selection.
 * Higher-scoring candidates have higher probability of being selected.
 * 
 * Uses squared normalized scores to emphasize quality differences,
 * with a floor constant to ensure all candidates have non-zero probability.
 */
function weightedRandomSelect<T extends { score: number }>(candidates: T[]): T {
  if (candidates.length === 1) return candidates[0];
  
  // Extract scores and compute range
  const scores = candidates.map(c => c.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore || 1; // Avoid division by zero
  
  // Compute weights: squared normalized score + floor constant
  const weights = scores.map(s => {
    const normalized = (s - minScore) / range;
    return Math.pow(normalized, 2) + 0.1; // 0.1 floor ensures non-zero probability
  });
  
  // Build cumulative distribution
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let cumulative = 0;
  const cumulativeWeights = weights.map(w => {
    cumulative += w / totalWeight;
    return cumulative;
  });
  
  // Sample from distribution
  const r = Math.random();
  const selectedIndex = cumulativeWeights.findIndex(cp => r <= cp);
  return candidates[selectedIndex >= 0 ? selectedIndex : candidates.length - 1];
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
    // Edge case: no content photos - return empty assignment
    return { 
      assignment: {
        besidePhotos: [],
        belowPhotos: [],
        besideRowCount: 0,
        belowRowCount: 0,
        score: 0,
      }
    };
  }
  
  // Edge case: only 1 photo - must go to BELOW (BESIDE would leave BELOW empty)
  if (photos.length === 1) {
    return {
      assignment: {
        besidePhotos: [],
        belowPhotos: photos,
        besideRowCount: 0,
        belowRowCount: 1,
        score: 0.5, // Basic score
      }
    };
  }
  
  // Order photos: shuffle for variety OR sort by AR for determinism
  const orderedPhotos = randomize
    ? shuffleArray(photos)
    : [...photos].sort((a, b) => a.aspectRatio - b.aspectRatio);
  
  // Calculate avgContentAR once before the loop
  const avgContentAR = photos.reduce((s, p) => s + p.aspectRatio, 0) / photos.length;
  
  // Calculate geometrically valid besideCount range based on hero shape and photo count
  // This replaces the hardcoded 0–12 limit
  const { minBeside, maxBeside } = calculateBesideCountRange(
    heroAR, photos.length, avgContentAR, normalizedGap, tuning
  );
  
  // Collect all valid assignments instead of tracking best
  const validRegionAssignments: RegionAssignment[] = [];
  
  // Track last rejected pack for debugging when all packs fail
  let lastRejectedPack: RejectedPack | undefined;
  
  devLogger.log('region', 'Starting region assignment search', {
    photoCount: photos.length,
    heroAR: heroAR.toFixed(2),
    avgContentAR: avgContentAR.toFixed(2),
    searchRange: `${minBeside} to ${maxBeside} beside photos`,
    randomize,
  });
  
  for (let besideCount = minBeside; besideCount <= maxBeside; besideCount++) {
    // Distribute using AR-stratified sampling (proportional from each AR bucket)
    const [besidePhotos, belowPhotos] = stratifiedARDistribution(
      orderedPhotos,
      besideCount,
      randomize
    );
    
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
        photos.length,
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
      const belowRowResult = calculateBelowRowCount(
        belowPhotos, 
        heroRowWidth, 
        normalizedGap,
        heroAR,
        tuning,
        randomize
      );
      const belowRowCount = belowRowResult.value;
      const belowRowRange = `${belowRowResult.minRows}-${belowRowResult.maxRows}`;
      
      // Pack BELOW
      const belowResult = packToFillWidth(belowPhotos, heroRowWidth, normalizedGap, belowRowCount, tuning, randomize);
      
      if (belowResult.cells.length === 0) continue;
      
      // Validate canvas AR (include border to match final validation)
      const totalHeight = 1.0 + normalizedGap + belowResult.height;
      const normalizedWidthWithBorder = heroRowWidth + 2 * normalizedGap;
      const normalizedHeightWithBorder = totalHeight + 2 * normalizedGap;
      const canvasAR = normalizedWidthWithBorder / normalizedHeightWithBorder;
      
      // Get effective canvas AR bounds (relaxed for low photo counts)
      const effectiveMinARNoBeside = getEffectiveCanvasMinAR(photos.length, tuning);
      const effectiveMaxARNoBeside = getEffectiveCanvasMaxAR(photos.length, tuning);
      
      // Canvas AR check - soft rejection (layout is valid, just outside aesthetic bounds)
      let softRejectionNoBeside: { reason: string; details: Record<string, unknown> } | undefined;
      const AR_EPSILON = 0.01;
      
      if (canvasAR < effectiveMinARNoBeside - AR_EPSILON) {
        softRejectionNoBeside = {
          reason: 'canvas_too_tall',
          details: { 
            canvasAR: +canvasAR.toFixed(2), 
            allowed: `${effectiveMinARNoBeside.toFixed(2)} - ${effectiveMaxARNoBeside.toFixed(2)}`,
            besideCount: 0,
            besideRowCount: 0,
            belowRowCount,
            belowConstraints: belowRowResult.constraints,
            heroAR: +heroAR.toFixed(2),
          },
        };
        devLogger.warn('region', 'Canvas AR below minimum - soft rejection (no BESIDE)', {
          besideCount: 0,
          canvasAR: canvasAR.toFixed(2),
          allowed: `${effectiveMinARNoBeside.toFixed(2)} - ${effectiveMaxARNoBeside.toFixed(2)}`,
        });
        // Continue processing - don't skip
      } else if (canvasAR > effectiveMaxARNoBeside + AR_EPSILON) {
        softRejectionNoBeside = {
          reason: 'canvas_too_wide',
          details: { 
            canvasAR: +canvasAR.toFixed(2), 
            allowed: `${effectiveMinARNoBeside.toFixed(2)} - ${effectiveMaxARNoBeside.toFixed(2)}`,
            besideCount: 0,
            besideRowCount: 0,
            belowRowCount,
            belowConstraints: belowRowResult.constraints,
            heroAR: +heroAR.toFixed(2),
          },
        };
        devLogger.warn('region', 'Canvas AR above maximum - soft rejection (no BESIDE)', {
          besideCount: 0,
          canvasAR: canvasAR.toFixed(2),
          allowed: `${effectiveMinARNoBeside.toFixed(2)} - ${effectiveMaxARNoBeside.toFixed(2)}`,
        });
        // Continue processing - don't skip
      }
      
      // Per-row prominence: with 0 beside, hero has no row competition
      // Prominence auto-passes (no photos in hero row to compete with)
      // This aligns with the per-row model used in intersection.ts
      devLogger.log('region', 'Per-row prominence auto-pass (no BESIDE)', {
        besideCount: 0,
        belowCount: belowPhotos.length,
      });
      
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
        softRejection: softRejectionNoBeside?.reason,
      });
      
      validRegionAssignments.push({
        besidePhotos: [],
        belowPhotos,
        besideRowCount: 0,
        belowRowCount,
        score,
        softRejection: softRejectionNoBeside,
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
      const belowRowResult = calculateBelowRowCount(
        belowPhotos, 
        heroRowWidth, 
        normalizedGap,
        heroAR,
        tuning,
        randomize
      );
      const belowRowCount = belowRowResult.value;
      const belowRowRange = `${belowRowResult.minRows}-${belowRowResult.maxRows}`;
      
      // Pack BELOW at derived width
      const belowResult = packToFillWidth(belowPhotos, heroRowWidth, normalizedGap, belowRowCount, tuning, randomize);
      
      if (belowPhotos.length > 0 && belowResult.cells.length === 0) continue;
      
      // Validate canvas AR (include border to match final validation)
      const totalHeight = 1.0 + normalizedGap + belowResult.height;
      const normalizedWidthWithBorder = heroRowWidth + 2 * normalizedGap;
      const normalizedHeightWithBorder = totalHeight + 2 * normalizedGap;
      const canvasAR = normalizedWidthWithBorder / normalizedHeightWithBorder;
      
      // Get effective canvas AR bounds (relaxed for low photo counts)
      const effectiveMinAR = getEffectiveCanvasMinAR(photos.length, tuning);
      const effectiveMaxAR = getEffectiveCanvasMaxAR(photos.length, tuning);
      
      // Canvas AR check - soft rejection (layout is valid, just outside aesthetic bounds)
      let softRejection: { reason: string; details: Record<string, unknown> } | undefined;
      const AR_EPSILON = 0.01;
      
      if (canvasAR < effectiveMinAR - AR_EPSILON) {
        softRejection = {
          reason: 'canvas_too_tall',
          details: { 
            canvasAR: +canvasAR.toFixed(2), 
            allowed: `${effectiveMinAR.toFixed(2)} - ${effectiveMaxAR.toFixed(2)}`,
            besideCount,
            besideRowCount,
            belowRowCount,
            belowConstraints: belowRowResult.constraints,
            heroAR: +heroAR.toFixed(2),
          },
        };
        devLogger.warn('region', 'Canvas AR below minimum - soft rejection', {
          besideCount,
          besideRowCount,
          canvasAR: canvasAR.toFixed(2),
          allowed: `${effectiveMinAR.toFixed(2)} - ${effectiveMaxAR.toFixed(2)}`,
        });
        // Continue processing - don't skip
      } else if (canvasAR > effectiveMaxAR + AR_EPSILON) {
        softRejection = {
          reason: 'canvas_too_wide',
          details: { 
            canvasAR: +canvasAR.toFixed(2), 
            allowed: `${effectiveMinAR.toFixed(2)} - ${effectiveMaxAR.toFixed(2)}`,
            besideCount,
            besideRowCount,
            belowRowCount,
            belowConstraints: belowRowResult.constraints,
            heroAR: +heroAR.toFixed(2),
          },
        };
        devLogger.warn('region', 'Canvas AR above maximum - soft rejection', {
          besideCount,
          besideRowCount,
          canvasAR: canvasAR.toFixed(2),
          allowed: `${effectiveMinAR.toFixed(2)} - ${effectiveMaxAR.toFixed(2)}`,
        });
        // Continue processing - don't skip
      }
      
      // Per-row prominence: hero competes only with beside region (its row)
      // This aligns with the per-row model used in intersection.ts
      const besideAreas = besideResult.cells.map(c => c.width * c.height);
      const heroArea = heroAR * 1.0;
      const maxBesideArea = Math.max(...besideAreas, 0);
      const prominenceRatio = maxBesideArea > 0 ? heroArea / maxBesideArea : Infinity;
      
      // Get effective prominence threshold (lower for small photo counts)
      const effectiveMinProminence = getEffectiveMinProminence(besidePhotos.length, tuning);
      
      devLogger.log('region', 'Per-row prominence check (with BESIDE)', {
        heroArea: +heroArea.toFixed(3),
        besideCount: besidePhotos.length,
        maxBesideArea: +maxBesideArea.toFixed(3),
        prominenceRatio: +prominenceRatio.toFixed(2),
        threshold: effectiveMinProminence,
      });
      
      if (prominenceRatio < effectiveMinProminence) {
        // Capture rejected pack for visualization
        lastRejectedPack = {
          cells: buildRejectedCells(heroAR, heroPhotoId, besideResult, belowResult, normalizedGap),
          canvasWidth: normalizedWidthWithBorder,
          canvasHeight: normalizedHeightWithBorder,
          reason: 'prominence_too_low',
          details: { prominenceRatio: +prominenceRatio.toFixed(2), required: effectiveMinProminence, besideCount: `${besideCount} (${minBeside}-${maxBeside})`, besideRowCount: `${besideResult.rowCount} (${minRows}-${maxRows})`, belowRowCount: `${belowRowCount} (${belowRowRange})`, belowConstraints: belowRowResult.constraints, heroAR: +heroAR.toFixed(2), canvasAR: +canvasAR.toFixed(2) },
        };
        devLogger.warn('region-reject', 'Prominence too low (per-row)', {
          besideCount,
          besideRowCount,
          prominenceRatio: prominenceRatio.toFixed(2),
          required: effectiveMinProminence,
        }, {
          cells: lastRejectedPack.cells,
          canvasWidth: lastRejectedPack.canvasWidth,
          canvasHeight: lastRejectedPack.canvasHeight,
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
        softRejection: softRejection?.reason,
      });
      
      validRegionAssignments.push({
        besidePhotos,
        belowPhotos,
        besideRowCount,
        belowRowCount,
        score,
        softRejection,
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
    // Pick using weighted random for variety OR pick best score for determinism
    const selected = randomize
      ? weightedRandomSelect(validRegionAssignments)
      : validRegionAssignments.reduce((best, current) => current.score > best.score ? current : best);
    
    devLogger.log('region', `Assignment selected ${randomize ? 'by weighted random' : 'by best score'}`, {
      totalCandidates: validRegionAssignments.length,
      besideCount: selected.besidePhotos.length,
      belowCount: selected.belowPhotos.length,
      besideRowCount: selected.besideRowCount,
      score: selected.score.toFixed(3),
    });
    return { assignment: selected };
  }
  
  // Fallback: if no valid assignments, create one with all photos in BELOW
  // This ensures we always return a layout
  devLogger.warn('region-reject', 'No valid assignment found, using fallback (all BELOW)', {
    photoCount: photos.length,
    heroAR: heroAR.toFixed(2),
    hasLastRejected: lastRejectedPack !== undefined,
  }, lastRejectedPack ? {
    cells: lastRejectedPack.cells,
    canvasWidth: lastRejectedPack.canvasWidth,
    canvasHeight: lastRejectedPack.canvasHeight,
  } : undefined);
  
  // Pack all photos below hero
  const fallbackRowResult = calculateBelowRowCount(
    orderedPhotos, 
    heroAR, // Hero row width = just hero
    normalizedGap,
    heroAR,
    tuning,
    false // Deterministic for fallback
  );
  
  return { 
    assignment: {
      besidePhotos: [],
      belowPhotos: orderedPhotos,
      besideRowCount: 0,
      belowRowCount: fallbackRowResult.value,
      score: 0.1, // Low score so valid assignments are preferred
      softRejection: { 
        reason: 'fallback_all_below', 
        details: { 
          photoCount: photos.length,
          heroAR: +heroAR.toFixed(2),
        } 
      },
    },
    lastRejectedPack,
  };
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
  const heroArea = heroAR * 1.0;
  const maxContentArea = Math.max(...allAreas, 0);
  const prominenceRatio = maxContentArea > 0 ? heroArea / maxContentArea : Infinity;
  const prominenceScore = prominenceRatio >= tuning.hero_minProminence 
    ? 1.0 
    : prominenceRatio / tuning.hero_minProminence;
  
  // Region parity score: reward balanced average cell areas between regions
  // This prevents huge cells in BELOW when it has too few photos
  let parityScore = 1.0;
  
  if (besideResult.cells.length > 0 && belowResult.cells.length > 0) {
    const avgBesideArea = besideResult.cells
      .reduce((sum, c) => sum + c.width * c.height, 0) / besideResult.cells.length;
    const avgBelowArea = belowResult.cells
      .reduce((sum, c) => sum + c.width * c.height, 0) / belowResult.cells.length;
    
    // Ratio clamped to [0, 1] - 1.0 means perfect parity
    const ratio = avgBesideArea / avgBelowArea;
    parityScore = Math.min(ratio, 1 / ratio);
  }
  
  // Combined score with balanced weights
  return (uniformityScore * 0.35) + (prominenceScore * 0.35) + (parityScore * 0.30);
}

