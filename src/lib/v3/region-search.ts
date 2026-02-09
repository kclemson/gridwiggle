/**
 * Region Search
 *
 * Finds valid distributions of photos across content regions.
 * Uses normalized space packing to evaluate candidate assignments.
 * 
 * SIMPLIFIED: Removed feasibility pre-checks (over-pruning), 
 * use raw tuning values instead of "effective" wrappers.
 */

import { PhotoDimension, RegionAssignment, V3Tuning, LayoutCell } from './types';
import { packToFillHeight, packToFillWidth, calculateRowCountRange, calculateBelowRowCount } from './normalized-pack';
import { devLogger } from '@/lib/devLogger';
import { shuffleArray, stratifiedARDistribution } from './utils';

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
  const range = maxScore - minScore || 1;
  
  // Compute weights: squared normalized score + floor constant
  const weights = scores.map(s => {
    const normalized = (s - minScore) / range;
    return Math.pow(normalized, 2) + 0.1;
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
// Simple BesideCount Range (replaced complex feasibility)
// ============================================================================

/**
 * Calculate simple besideCount range based on photo count.
 * SIMPLIFIED: No complex geometric feasibility checks.
 * Let packing and scoring determine what works.
 */
function calculateSimpleBesideRange(photoCount: number): { minBeside: number; maxBeside: number } {
  if (photoCount === 0) return { minBeside: 0, maxBeside: 0 };
  
  // Simple: 0 to min(photoCount, 12)
  // All configurations are explored, scoring handles quality
  return { 
    minBeside: 0, 
    maxBeside: Math.min(photoCount, 12) 
  };
}

// ============================================================================
// Region Search Algorithm
// ============================================================================

/**
 * Find a valid region assignment for photos.
 * 
 * SIMPLIFIED Strategy:
 * 1. Order photos (shuffle or sort by AR)
 * 2. Try different beside counts (0 to min(12, n))
 * 3. For each assignment, try different row counts for BESIDE
 * 4. Score by F-ratio tier coherence
 * 5. Return using weighted random selection
 * 
 * No early feasibility pruning - let packing + scoring determine quality.
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
  
  // Edge case: only 1 photo - must go to BELOW
  if (photos.length === 1) {
    return {
      assignment: {
        besidePhotos: [],
        belowPhotos: photos,
        besideRowCount: 0,
        belowRowCount: 1,
        score: 0.5,
      }
    };
  }
  
  // Order photos: shuffle for variety OR sort by AR for determinism
  const orderedPhotos = randomize
    ? shuffleArray(photos)
    : [...photos].sort((a, b) => a.aspectRatio - b.aspectRatio);
  
  // Simple besideCount range
  const { minBeside, maxBeside } = calculateSimpleBesideRange(photos.length);
  
  // Collect all valid assignments
  const validRegionAssignments: RegionAssignment[] = [];
  
  // Track last rejected pack for debugging
  let lastRejectedPack: RejectedPack | undefined;
  
  devLogger.log('region', 'Starting region assignment search', {
    photoCount: photos.length,
    heroAR: heroAR.toFixed(2),
    searchRange: `${minBeside} to ${maxBeside} beside photos`,
    randomize,
  });
  
  for (let besideCount = minBeside; besideCount <= maxBeside; besideCount++) {
    // Simple slice distribution
    const [besidePhotos, belowPhotos] = stratifiedARDistribution(
      orderedPhotos,
      besideCount,
      randomize
    );
    
    // Handle "no BESIDE" case (hero at top, all content below)
    if (besideCount === 0) {
      const heroRowWidth = heroAR;
      
      const belowRowResult = calculateBelowRowCount(
        belowPhotos, 
        heroRowWidth, 
        normalizedGap,
        heroAR,
        tuning,
        randomize
      );
      const belowRowCount = belowRowResult.value;
      
      const belowResult = packToFillWidth(belowPhotos, heroRowWidth, normalizedGap, belowRowCount, tuning, randomize);
      
      if (belowResult.cells.length === 0) continue;
      
      // Validate canvas AR
      const totalHeight = 1.0 + normalizedGap + belowResult.height;
      const normalizedWidthWithBorder = heroRowWidth + 2 * normalizedGap;
      const normalizedHeightWithBorder = totalHeight + 2 * normalizedGap;
      const canvasAR = normalizedWidthWithBorder / normalizedHeightWithBorder;
      
      // Hard rejection for AR bounds (symmetric enforcement)
      const AR_EPSILON = 0.01;
      
      if (canvasAR < tuning.canvas_minAR - AR_EPSILON) {
        continue; // Hard skip: canvas too tall
      }
      if (canvasAR > tuning.canvas_maxAR + AR_EPSILON) {
        continue; // Hard skip: canvas too wide
      }
      
      const emptyBesideResult = { cells: [], width: 0, height: 1.0 };
      const score = scoreRegionAssignment(heroAR, emptyBesideResult, belowResult, tuning);
      
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
      const besideResult = packToFillHeight(besidePhotos, 1.0, normalizedGap, besideRowCount, tuning, randomize);
      
      if (besideResult.cells.length === 0) continue;
      
      const heroRowWidth = heroAR + normalizedGap + besideResult.width;
      
      // Quick canvas width check
      const minCanvasHeight = 1.0 + 2 * normalizedGap;
      const canvasWidth = heroRowWidth + 2 * normalizedGap;
      const bestCaseAR = canvasWidth / minCanvasHeight;
      
      if (bestCaseAR > tuning.canvas_maxAR * 1.1) continue;
      
      const belowRowResult = calculateBelowRowCount(
        belowPhotos, 
        heroRowWidth, 
        normalizedGap,
        heroAR,
        tuning,
        randomize
      );
      const belowRowCount = belowRowResult.value;
      
      const belowResult = packToFillWidth(belowPhotos, heroRowWidth, normalizedGap, belowRowCount, tuning, randomize);
      
      if (belowPhotos.length > 0 && belowResult.cells.length === 0) continue;
      
      // Validate canvas AR
      const totalHeight = 1.0 + normalizedGap + belowResult.height;
      const normalizedWidthWithBorder = heroRowWidth + 2 * normalizedGap;
      const normalizedHeightWithBorder = totalHeight + 2 * normalizedGap;
      const canvasAR = normalizedWidthWithBorder / normalizedHeightWithBorder;
      
      // Hard rejection for AR bounds (symmetric enforcement)
      const AR_EPSILON = 0.01;
      
      if (canvasAR < tuning.canvas_minAR - AR_EPSILON) {
        continue; // Hard skip: canvas too tall
      }
      if (canvasAR > tuning.canvas_maxAR + AR_EPSILON) {
        continue; // Hard skip: canvas too wide
      }
      
      // Per-row prominence check (hero vs beside region only)
      const besideAreas = besideResult.cells.map(c => c.width * c.height);
      const heroArea = heroAR * 1.0;
      const maxBesideArea = Math.max(...besideAreas, 0);
      const prominenceRatio = maxBesideArea > 0 ? heroArea / maxBesideArea : Infinity;
      
      if (prominenceRatio < tuning.hero_minProminence) {
        lastRejectedPack = {
          cells: buildRejectedCells(heroAR, heroPhotoId, besideResult, belowResult, normalizedGap),
          canvasWidth: normalizedWidthWithBorder,
          canvasHeight: normalizedHeightWithBorder,
          reason: 'prominence_too_low',
          details: { prominenceRatio: +prominenceRatio.toFixed(2), required: tuning.hero_minProminence },
        };
        continue;
      }
      
      const score = scoreRegionAssignment(heroAR, besideResult, belowResult, tuning);
      
      devLogger.log('region', 'Valid assignment candidate', {
        besideCount,
        besideRowCount,
        canvasAR: canvasAR.toFixed(2),
        score: score.toFixed(3),
      });
      
      validRegionAssignments.push({
        besidePhotos,
        belowPhotos,
        besideRowCount,
        belowRowCount,
        score,
      });
    }
  }
  
  if (validRegionAssignments.length > 0) {
    const selected = randomize
      ? weightedRandomSelect(validRegionAssignments)
      : validRegionAssignments.reduce((best, current) => current.score > best.score ? current : best);
    
    devLogger.log('region', `Assignment selected ${randomize ? 'by weighted random' : 'by best score'}`, {
      totalCandidates: validRegionAssignments.length,
      besideCount: selected.besidePhotos.length,
      belowCount: selected.belowPhotos.length,
      score: selected.score.toFixed(3),
    });
    return { assignment: selected };
  }
  
  // Fallback: all photos in BELOW
  devLogger.warn('region-reject', 'No valid assignment found, using fallback', {
    photoCount: photos.length,
    heroAR: heroAR.toFixed(2),
  });
  
  const fallbackRowResult = calculateBelowRowCount(
    orderedPhotos, 
    heroAR,
    normalizedGap,
    heroAR,
    tuning,
    false
  );
  
  return { 
    assignment: {
      besidePhotos: [],
      belowPhotos: orderedPhotos,
      besideRowCount: 0,
      belowRowCount: fallbackRowResult.value,
      score: 0.1,
    },
    lastRejectedPack,
  };
}

// ============================================================================
// Helper: Build Rejected Cells
// ============================================================================

function buildRejectedCells(
  heroAR: number,
  heroPhotoId: string,
  besideResult: { cells: { photoId: string; x: number; y: number; width: number; height: number }[]; width: number; height: number } | null,
  belowResult: { cells: { photoId: string; x: number; y: number; width: number; height: number }[]; width: number; height: number },
  normalizedGap: number
): LayoutCell[] {
  const cells: LayoutCell[] = [];
  const borderOffset = normalizedGap;
  
  cells.push({
    photoId: heroPhotoId,
    x: borderOffset,
    y: borderOffset,
    width: heroAR,
    height: 1.0,
  });
  
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
// Tier Coherence Scoring (F-ratio)
// ============================================================================

/**
 * Calculate tier coherence (F-ratio) for cell areas.
 * Measures how well areas cluster into distinct size tiers.
 * 
 * High F = clear hierarchy (good for hero layouts)
 * Low F = too uniform OR too chaotic
 */
function tierCoherenceScore(areas: number[], tierCount: number = 3): number {
  if (areas.length < tierCount * 2) {
    return 0.5; // Neutral score for small sets
  }
  
  const sorted = [...areas].sort((a, b) => b - a);
  const grandMean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  
  const tierSize = Math.ceil(sorted.length / tierCount);
  const tiers: number[][] = [];
  for (let i = 0; i < tierCount; i++) {
    tiers.push(sorted.slice(i * tierSize, (i + 1) * tierSize));
  }
  
  const tierMeans = tiers.map(tier => 
    tier.reduce((a, b) => a + b, 0) / tier.length
  );
  
  const betweenVar = tierMeans.reduce((sum, mean) => 
    sum + Math.pow(mean - grandMean, 2), 0
  ) / tierCount;
  
  let withinVarSum = 0;
  for (let i = 0; i < tierCount; i++) {
    const tierMean = tierMeans[i];
    const tierVar = tiers[i].reduce((sum, area) => 
      sum + Math.pow(area - tierMean, 2), 0
    ) / tiers[i].length;
    withinVarSum += tierVar;
  }
  const withinVar = withinVarSum / tierCount;
  
  const fRatio = withinVar > 0.0001 ? betweenVar / withinVar : 0;
  
  return Math.min(1.0, fRatio / 5);
}

// ============================================================================
// Region Assignment Scoring
// ============================================================================

/**
 * Score a region assignment configuration.
 * 
 * Criteria:
 * 1. Tier coherence (F-ratio): reward distinct size hierarchy
 * 2. Beside presence: reward having photos beside hero
 */
function scoreRegionAssignment(
  _heroAR: number,
  besideResult: { cells: { width: number; height: number }[]; width: number; height: number },
  belowResult: { cells: { width: number; height: number }[]; width: number; height: number },
  _tuning: V3Tuning
): number {
  const allAreas = [
    ...besideResult.cells.map(c => c.width * c.height),
    ...belowResult.cells.map(c => c.width * c.height),
  ];
  
  const coherenceScore = tierCoherenceScore(allAreas);
  const presenceScore = besideResult.cells.length > 0 ? 1.0 : 0.3;
  
  return (coherenceScore * 0.70) + (presenceScore * 0.30);
}
