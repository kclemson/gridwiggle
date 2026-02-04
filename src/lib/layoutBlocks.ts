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

// ============================================================================
// Types (Layer 2)
// ============================================================================

/**
 * Core photo dimension type used throughout layout calculations.
 * Matches the type in heroLayout.ts for compatibility.
 */
export interface PhotoDimension {
  id: string;
  width: number;
  height: number;
  aspectRatio: number;
  weight: number;
}

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
  /** Whether to use 2-row or 3-row packing */
  rowMode?: '2-row' | '3-row' | 'auto';
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

// ============================================================================
// Helpers
// ============================================================================

/** Fisher-Yates shuffle - returns new shuffled array */
export function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

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
  packBesideAs2Rows: (photos: PhotoDimension[], targetWidth: number, gap: number, offsetX: number) => PackResult2Row,
  packBesideAs3Rows: (photos: PhotoDimension[], targetWidth: number, gap: number, offsetX: number) => PackResult3Row,
  calculateOptimalHeroFraction: (heroAspect: number, besidePhotos: PhotoDimension[], canvasWidth: number, gap: number, rowCount: 2 | 3) => { fraction: number; clamped: boolean },
  fixRowAlignment2Row: (cells: CollageCell[], row1Height: number, row2Height: number, scaledHeroHeight: number, scaleFactor: number, gap: number) => CollageCell[],
  fixRowAlignment3Row: (cells: CollageCell[], row1Height: number, row2Height: number, row3Height: number, scaledHeroHeight: number, scaleFactor: number, gap: number) => CollageCell[],
  options: HeroUnitOptions = {}
): HeroUnitBlock | null {
  const { anchorSide = 'random', rowMode = 'auto' } = options;
  
  // Determine anchor side
  const anchorRight = anchorSide === 'random' ? Math.random() < 0.5 : anchorSide === 'right';
  
  // Determine row mode based on photo count
  const useRowMode = rowMode === 'auto'
    ? (candidates.length >= 6 ? '3-row' : '2-row')
    : rowMode;
  
  // Try to build with the selected row mode
  const result = tryBuildHeroUnit(
    hero,
    candidates,
    canvasWidth,
    gap,
    useRowMode === '3-row' ? 3 : 2,
    anchorRight,
    packBesideAs2Rows,
    packBesideAs3Rows,
    calculateOptimalHeroFraction,
    fixRowAlignment2Row,
    fixRowAlignment3Row
  );
  
  if (result) {
    return result;
  }
  
  // If 3-row failed, try 2-row as fallback
  if (useRowMode === '3-row') {
    return tryBuildHeroUnit(
      hero,
      candidates,
      canvasWidth,
      gap,
      2,
      anchorRight,
      packBesideAs2Rows,
      packBesideAs3Rows,
      calculateOptimalHeroFraction,
      fixRowAlignment2Row,
      fixRowAlignment3Row
    );
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
  rowCount: 2 | 3,
  anchorRight: boolean,
  packBesideAs2Rows: (photos: PhotoDimension[], targetWidth: number, gap: number, offsetX: number) => PackResult2Row,
  packBesideAs3Rows: (photos: PhotoDimension[], targetWidth: number, gap: number, offsetX: number) => PackResult3Row,
  calculateOptimalHeroFraction: (heroAspect: number, besidePhotos: PhotoDimension[], canvasWidth: number, gap: number, rowCount: 2 | 3) => { fraction: number; clamped: boolean },
  fixRowAlignment2Row: (cells: CollageCell[], row1Height: number, row2Height: number, scaledHeroHeight: number, scaleFactor: number, gap: number) => CollageCell[],
  fixRowAlignment3Row: (cells: CollageCell[], row1Height: number, row2Height: number, row3Height: number, scaledHeroHeight: number, scaleFactor: number, gap: number) => CollageCell[]
): HeroUnitBlock | null {
  const minPhotos = rowCount === 3 ? 3 : 2;
  const maxPhotos = rowCount === 3 ? 12 : 6;
  
  // Try different beside counts
  for (let besideCount = Math.min(maxPhotos, candidates.length); besideCount >= minPhotos; besideCount--) {
    const besidePhotos = candidates.slice(0, besideCount);
    
    // Calculate optimal hero fraction for these photos
    const { fraction: optimalFraction } = calculateOptimalHeroFraction(
      hero.aspectRatio,
      besidePhotos,
      canvasWidth,
      gap,
      rowCount
    );
    
    const targetBesideWidth = Math.round(canvasWidth * (1 - optimalFraction)) - gap;
    
    // Pack beside photos
    const packResult = rowCount === 3
      ? packBesideAs3Rows(besidePhotos, targetBesideWidth, gap, 0)
      : packBesideAs2Rows(besidePhotos, targetBesideWidth, gap, 0);
    
    if (packResult.combinedHeight === 0) continue;
    
    // Hero height = beside combined height
    const heroHeight = packResult.combinedHeight;
    const heroWidth = heroHeight * hero.aspectRatio;
    
    // Calculate scale factor
    const totalNaturalWidth = heroWidth + gap + packResult.naturalTotalWidth;
    const scaleFactor = canvasWidth / totalNaturalWidth;
    
    // Accept if within tolerance
    if (scaleFactor < 0.75 || scaleFactor > 1.25) continue;
    
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
    
    // Apply row alignment fix
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
    } else if ('row2Height' in packResult) {
      besideCells = fixRowAlignment2Row(
        besideCells,
        (packResult as PackResult2Row).row1Height,
        (packResult as PackResult2Row).row2Height,
        scaledHeroHeight,
        scaleFactor,
        gap
      );
    }
    
    console.log('[Hero] Block built', {
      type: 'hero-unit',
      rowCount,
      besideCount,
      scaleFactor: scaleFactor.toFixed(2),
      height: scaledHeroHeight,
      anchorSide: anchorRight ? 'right' : 'left',
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
 */
export function buildContentRowsBlock(
  photos: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  packPhotosIntoRegion: (dims: PhotoDimension[], options: { width: number; gap: number; offsetX: number; offsetY: number; isLandscape: boolean }) => { cells: CollageCell[]; achievedHeight: number; partition: PhotoDimension[][] }
): ContentRowsBlock | null {
  if (photos.length === 0) return null;
  
  const result = packPhotosIntoRegion(photos, {
    width: canvasWidth,
    gap,
    offsetX: 0,
    offsetY: 0,
    isLandscape: true,
  });
  
  if (result.cells.length === 0) return null;
  
  console.log('[Hero] Block built', {
    type: 'content-rows',
    photoCount: photos.length,
    rowCount: result.partition.length,
    height: result.achievedHeight,
  });
  
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
