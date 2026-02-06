/**
 * V2 Layout Strategies
 * 
 * Different approaches to partitioning the canvas.
 * Each strategy produces a LayoutCandidate for scoring.
 */

import { 
  PhotoDimension, 
  LayoutCell, 
  LayoutCandidate, 
  RegionSpec,
  V2Tuning,
  ShapeTarget,
} from './types';
import { packRow, packRowsToFit, calculateNaturalAspectRatio, packBeside1Row, packBeside2Rows, packBeside3Rows, BesidePackResult } from './pack';
import { scoreLayout } from './score';
import { sum, partition, shuffleArray, calculateOptimalHeroFraction } from './math';

// ============================================================================
// Strategy: Simple Rows
// ============================================================================

/**
 * Simple row-based layout without hero treatment.
 * All photos are packed into rows to fill the canvas.
 */
export function strategySimpleRows(
  photos: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  targetPhotosPerRow: number
): LayoutCandidate {
  // Build cells first, then derive canvas height from actual bounds
  const region: RegionSpec = { x: 0, y: 0, width: canvasWidth, height: 0 };
  const cells = packRowsToFit(photos, region, gap, targetPhotosPerRow);
  
  // Calculate actual canvas height from cells (not pre-estimated)
  const canvasHeight = cells.reduce(
    (max, c) => Math.max(max, c.y + c.height), 
    0
  );
  
  return {
    cells,
    canvasWidth,
    canvasHeight,
    score: 0, // Will be scored later
    metadata: { strategy: 'simpleRows' },
  };
}

// ============================================================================
// Strategy: Hero Top
// ============================================================================

/**
 * Hero at top spanning full width, content rows below.
 * Classic layout for single dominant hero.
 */
export function strategyHeroTop(
  photos: PhotoDimension[],
  heroId: string,
  canvasWidth: number,
  gap: number,
  tuning: V2Tuning
): LayoutCandidate | null {
  const [heroes, content] = partition(photos, p => p.id === heroId);
  if (heroes.length === 0) return null;
  
  const hero = heroes[0];
  
  // Hero takes full width
  const heroHeight = canvasWidth / hero.aspectRatio;
  
  // Content fills below - derive height from actual cells
  const contentRegion: RegionSpec = {
    x: 0,
    y: heroHeight + gap,
    width: canvasWidth,
    height: 0,
  };
  
  const contentCells = packRowsToFit(content, contentRegion, gap, tuning.targetPhotosPerRow);
  
  // Calculate actual canvas height from cells
  const contentBottom = contentCells.reduce(
    (max, c) => Math.max(max, c.y + c.height),
    heroHeight + gap
  );
  const canvasHeight = contentBottom;
  
  const cells: LayoutCell[] = [
    { photoId: hero.id, x: 0, y: 0, width: canvasWidth, height: heroHeight },
    ...contentCells,
  ];
  
  return {
    cells,
    canvasWidth,
    canvasHeight,
    score: 0,
    metadata: { strategy: 'heroTop' },
  };
}

// ============================================================================
// Strategy: Hero Left/Right with Beside
// ============================================================================

/**
 * Determine row count for beside photos based on count.
 * Uses tuning.maxBesidePhotos to determine thresholds.
 */
function determineBesideRowCount(besideCount: number, maxBeside: number): 1 | 2 | 3 {
  // Scale thresholds based on maxBesidePhotos
  // With max=4: 1-3 → 1 row, 4-6 → 2 rows, 7+ → 3 rows
  // With max=6: 1-4 → 1 row, 5-8 → 2 rows, 9+ → 3 rows
  const threshold1 = Math.ceil(maxBeside * 0.75); // ~3 for max=4
  const threshold2 = Math.ceil(maxBeside * 1.5);  // ~6 for max=4
  
  if (besideCount <= threshold1) return 1;
  if (besideCount <= threshold2) return 2;
  return 3;
}

/**
 * Hero on one side, stacked photos beside it.
 * The "beside" photos stack vertically next to the hero.
 */
export function strategyHeroSide(
  photos: PhotoDimension[],
  heroId: string,
  canvasWidth: number,
  gap: number,
  tuning: V2Tuning,
  heroOnLeft: boolean = true
): LayoutCandidate | null {
  const [heroes, others] = partition(photos, p => p.id === heroId);
  if (heroes.length === 0) return null;
  
  const hero = heroes[0];
  
  // Determine how many photos go beside (use tuning.maxBesidePhotos)
  const besideCount = Math.min(
    tuning.maxBesidePhotos, 
    Math.max(1, Math.floor(others.length / 3))
  );
  const besidePhotos = others.slice(0, besideCount);
  const belowPhotos = others.slice(besideCount);
  
  // Determine row count based on beside photo count
  const rowCount = determineBesideRowCount(besidePhotos.length, tuning.maxBesidePhotos);
  
  // Calculate optimal hero width fraction algebraically for this row count
  const { fraction } = calculateOptimalHeroFraction(
    hero.aspectRatio,
    besidePhotos,
    canvasWidth,
    gap,
    rowCount,
    tuning.heroMinWidthFraction,
    tuning.heroMaxWidthFraction
  );
  
  const heroWidth = (canvasWidth - gap) * fraction;
  const besideWidth = canvasWidth - heroWidth - gap;
  const besideX = heroOnLeft ? heroWidth + gap : 0;
  
  // Pack beside photos as rows (not a single column!)
  let packResult: BesidePackResult;
  if (rowCount === 3) {
    packResult = packBeside3Rows(besidePhotos, besideWidth, gap, besideX, 0);
  } else if (rowCount === 2) {
    packResult = packBeside2Rows(besidePhotos, besideWidth, gap, besideX, 0);
  } else {
    packResult = packBeside1Row(besidePhotos, besideWidth, gap, besideX, 0);
  }
  
  // Hero height matches the beside column height (they align perfectly)
  const heroHeight = packResult.combinedHeight;
  
  // Content rows below
  const contentRegion: RegionSpec = {
    x: 0,
    y: heroHeight + gap,
    width: canvasWidth,
    height: 0,
  };
  
  let belowCells: LayoutCell[] = [];
  let canvasHeight = heroHeight;
  
  if (belowPhotos.length > 0) {
    belowCells = packRowsToFit(belowPhotos, contentRegion, gap, tuning.targetPhotosPerRow);
    // Derive canvas height from actual cell bounds
    const belowBottom = belowCells.reduce(
      (max, c) => Math.max(max, c.y + c.height),
      heroHeight + gap
    );
    canvasHeight = belowBottom;
  }
  
  const heroCell: LayoutCell = {
    photoId: hero.id,
    x: heroOnLeft ? 0 : besideWidth + gap,
    y: 0,
    width: heroWidth,
    height: heroHeight,
  };
  
  return {
    cells: [heroCell, ...packResult.cells, ...belowCells],
    canvasWidth,
    canvasHeight,
    score: 0,
    metadata: { strategy: heroOnLeft ? 'heroLeft' : 'heroRight' },
  };
}

// ============================================================================
// Strategy Orchestrator
// ============================================================================

/**
 * Generate multiple candidate layouts using different strategies.
 */
export function generateCandidates(
  photos: PhotoDimension[],
  heroIds: Set<string>,
  canvasWidth: number,
  gap: number,
  shape: ShapeTarget,
  tuning: V2Tuning,
  randomize: boolean
): LayoutCandidate[] {
  const candidates: LayoutCandidate[] = [];
  
  // Order photos for layout (heroes first, then shuffle rest if randomizing)
  const [heroes, nonHeroes] = partition(photos, p => heroIds.has(p.id));
  const orderedPhotos = [
    ...heroes,
    ...(randomize ? shuffleArray(nonHeroes) : nonHeroes),
  ];
  
  // Strategy 1: Simple rows (works for any count)
  candidates.push(
    strategySimpleRows(orderedPhotos, canvasWidth, gap, tuning.targetPhotosPerRow)
  );
  
  // Strategy 2+: Hero strategies (if heroes exist)
  if (heroes.length > 0) {
    const primaryHeroId = heroes[0].id;
    
    const heroTop = strategyHeroTop(orderedPhotos, primaryHeroId, canvasWidth, gap, tuning);
    if (heroTop) candidates.push(heroTop);
    
    const heroLeft = strategyHeroSide(orderedPhotos, primaryHeroId, canvasWidth, gap, tuning, true);
    if (heroLeft) candidates.push(heroLeft);
    
    const heroRight = strategyHeroSide(orderedPhotos, primaryHeroId, canvasWidth, gap, tuning, false);
    if (heroRight) candidates.push(heroRight);
  }
  
  // Score all candidates
  const heroIdSet = new Set(heroes.map(h => h.id));
  for (const candidate of candidates) {
    const breakdown = scoreLayout(
      candidate.cells,
      candidate.canvasWidth,
      candidate.canvasHeight,
      heroIdSet,
      shape,
      tuning
    );
    candidate.score = breakdown.total;
    if (candidate.metadata) {
      candidate.metadata.areaCV = breakdown.areaUniformity;
      candidate.metadata.directionPenalty = 1 - breakdown.shapeCompliance;
    }
  }
  
  return candidates;
}
