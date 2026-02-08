/**
 * Reflow Module
 * 
 * Reflows an existing layout at a different hero scale.
 * Preserves layout topology — same photos in same regions.
 * Synchronous, deterministic, no search involved.
 */

import { PhotoDimension, V3Tuning, DEFAULT_V3_TUNING } from './types';
import { NormalizedLayout, LayoutMetadata, NormalizedCell } from '@/types/collage';
import { packToFillHeight, packToFillWidth } from './normalized-pack';

// ============================================================================
// Constants
// ============================================================================

const VIRTUAL_CANVAS_BASE = 1000;

// ============================================================================
// Main Reflow Function
// ============================================================================

/**
 * Reflow an existing layout at a different hero scale.
 * Preserves layout topology — same photos in same regions.
 * 
 * @param photos - All photos with current dimensions
 * @param metadata - Preserved layout structure
 * @param heroScale - Scale factor (1.0 = original, 1.2 = 20% larger)
 * @param tuning - V3 tuning parameters
 * @returns New normalized layout with same topology but different dimensions
 */
export function reflowWithHeroScale(
  photos: PhotoDimension[],
  metadata: LayoutMetadata,
  heroScale: number,
  tuning: V3Tuning = DEFAULT_V3_TUNING
): NormalizedLayout | null {
  // Handle no-hero case (metadata.heroId is null)
  if (!metadata.heroId) {
    return null; // Cannot reflow without hero — slider should be disabled
  }
  
  // 1. Find hero and get its scaled AR
  const heroPhoto = photos.find(p => p.id === metadata.heroId);
  if (!heroPhoto) {
    return null; // Hero photo was removed
  }
  
  const scaledHeroAR = heroPhoto.aspectRatio * heroScale;
  const normalizedGap = metadata.normalizedGap;
  
  // 2. Get BESIDE photos in preserved order
  const besidePhotos = metadata.besidePhotoIds
    .map(id => photos.find(p => p.id === id))
    .filter((p): p is PhotoDimension => p !== undefined);
  
  // 3. Get BELOW photos in preserved order
  const belowPhotos = metadata.belowPhotoIds
    .map(id => photos.find(p => p.id === id))
    .filter((p): p is PhotoDimension => p !== undefined);
  
  // Validate all photos still exist
  const expectedTotal = metadata.besidePhotoIds.length + metadata.belowPhotoIds.length;
  const actualTotal = besidePhotos.length + belowPhotos.length;
  if (actualTotal !== expectedTotal) {
    return null; // Some photos were removed — need full regeneration
  }
  
  // 4. Pack BESIDE at height = 1.0 with SAME row count (no shuffle)
  let besideResult: { cells: NormalizedCell[]; width: number; height: number };
  let heroRowWidth: number;
  
  if (besidePhotos.length === 0) {
    // No BESIDE region — hero takes full width
    besideResult = { cells: [], width: 0, height: 1.0 };
    heroRowWidth = scaledHeroAR;
  } else {
    besideResult = packToFillHeight(
      besidePhotos,
      1.0,
      normalizedGap,
      metadata.besideRowCount,
      tuning,
      false // No shuffle — deterministic
    );
    heroRowWidth = scaledHeroAR + normalizedGap + besideResult.width;
  }
  
  // 5. Pack BELOW at new width with SAME row count (no shuffle)
  const belowResult = packToFillWidth(
    belowPhotos,
    heroRowWidth,
    normalizedGap,
    metadata.belowRowCount,
    tuning,
    false // No shuffle — deterministic
  );
  
  // 6. Convert to normalized cells with position adjustments
  const cells = convertToNormalizedCells(
    heroPhoto,
    metadata.heroPosition,
    scaledHeroAR,
    besideResult.cells,
    belowResult.cells,
    belowResult.height,
    normalizedGap,
    heroRowWidth
  );
  
  // Calculate normalized canvas dimensions (with border)
  const normalizedWidth = heroRowWidth + 2 * normalizedGap;
  const normalizedHeight = 1.0 + normalizedGap + belowResult.height + 2 * normalizedGap;
  
  return {
    normalizedWidth,
    normalizedHeight,
    normalizedCells: cells,
    metadata: { ...metadata }, // Preserve topology unchanged
  };
}

// ============================================================================
// Pixel Conversion
// ============================================================================

/**
 * Convert normalized layout to pixel coordinates.
 * Uses VIRTUAL_CANVAS_BASE (1000) as the scale factor.
 */
export function normalizedToPixels(
  normalized: NormalizedLayout
): { width: number; height: number; cells: { photoId: string; x: number; y: number; width: number; height: number }[] } {
  return {
    width: Math.round(normalized.normalizedWidth * VIRTUAL_CANVAS_BASE),
    height: Math.round(normalized.normalizedHeight * VIRTUAL_CANVAS_BASE),
    cells: normalized.normalizedCells.map(cell => ({
      photoId: cell.photoId,
      x: cell.x * VIRTUAL_CANVAS_BASE,
      y: cell.y * VIRTUAL_CANVAS_BASE,
      width: cell.width * VIRTUAL_CANVAS_BASE,
      height: cell.height * VIRTUAL_CANVAS_BASE,
    })),
  };
}

// ============================================================================
// Helper: Convert to Normalized Cells
// ============================================================================

/**
 * Convert packed regions to final normalized cell coordinates.
 * Handles all four corner positions.
 */
function convertToNormalizedCells(
  heroPhoto: PhotoDimension,
  position: string,
  heroAR: number,
  besideCells: NormalizedCell[],
  belowCells: NormalizedCell[],
  belowHeight: number,
  normalizedGap: number,
  normalizedWidth: number
): NormalizedCell[] {
  const cells: NormalizedCell[] = [];
  
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
