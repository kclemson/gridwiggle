/**
 * Block-Based Layout Architecture
 * 
 * This module provides self-contained "blocks" that can be stacked in any order
 * to create varied layouts. The key insight is that each block is independent
 * and can be shuffled to create visual variety.
 * 
 * Layers:
 * 1. Primitives (in heroLayout.ts): packBesideAs2Rows, packBesideAs3Rows, etc.
 * 2. Block Types (this file): LayoutBlock, HeroUnitBlock, ContentRowsBlock
 * 3. Block Builders (this file): buildHeroUnitBlock, buildContentRowsBlock
 * 4. Layout Assembly (this file): stackBlocks, generateBlockBasedHeroLayout
 */

import { CollageLayout, CollageCell } from '@/types/collage';
import { PhotoDimension, shuffleArray, mean } from '@/lib/layoutMath';
import { devLogger } from '@/lib/devLogger';

// Re-export for consumers that imported from here
export type { PhotoDimension };
export { shuffleArray };

/**
 * A LayoutBlock is a self-contained vertical unit with fixed width.
 * Blocks can be stacked in any order to form a complete layout.
 */
export interface LayoutBlock {
  type: 'hero-unit' | 'content-rows';
  cells: CollageCell[];
  height: number;
  /** Photos consumed by this block (for tracking) */
  photoIds: Set<string>;
}

/**
 * Result of building a hero unit block.
 * Contains the hero + its beside rows as one inseparable unit.
 */
export interface HeroUnitBlock extends LayoutBlock {
  type: 'hero-unit';
  heroCell: CollageCell;
  besideCells: CollageCell[];
  /** Which side the hero anchors to */
  anchorSide: 'left' | 'right';
}

/**
 * Result of building content rows.
 * One or more full-width rows packed from remaining photos.
 */
export interface ContentRowsBlock extends LayoutBlock {
  type: 'content-rows';
  rowCount: number;
}

/**
 * Options for building a hero unit block.
 */
export interface HeroUnitOptions {
  /** Preferred number of beside photos (will try fewer if needed) */
  preferredBesideCount?: number;
  /** Which side to anchor the hero */
  anchorSide?: 'left' | 'right' | 'random';
  /** Whether to use 1-row, 2-row or 3-row packing */
  rowMode?: '1-row' | '2-row' | '3-row' | 'auto';
  /** Max photos beside hero in 1-row mode (default 4) */
  maxBeside1Row?: number;
  /** Max photos beside hero in 2-row mode (default 6) */
  maxBeside2Row?: number;
  /** Max photos beside hero in 3-row mode (default 12) */
  maxBeside3Row?: number;
  /** Minimum scale tolerance (default 0.75) */
  scaleToleranceLow?: number;
  /** Maximum scale tolerance (default 1.25) */
  scaleToleranceHigh?: number;
  /** Max fraction of total photos hero can consume (default 0.6) */
  maxBesideFraction?: number;
  /** Total photo count (needed for fraction calculation) */
  totalPhotoCount?: number;
  /** Minimum photos to reserve for content (default 4) */
  minContentPhotos?: number;
  /** Shape preference for scoring (default 'auto') */
  shape?: 'auto' | 'landscape' | 'portrait' | 'square';
  /** Minimum hero area as % of total canvas (default 0.08) */
  minHeroCoverage?: number;
}

// ============================================================================
// Row Packing Result Types (from heroLayout.ts primitives)
// ============================================================================

interface PackResult {
  cells: CollageCell[];
  combinedHeight: number;
  naturalTotalWidth: number;
  usedIds: Set<string>;
}

interface PackResult2Row extends PackResult {
  row1Height: number;
  row2Height: number;
}

interface PackResult3Row extends PackResult {
  row1Height: number;
  row2Height: number;
  row3Height: number;
}

interface PackResult1Row extends PackResult {
  rowHeight: number;
}

// ============================================================================
// Block Builders (Layer 3)
// ============================================================================

// ============================================================================
// Block Builders (Layer 3)
// ============================================================================

/**
 * Build a hero unit: hero photo + 2-3 rows of beside photos.
 * 
 * This is a self-contained unit - the hero height is determined by
 * the beside rows it's paired with. Returns null if can't build valid unit.
 * 
 * @param hero - The hero photo dimension
 * @param candidates - Photos available for beside rows
 * @param canvasWidth - Total canvas width
 * @param gap - Gap between photos
 * @param packBesideAs2Rows - Packing function from heroLayout.ts
 * @param packBesideAs3Rows - Packing function from heroLayout.ts
 * @param calculateOptimalHeroFraction - Fraction calculator from heroLayout.ts
 * @param fixRowAlignment2Row - Alignment fix function
 * @param fixRowAlignment3Row - Alignment fix function
 * @param options - Configuration options
 */
export function buildHeroUnitBlock(
  hero: PhotoDimension,
  candidates: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  packBesideAs1Row: (photos: PhotoDimension[], targetWidth: number, gap: number, offsetX: number) => PackResult1Row,
  packBesideAs2Rows: (photos: PhotoDimension[], targetWidth: number, gap: number, offsetX: number) => PackResult2Row,
  packBesideAs3Rows: (photos: PhotoDimension[], targetWidth: number, gap: number, offsetX: number) => PackResult3Row,
  calculateOptimalHeroFraction: (heroAspect: number, besidePhotos: PhotoDimension[], canvasWidth: number, gap: number, rowCount: 1 | 2 | 3) => { fraction: number; clamped: boolean },
  fixRowAlignment2Row: (cells: CollageCell[], row1Height: number, row2Height: number, scaledHeroHeight: number, scaleFactor: number, gap: number) => CollageCell[],
  fixRowAlignment3Row: (cells: CollageCell[], row1Height: number, row2Height: number, row3Height: number, scaledHeroHeight: number, scaleFactor: number, gap: number) => CollageCell[],
  options: HeroUnitOptions = {}
): HeroUnitBlock | null {
  const { 
    anchorSide = 'random', 
    rowMode = 'auto',
    maxBeside1Row = 4,
    maxBeside2Row = 6,
    maxBeside3Row = 12,
    scaleToleranceLow = 0.75,
    scaleToleranceHigh = 1.25,
    maxBesideFraction = 0.6,
    totalPhotoCount = candidates.length + 1, // +1 for hero
    minContentPhotos = 4,
  } = options;
  
  // Determine anchor side
  const anchorRight = anchorSide === 'random' ? Math.random() < 0.5 : anchorSide === 'right';
  
  // Calculate effective max based on fraction and reservation constraints
  const fractionMax = Math.floor(totalPhotoCount * maxBesideFraction);
  const reservedMax = totalPhotoCount - minContentPhotos - 1; // -1 for hero itself
  
  // Simple: random order, validate each
  const rowModesToTry: (1 | 2 | 3)[] = rowMode === 'auto'
    ? shuffleArray([1, 2, 3] as (1 | 2 | 3)[])
    : [rowMode === '1-row' ? 1 : rowMode === '2-row' ? 2 : 3];
  
  // Calculate effective max for each row mode (respects fraction and reservation)
  const minPhotos1Row = 1;
  const minPhotos2Row = 2;
  const minPhotos3Row = 3;
  const effectiveMax1Row = Math.min(maxBeside1Row, fractionMax, Math.max(minPhotos1Row, reservedMax));
  const effectiveMax2Row = Math.min(maxBeside2Row, fractionMax, Math.max(minPhotos2Row, reservedMax));
  const effectiveMax3Row = Math.min(maxBeside3Row, fractionMax, Math.max(minPhotos3Row, reservedMax));

  // Log row selection decision
  devLogger.log('layout', 'Row selection', {
    heroAR: hero.aspectRatio,
    candidateCount: candidates.length,
    rowModesToTry,
  });
  
  // Try each row mode in order of preference
  for (const rowCount of rowModesToTry) {
    const effectiveMax = rowCount === 1 ? effectiveMax1Row 
      : rowCount === 2 ? effectiveMax2Row 
      : effectiveMax3Row;
    
    const result = tryBuildHeroUnit(
      hero,
      candidates,
      canvasWidth,
      gap,
      rowCount,
      anchorRight,
      packBesideAs1Row,
      packBesideAs2Rows,
      packBesideAs3Rows,
      calculateOptimalHeroFraction,
      fixRowAlignment2Row,
      fixRowAlignment3Row,
      effectiveMax1Row,
      effectiveMax2Row,
      effectiveMax3Row,
      scaleToleranceLow,
      scaleToleranceHigh,
      options.minHeroCoverage ?? 0.08
    );
    
    if (result) {
      return result;
    }
  }
  
  return null;
}

/**
 * Internal helper to try building a hero unit with specific row count.
 */
function tryBuildHeroUnit(
  hero: PhotoDimension,
  candidates: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  rowCount: 1 | 2 | 3,
  anchorRight: boolean,
  packBesideAs1Row: (photos: PhotoDimension[], targetWidth: number, gap: number, offsetX: number) => PackResult1Row,
  packBesideAs2Rows: (photos: PhotoDimension[], targetWidth: number, gap: number, offsetX: number) => PackResult2Row,
  packBesideAs3Rows: (photos: PhotoDimension[], targetWidth: number, gap: number, offsetX: number) => PackResult3Row,
  calculateOptimalHeroFraction: (heroAspect: number, besidePhotos: PhotoDimension[], canvasWidth: number, gap: number, rowCount: 1 | 2 | 3) => { fraction: number; clamped: boolean },
  fixRowAlignment2Row: (cells: CollageCell[], row1Height: number, row2Height: number, scaledHeroHeight: number, scaleFactor: number, gap: number) => CollageCell[],
  fixRowAlignment3Row: (cells: CollageCell[], row1Height: number, row2Height: number, row3Height: number, scaledHeroHeight: number, scaleFactor: number, gap: number) => CollageCell[],
  maxBeside1Row: number,
  maxBeside2Row: number,
  maxBeside3Row: number,
  scaleToleranceLow: number,
  scaleToleranceHigh: number,
  minHeroCoverage: number
): HeroUnitBlock | null {
  const minPhotos = rowCount === 3 ? 3 : rowCount === 2 ? 2 : 1;
  const maxPhotos = rowCount === 3 ? maxBeside3Row : rowCount === 2 ? maxBeside2Row : maxBeside1Row;
  
  // Try different beside counts
  for (let besideCount = Math.min(maxPhotos, candidates.length); besideCount >= minPhotos; besideCount--) {
    const besidePhotos = candidates.slice(0, besideCount);
    
    // Calculate optimal hero fraction for these photos
    const { fraction: optimalFraction, clamped } = calculateOptimalHeroFraction(
      hero.aspectRatio,
      besidePhotos,
      canvasWidth,
      gap,
      rowCount
    );
    
    // For 1-row: reject if clamped (geometry doesn't support prominent hero)
    if (rowCount === 1 && clamped) {
      devLogger.log('layout', 'Config rejected', {
        rowCount,
        besideCount,
        reason: 'fraction clamped for 1-row (hero would lack prominence)',
      });
      continue;
    }
    
    const targetBesideWidth = Math.round(canvasWidth * (1 - optimalFraction)) - gap;
    
    // Pack beside photos based on row count
    const packResult = rowCount === 3
      ? packBesideAs3Rows(besidePhotos, targetBesideWidth, gap, 0)
      : rowCount === 2
      ? packBesideAs2Rows(besidePhotos, targetBesideWidth, gap, 0)
      : packBesideAs1Row(besidePhotos, targetBesideWidth, gap, 0);
    
    if (packResult.combinedHeight === 0) {
      devLogger.log('layout', 'Config rejected', { rowCount, besideCount, reason: 'empty pack result' });
      continue;
    }
    
    // Hero height = beside combined height
    const heroHeight = packResult.combinedHeight;
    const heroWidth = heroHeight * hero.aspectRatio;
    
    // Calculate scale factor
    const totalNaturalWidth = heroWidth + gap + packResult.naturalTotalWidth;
    const scaleFactor = canvasWidth / totalNaturalWidth;
    
    // Accept if within tolerance
    if (scaleFactor < scaleToleranceLow || scaleFactor > scaleToleranceHigh) {
      devLogger.log('layout', 'Config rejected', { 
        rowCount, 
        besideCount, 
        scaleFactor, 
        reason: `scale ${scaleFactor.toFixed(3)} outside [${scaleToleranceLow}, ${scaleToleranceHigh}]` 
      });
      continue;
    }
    
    // Apply scaling
    const scaledHeroWidth = Math.round(heroWidth * scaleFactor);
    const scaledHeroHeight = Math.round(heroHeight * scaleFactor);
    const availableBesideWidth = canvasWidth - scaledHeroWidth - gap;
    const horizontalScale = availableBesideWidth / packResult.naturalTotalWidth;
    
    // Position hero
    const heroX = anchorRight ? canvasWidth - scaledHeroWidth : 0;
    const heroCell: CollageCell = {
      photoId: hero.id,
      x: heroX,
      y: 0,
      width: scaledHeroWidth,
      height: scaledHeroHeight,
    };
    
    // Scale and position beside cells
    const besideOffsetX = anchorRight ? 0 : scaledHeroWidth + gap;
    let besideCells = packResult.cells.map(cell => ({
      ...cell,
      x: Math.round(besideOffsetX + (cell.x * horizontalScale)),
      y: Math.round(cell.y * scaleFactor),
      width: Math.round(cell.width * horizontalScale),
      height: Math.round(cell.height * scaleFactor),
    }));
    
    // Apply row alignment fix (1-row doesn't need alignment fix)
    if (rowCount === 3 && 'row3Height' in packResult) {
      besideCells = fixRowAlignment3Row(
        besideCells,
        (packResult as PackResult3Row).row1Height,
        (packResult as PackResult3Row).row2Height,
        (packResult as PackResult3Row).row3Height,
        scaledHeroHeight,
        scaleFactor,
        gap
      );
    } else if (rowCount === 2 && 'row2Height' in packResult) {
      besideCells = fixRowAlignment2Row(
        besideCells,
        (packResult as PackResult2Row).row1Height,
        (packResult as PackResult2Row).row2Height,
        scaledHeroHeight,
        scaleFactor,
        gap
      );
    }
    
    // Estimate total canvas height to check hero coverage
    const remainingCount = candidates.length - besidePhotos.length;
    const avgRemainingAR = remainingCount > 0 
      ? candidates.slice(besideCount).reduce((s, p) => s + p.aspectRatio, 0) / remainingCount
      : 1.0;
    
    // Estimate rows needed for remaining photos (rough: photosPerRow ≈ 3.5)
    const estimatedRowsBelow = Math.max(0, Math.ceil(remainingCount / 3.5));
    const estimatedRowHeight = avgRemainingAR > 0 
      ? canvasWidth / (3.5 * avgRemainingAR)
      : 200; // Fallback
    const estimatedBelowHeight = estimatedRowsBelow * (estimatedRowHeight + gap);
    
    const estimatedTotalHeight = scaledHeroHeight + gap + estimatedBelowHeight;
    const estimatedHeroCoverage = estimatedTotalHeight > 0
      ? (scaledHeroWidth * scaledHeroHeight) / (canvasWidth * estimatedTotalHeight)
      : 0;
    
    // Check if hero will have sufficient canvas presence
    if (estimatedHeroCoverage < minHeroCoverage) {
      devLogger.log('layout', 'Config rejected', {
        rowCount,
        besideCount,
        estimatedHeroCoverage,
        reason: `hero coverage ${(estimatedHeroCoverage * 100).toFixed(1)}% < ${minHeroCoverage * 100}%`,
      });
      continue;
    }
    
    devLogger.log('layout', 'Config accepted', {
      rowCount,
      besideCount,
      scaleFactor,
      heroWidthFraction: scaledHeroWidth / canvasWidth,
      estimatedHeroCoverage,
    });

    return {
      type: 'hero-unit',
      cells: [heroCell, ...besideCells],
      height: scaledHeroHeight,
      photoIds: new Set([hero.id, ...besidePhotos.map(p => p.id)]),
      heroCell,
      besideCells,
      anchorSide: anchorRight ? 'right' : 'left',
    };
  }
  
  return null;
}

/**
 * Build content rows from a set of photos.
 * Uses packPhotosIntoRegion to create optimal row arrangements.
 * 
 * @param photos - Photos to pack into rows
 * @param canvasWidth - Total canvas width
 * @param gap - Gap between photos
 * @param packPhotosIntoRegion - Packing function from collageLayout.ts
 * @param minPhotosPerRow - Minimum photos per row for scoring
 * @param shape - Shape preference for scoring
 * @param maxHeight - Height budget constraint (soft ceiling for total height)
 */
export function buildContentRowsBlock(
  photos: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  packPhotosIntoRegion: (dims: PhotoDimension[], options: { 
    width: number; 
    gap: number; 
    offsetX: number; 
    offsetY: number; 
    minPhotosPerRow?: number; 
    shape?: 'auto' | 'landscape' | 'portrait' | 'square';
    maxHeight?: number;
  }) => { cells: CollageCell[]; achievedHeight: number; partition: PhotoDimension[][] },
  minPhotosPerRow: number = 2,
  shape: 'auto' | 'landscape' | 'portrait' | 'square' = 'auto',
  maxHeight?: number
): ContentRowsBlock | null {
  if (photos.length === 0) return null;
  
  const result = packPhotosIntoRegion(photos, {
    width: canvasWidth,
    gap,
    offsetX: 0,
    offsetY: 0,
    minPhotosPerRow,
    shape,
    maxHeight,
  });
  
  if (result.cells.length === 0) return null;
  
  return {
    type: 'content-rows',
    cells: result.cells,
    height: result.achievedHeight,
    photoIds: new Set(photos.map(p => p.id)),
    rowCount: result.partition.length,
  };
}

// ============================================================================
// Block Assembly (Layer 4)
// ============================================================================

/**
 * Stack blocks vertically and return final layout.
 * Handles Y-offset cascading and final height calculation.
 */
export function stackBlocks(
  blocks: LayoutBlock[],
  canvasWidth: number,
  gap: number
): CollageLayout {
  const allCells: CollageCell[] = [];
  let currentY = 0;
  
  for (const block of blocks) {
    // Offset all cells in this block by currentY
    const offsetCells = block.cells.map(cell => ({
      ...cell,
      y: cell.y + currentY,
    }));
    allCells.push(...offsetCells);
    
    currentY += block.height + gap;
  }
  
  // Remove trailing gap from total height
  const totalHeight = currentY - gap;
  
  return {
    width: canvasWidth,
    height: Math.round(Math.max(0, totalHeight)),
    cells: allCells,
  };
}

/**
 * Split photos into chunks for content row blocks.
 * This creates multiple smaller blocks that can be shuffled independently.
 */
export function splitPhotosForBlocks(
  photos: PhotoDimension[],
  maxPhotosPerBlock: number = 4
): PhotoDimension[][] {
  const blocks: PhotoDimension[][] = [];
  
  for (let i = 0; i < photos.length; i += maxPhotosPerBlock) {
    blocks.push(photos.slice(i, i + maxPhotosPerBlock));
  }
  
  return blocks;
}
