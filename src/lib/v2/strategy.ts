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
import { packRow, packRowsToFit, calculateNaturalAspectRatio } from './pack';
import { scoreLayout } from './score';
import { sum, partition, shuffleArray } from './math';

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
  // Calculate natural height based on aspect ratios
  const naturalAR = calculateNaturalAspectRatio(photos, gap, targetPhotosPerRow);
  const canvasHeight = canvasWidth / naturalAR;
  
  const region: RegionSpec = { x: 0, y: 0, width: canvasWidth, height: canvasHeight };
  const cells = packRowsToFit(photos, region, gap, targetPhotosPerRow);
  
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
  
  // Content fills below
  const contentRegion: RegionSpec = {
    x: 0,
    y: heroHeight + gap,
    width: canvasWidth,
    height: 0, // Will calculate
  };
  
  // Calculate content natural height
  const contentNaturalAR = calculateNaturalAspectRatio(
    content, gap, tuning.targetPhotosPerRow
  );
  const contentHeight = canvasWidth / contentNaturalAR;
  contentRegion.height = contentHeight;
  
  const canvasHeight = heroHeight + gap + contentHeight;
  
  const cells: LayoutCell[] = [
    { photoId: hero.id, x: 0, y: 0, width: canvasWidth, height: heroHeight },
    ...packRowsToFit(content, contentRegion, gap, tuning.targetPhotosPerRow),
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
  
  // Determine how many photos go beside (1-4 based on count)
  const besideCount = Math.min(4, Math.max(1, Math.floor(others.length / 3)));
  const besidePhotos = others.slice(0, besideCount);
  const belowPhotos = others.slice(besideCount);
  
  // Calculate hero width to achieve target prominence
  // Start with 50% width and adjust
  const heroWidthFraction = 0.55;
  const heroWidth = (canvasWidth - gap) * heroWidthFraction;
  const besideWidth = canvasWidth - heroWidth - gap;
  
  // Hero height from its aspect ratio at target width
  const heroHeight = heroWidth / hero.aspectRatio;
  
  // Beside photos stack in a column matching hero height
  const besideRegion: RegionSpec = {
    x: heroOnLeft ? heroWidth + gap : 0,
    y: 0,
    width: besideWidth,
    height: heroHeight,
  };
  
  // Pack beside photos as a column to match hero height
  const totalBesideGaps = gap * (besidePhotos.length - 1);
  const availableBesideHeight = heroHeight - totalBesideGaps;
  const totalInverseAR = sum(besidePhotos.map(p => 1 / p.aspectRatio));
  const besideItemWidth = availableBesideHeight / totalInverseAR;
  
  // Scale beside width to match our region
  const besideScale = besideWidth / besideItemWidth;
  
  let besideY = 0;
  const besideCells: LayoutCell[] = besidePhotos.map(photo => {
    const itemHeight = (besideWidth / photo.aspectRatio);
    const cell: LayoutCell = {
      photoId: photo.id,
      x: besideRegion.x,
      y: besideY,
      width: besideWidth,
      height: itemHeight,
    };
    besideY += itemHeight + gap;
    return cell;
  });
  
  // Adjust hero height to match actual beside height
  const actualBesideHeight = besideY - gap;
  const finalHeroHeight = actualBesideHeight;
  
  // Content rows below
  const topZoneHeight = finalHeroHeight;
  const contentRegion: RegionSpec = {
    x: 0,
    y: topZoneHeight + gap,
    width: canvasWidth,
    height: 0,
  };
  
  let contentCells: LayoutCell[] = [];
  let canvasHeight = topZoneHeight;
  
  if (belowPhotos.length > 0) {
    const contentNaturalAR = calculateNaturalAspectRatio(
      belowPhotos, gap, tuning.targetPhotosPerRow
    );
    const contentHeight = canvasWidth / contentNaturalAR;
    contentRegion.height = contentHeight;
    contentCells = packRowsToFit(belowPhotos, contentRegion, gap, tuning.targetPhotosPerRow);
    canvasHeight = topZoneHeight + gap + contentHeight;
  }
  
  const heroCell: LayoutCell = {
    photoId: hero.id,
    x: heroOnLeft ? 0 : besideWidth + gap,
    y: 0,
    width: heroWidth,
    height: finalHeroHeight,
  };
  
  // Recalculate beside cells with corrected Y positions
  const correctedBesideCells: LayoutCell[] = [];
  let y = 0;
  const adjustedBesideHeight = (finalHeroHeight - totalBesideGaps) / besidePhotos.length;
  
  for (const photo of besidePhotos) {
    // Use equal height distribution for cleaner look
    correctedBesideCells.push({
      photoId: photo.id,
      x: besideRegion.x,
      y,
      width: besideWidth,
      height: adjustedBesideHeight,
    });
    y += adjustedBesideHeight + gap;
  }
  
  return {
    cells: [heroCell, ...correctedBesideCells, ...contentCells],
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
