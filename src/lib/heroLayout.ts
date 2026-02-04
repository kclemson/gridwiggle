import { PhotoItem, CollageLayout, CollageCell, CollageSettings } from '@/types/collage';
import { getDisplayCrop } from '@/lib/cropUtils';
import { packPhotosIntoRegion } from '@/lib/collageLayout';

// ============================================================================
// Constants
// ============================================================================

const MIN_DIMENSION = 100;
const BASE_WIDTH = 1200;

/** Maximum scaling tolerance (10% = up to 5% crop per edge, symmetric) */
const SCALE_TOLERANCE = 0.10;

// ============================================================================
// Types
// ============================================================================

interface PhotoDimension {
  id: string;
  width: number;
  height: number;
  aspectRatio: number;
  weight: number;
}

// ============================================================================
// Helpers
// ============================================================================

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getPhotoDimensions(photos: PhotoItem[], weights: Record<string, number>): PhotoDimension[] {
  return photos.map((photo) => {
    const crop = getDisplayCrop(photo);
    const width = crop ? crop.width : photo.originalWidth;
    const height = crop ? crop.height : photo.originalHeight;
    return {
      id: photo.id,
      width,
      height,
      aspectRatio: width / height,
      weight: weights[photo.id] ?? 1,
    };
  });
}

// ============================================================================
// Hero Width Calculation
// ============================================================================

/**
 * Calculate hero width as a fraction of canvas width.
 * Reduced fractions since hero now spans 2 rows (taller).
 */
function calculateHeroWidthFraction(standardCount: number): number {
  if (standardCount <= 4) {
    return 0.55; // Reduced from 0.65 - hero is now 2-rows tall
  } else if (standardCount <= 8) {
    return 0.45; // Reduced from 0.55
  } else if (standardCount <= 15) {
    return 0.40; // Reduced from 0.48
  } else {
    return 0.35; // Reduced from 0.40
  }
}

// ============================================================================
// Multi-Row Beside Packing (Hero Spans 2 or 3 Rows)
// ============================================================================

interface PackResult {
  cells: CollageCell[];
  combinedHeight: number;
  naturalTotalWidth: number;
  usedIds: Set<string>;
}

/**
 * Pack photos beside the hero into exactly 2 rows.
 * 
 * INDEPENDENT ROW SCALING: Each row fills targetWidth exactly.
 * This eliminates blank rectangles from mismatched row widths.
 * 
 * The hero will span both rows (2× height of individual photos).
 */
function packBesideAs2Rows(
  photos: PhotoDimension[],
  targetWidth: number,
  gap: number,
  offsetX: number
): PackResult {
  if (photos.length < 2) {
    return { cells: [], combinedHeight: 0, naturalTotalWidth: 0, usedIds: new Set() };
  }

  // Split photos roughly evenly between 2 rows
  const midpoint = Math.ceil(photos.length / 2);
  const row1Photos = photos.slice(0, midpoint);
  const row2Photos = photos.slice(midpoint);

  if (row2Photos.length === 0) {
    return { cells: [], combinedHeight: 0, naturalTotalWidth: 0, usedIds: new Set() };
  }

  // Calculate height for each row to fill targetWidth exactly
  const row1AspectSum = row1Photos.reduce((sum, p) => sum + p.aspectRatio, 0);
  const row2AspectSum = row2Photos.reduce((sum, p) => sum + p.aspectRatio, 0);

  const row1Gaps = gap * Math.max(0, row1Photos.length - 1);
  const row2Gaps = gap * Math.max(0, row2Photos.length - 1);

  // FIXED: Each row height calculated to fill targetWidth exactly
  const row1Height = (targetWidth - row1Gaps) / row1AspectSum;
  const row2Height = (targetWidth - row2Gaps) / row2AspectSum;

  const combinedHeight = row1Height + gap + row2Height;

  // Build cells - each row fills targetWidth exactly (no blank rectangles)
  const cells: CollageCell[] = [];
  let x = offsetX;

  // Row 1 - fills targetWidth
  for (const photo of row1Photos) {
    const photoWidth = row1Height * photo.aspectRatio;
    cells.push({
      photoId: photo.id,
      x: Math.round(x),
      y: 0,
      width: Math.round(photoWidth),
      height: Math.round(row1Height),
    });
    x += photoWidth + gap;
  }

  // Row 2 - fills targetWidth independently
  x = offsetX;
  for (const photo of row2Photos) {
    const photoWidth = row2Height * photo.aspectRatio;
    cells.push({
      photoId: photo.id,
      x: Math.round(x),
      y: Math.round(row1Height + gap),
      width: Math.round(photoWidth),
      height: Math.round(row2Height),
    });
    x += photoWidth + gap;
  }

  return {
    cells,
    combinedHeight,
    naturalTotalWidth: targetWidth, // Both rows fill targetWidth exactly
    usedIds: new Set([...row1Photos, ...row2Photos].map(p => p.id)),
  };
}

/**
 * Pack photos beside the hero into exactly 3 rows.
 * 
 * INDEPENDENT ROW SCALING: Each row fills targetWidth exactly.
 * This gives the algorithm more flexibility for larger photosets.
 * 
 * The hero will span all 3 rows (3× height of individual photos).
 */
function packBesideAs3Rows(
  photos: PhotoDimension[],
  targetWidth: number,
  gap: number,
  offsetX: number
): PackResult {
  if (photos.length < 3) {
    return { cells: [], combinedHeight: 0, naturalTotalWidth: 0, usedIds: new Set() };
  }

  // Split into 3 roughly equal rows
  const third = Math.ceil(photos.length / 3);
  const row1Photos = photos.slice(0, third);
  const row2Photos = photos.slice(third, third * 2);
  const row3Photos = photos.slice(third * 2);

  if (row2Photos.length === 0 || row3Photos.length === 0) {
    return { cells: [], combinedHeight: 0, naturalTotalWidth: 0, usedIds: new Set() };
  }

  // Calculate height for each row to fill targetWidth exactly
  const row1AspectSum = row1Photos.reduce((sum, p) => sum + p.aspectRatio, 0);
  const row2AspectSum = row2Photos.reduce((sum, p) => sum + p.aspectRatio, 0);
  const row3AspectSum = row3Photos.reduce((sum, p) => sum + p.aspectRatio, 0);

  const row1Gaps = gap * Math.max(0, row1Photos.length - 1);
  const row2Gaps = gap * Math.max(0, row2Photos.length - 1);
  const row3Gaps = gap * Math.max(0, row3Photos.length - 1);

  const row1Height = (targetWidth - row1Gaps) / row1AspectSum;
  const row2Height = (targetWidth - row2Gaps) / row2AspectSum;
  const row3Height = (targetWidth - row3Gaps) / row3AspectSum;

  const combinedHeight = row1Height + gap + row2Height + gap + row3Height;

  // Build cells - each row fills targetWidth exactly
  const cells: CollageCell[] = [];
  let x = offsetX;
  let y = 0;

  // Row 1
  for (const photo of row1Photos) {
    const photoWidth = row1Height * photo.aspectRatio;
    cells.push({
      photoId: photo.id,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(photoWidth),
      height: Math.round(row1Height),
    });
    x += photoWidth + gap;
  }

  // Row 2
  x = offsetX;
  y = row1Height + gap;
  for (const photo of row2Photos) {
    const photoWidth = row2Height * photo.aspectRatio;
    cells.push({
      photoId: photo.id,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(photoWidth),
      height: Math.round(row2Height),
    });
    x += photoWidth + gap;
  }

  // Row 3
  x = offsetX;
  y = row1Height + gap + row2Height + gap;
  for (const photo of row3Photos) {
    const photoWidth = row3Height * photo.aspectRatio;
    cells.push({
      photoId: photo.id,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(photoWidth),
      height: Math.round(row3Height),
    });
    x += photoWidth + gap;
  }

  return {
    cells,
    combinedHeight,
    naturalTotalWidth: targetWidth, // All rows fill targetWidth exactly
    usedIds: new Set([...row1Photos, ...row2Photos, ...row3Photos].map(p => p.id)),
  };
}

/**
 * Fallback: Pack photos as a single row (for few photos or when 2-row doesn't fit).
 * Uses tolerance-based scaling to fill available width.
 */
function packBesideAs1Row(
  photos: PhotoDimension[],
  targetHeight: number,
  availableWidth: number,
  gap: number,
  offsetX: number
): { cells: CollageCell[]; usedIds: Set<string> } {
  if (photos.length === 0 || availableWidth < MIN_DIMENSION) {
    return { cells: [], usedIds: new Set() };
  }

  // Calculate natural widths at target height
  const naturalWidths = photos.map(p => targetHeight * p.aspectRatio);
  const gapsTotal = gap * Math.max(0, photos.length - 1);
  const naturalTotalWidth = naturalWidths.reduce((a, b) => a + b, 0) + gapsTotal;

  // Check if within tolerance
  const scaleFactor = availableWidth / naturalTotalWidth;
  
  if (scaleFactor < (1 - SCALE_TOLERANCE) || scaleFactor > (1 + SCALE_TOLERANCE)) {
    // Outside tolerance - can't pack all photos
    // Try with fewer photos
    if (photos.length > 1) {
      return packBesideAs1Row(photos.slice(0, -1), targetHeight, availableWidth, gap, offsetX);
    }
    return { cells: [], usedIds: new Set() };
  }

  // Scale widths to fit exactly
  const cells: CollageCell[] = [];
  let x = offsetX;

  for (let i = 0; i < photos.length; i++) {
    const scaledWidth = naturalWidths[i] * scaleFactor;
    cells.push({
      photoId: photos[i].id,
      x: Math.round(x),
      y: 0,
      width: Math.round(scaledWidth),
      height: Math.round(targetHeight),
    });
    x += scaledWidth + gap;
  }

  return {
    cells,
    usedIds: new Set(photos.map(p => p.id)),
  };
}

// ============================================================================
// Zone Packing Functions
// ============================================================================

/**
 * Pack photos into full-width rows (for below zone).
 */
function packRowsFullWidth(
  photos: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  offsetY: number
): CollageCell[] {
  if (photos.length === 0) return [];

  const result = packPhotosIntoRegion(photos, {
    width: canvasWidth,
    gap,
    offsetX: 0,
    offsetY,
    isLandscape: true,
  });

  return result.cells;
}

// ============================================================================
// Edge-Anchored Hero Layout (Row-Based)
// ============================================================================

/**
 * Generate layout with edge-anchored hero using 2-row beside packing.
 * 
 * NEW APPROACH (2-row hero):
 * 1. Pack beside photos into 2 rows first (natural row heights)
 * 2. Hero height = combined height of both rows (hero spans 2 rows)
 * 3. Hero width = heroHeight × heroAspect
 * 4. Verify total width fits canvas; scale within tolerance
 * 5. Overflow goes to full-width rows below
 * 
 * This guarantees the hero is ~2× the size of any adjacent photo.
 */
function generateEdgeAnchoredHeroLayout(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  randomize: boolean
): CollageLayout {
  const shuffled = randomize ? shuffleArray(standards) : standards;
  
  // Determine anchor side
  const anchorRight = randomize ? Math.random() < 0.5 : false;

  // For < 4 standards, fall back to 1-row mode
  if (standards.length < 4) {
    return generateEdgeAnchoredHeroLayout1Row(hero, shuffled, canvasWidth, gap, anchorRight);
  }

  const widthFraction = calculateHeroWidthFraction(standards.length);
  const targetBesideWidth = Math.round(canvasWidth * (1 - widthFraction)) - gap;

  // ADAPTIVE APPROACH: Try 3-row first for large sets, then 2-row
  
  // Try 3-row packing for larger photosets (8+ photos)
  if (standards.length >= 8) {
    for (let besideCount = Math.min(9, standards.length); besideCount >= 6; besideCount--) {
      const besidePhotos = shuffled.slice(0, besideCount);
      
      const packResult = packBesideAs3Rows(besidePhotos, targetBesideWidth, gap, 0);
      
      if (packResult.combinedHeight === 0) continue;
      
      // UNIFIED SCALING: Hero height = beside combined height (3 rows)
      const heroHeight = packResult.combinedHeight;
      const heroWidth = heroHeight * hero.aspectRatio;
      
      // Check if total fits within relaxed tolerance (±15%)
      const totalNaturalWidth = heroWidth + gap + packResult.naturalTotalWidth;
      const scaleFactor = canvasWidth / totalNaturalWidth;
      
      if (scaleFactor < 0.85 || scaleFactor > 1.15) {
        continue; // Try fewer photos
      }
      
      // HORIZONTAL-ONLY SCALING for beside cells
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

      // Scale beside cells (horizontal + uniform vertical)
      const besideOffsetX = anchorRight ? 0 : scaledHeroWidth + gap;
      const adjustedBesideCells = packResult.cells.map(cell => ({
        ...cell,
        x: Math.round(besideOffsetX + (cell.x * horizontalScale)),
        y: Math.round(cell.y * scaleFactor),
        width: Math.round(cell.width * horizontalScale),
        height: Math.round(cell.height * scaleFactor),
      }));

      // Pack below zone with remaining photos
      const belowPhotos = shuffled.slice(besideCount);
      const belowY = scaledHeroHeight + gap;
      const belowCells = packRowsFullWidth(belowPhotos, canvasWidth, gap, belowY);

      // Assemble
      const allCells = [heroCell, ...adjustedBesideCells, ...belowCells];
      const finalHeight = allCells.length > 0
        ? Math.max(...allCells.map(c => c.y + c.height))
        : scaledHeroHeight;

      return {
        width: canvasWidth,
        height: Math.round(finalHeight),
        cells: allCells,
      };
    }
  }

  // Try 2-row packing (4+ photos)
  for (let besideCount = Math.min(6, standards.length); besideCount >= 4; besideCount--) {
    const besidePhotos = shuffled.slice(0, besideCount);
    
    // Pack beside photos into 2 rows (get their natural dimensions)
    const packResult = packBesideAs2Rows(besidePhotos, targetBesideWidth, gap, 0);
    
    if (packResult.combinedHeight === 0) continue;
    
    // UNIFIED SCALING: Hero height = beside combined height (2 rows)
    const heroHeight = packResult.combinedHeight;
    const heroWidth = heroHeight * hero.aspectRatio;
    
    // Check if total fits within relaxed tolerance (±15%)
    const totalNaturalWidth = heroWidth + gap + packResult.naturalTotalWidth;
    const scaleFactor = canvasWidth / totalNaturalWidth;
    
    if (scaleFactor < 0.85 || scaleFactor > 1.15) {
      continue; // Try fewer photos
    }
    
    // HORIZONTAL-ONLY SCALING for beside cells
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

    // Scale beside cells (horizontal + uniform vertical)
    const besideOffsetX = anchorRight ? 0 : scaledHeroWidth + gap;
    const adjustedBesideCells = packResult.cells.map(cell => ({
      ...cell,
      x: Math.round(besideOffsetX + (cell.x * horizontalScale)),
      y: Math.round(cell.y * scaleFactor),
      width: Math.round(cell.width * horizontalScale),
      height: Math.round(cell.height * scaleFactor),
    }));

    // Pack below zone with remaining photos
    const belowPhotos = shuffled.slice(besideCount);
    const belowY = scaledHeroHeight + gap;
    const belowCells = packRowsFullWidth(belowPhotos, canvasWidth, gap, belowY);

    // Assemble
    const allCells = [heroCell, ...adjustedBesideCells, ...belowCells];
    const finalHeight = allCells.length > 0
      ? Math.max(...allCells.map(c => c.y + c.height))
      : scaledHeroHeight;

    return {
      width: canvasWidth,
      height: Math.round(finalHeight),
      cells: allCells,
    };
  }

  // No working multi-row config found - fallback to 1-row
  return generateEdgeAnchoredHeroLayout1Row(hero, shuffled, canvasWidth, gap, anchorRight);
}

/**
 * 1-row fallback for edge-anchored hero (few photos).
 */
function generateEdgeAnchoredHeroLayout1Row(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  anchorRight: boolean
): CollageLayout {
  const widthFraction = calculateHeroWidthFraction(standards.length);
  const heroWidth = Math.round(canvasWidth * widthFraction);
  const heroHeight = heroWidth / hero.aspectRatio;

  const availableBesideWidth = canvasWidth - heroWidth - gap;
  const besideStartX = anchorRight ? 0 : heroWidth + gap;
  
  const { cells: besideCells, usedIds } = packBesideAs1Row(
    standards,
    heroHeight,
    availableBesideWidth,
    gap,
    besideStartX
  );

  const belowPhotos = standards.filter(p => !usedIds.has(p.id));

  const heroX = anchorRight ? canvasWidth - heroWidth : 0;
  const heroCell: CollageCell = {
    photoId: hero.id,
    x: heroX,
    y: 0,
    width: heroWidth,
    height: Math.round(heroHeight),
  };

  const belowY = Math.round(heroHeight) + gap;
  const belowCells = packRowsFullWidth(belowPhotos, canvasWidth, gap, belowY);

  const allCells = [heroCell, ...besideCells, ...belowCells];
  const finalHeight = allCells.length > 0
    ? Math.max(...allCells.map(c => c.y + c.height))
    : heroHeight;

  return {
    width: canvasWidth,
    height: Math.round(finalHeight),
    cells: allCells,
  };
}

// ============================================================================
// Floating Hero Layout (2-Row, for Many Photos)
// ============================================================================

/**
 * Generate layout with floating hero using 2-row packing on both sides.
 * 
 * For many photos, hero is positioned between left and right zones.
 * Each side uses 2-row packing, hero spans the combined height.
 */
function generateFloatingHeroLayout(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  randomize: boolean
): CollageLayout {
  const shuffled = randomize ? shuffleArray(standards) : standards;
  
  // Split: ~30% left, ~30% right, rest below
  const leftCount = Math.min(4, Math.ceil(standards.length * 0.25));
  const rightCount = Math.min(4, Math.ceil(standards.length * 0.25));
  
  const leftCandidates = shuffled.slice(0, leftCount);
  const rightCandidates = shuffled.slice(leftCount, leftCount + rightCount);
  const initialBelowPhotos = shuffled.slice(leftCount + rightCount);

  // Target width fraction for hero
  const widthFraction = calculateHeroWidthFraction(standards.length);
  const targetHeroWidth = Math.round(canvasWidth * widthFraction);
  const targetSideWidth = Math.floor((canvasWidth - targetHeroWidth - 2 * gap) / 2);

  // Pack left side into 2 rows
  const leftResult = packBesideAs2Rows(leftCandidates, targetSideWidth, gap, 0);
  
  // Pack right side into 2 rows
  const rightResult = packBesideAs2Rows(rightCandidates, targetSideWidth, gap, 0);

  // Use the taller side to determine hero height
  const maxSideHeight = Math.max(
    leftResult.combinedHeight || 0,
    rightResult.combinedHeight || 0
  );

  if (maxSideHeight === 0) {
    // Fallback if neither side could be packed
    return generateEdgeAnchoredHeroLayout(hero, standards, canvasWidth, gap, randomize);
  }

  // UNIFIED SCALING: Hero height = side combined height (shared by construction)
  const heroHeight = maxSideHeight;
  const heroWidth = heroHeight * hero.aspectRatio;
  
  // Calculate natural widths using the actual packed widths
  const leftNaturalWidth = leftResult.naturalTotalWidth || 0;
  const rightNaturalWidth = rightResult.naturalTotalWidth || 0;
  const totalNaturalWidth = leftNaturalWidth + (leftNaturalWidth > 0 ? gap : 0) + 
                            heroWidth + 
                            (rightNaturalWidth > 0 ? gap : 0) + rightNaturalWidth;
  
  const scaleFactor = canvasWidth / totalNaturalWidth;
  
  if (scaleFactor < 0.85 || scaleFactor > 1.15) {
    // Outside tolerance - fall back to edge-anchored
    return generateEdgeAnchoredHeroLayout(hero, standards, canvasWidth, gap, randomize);
  }

  // Apply unified scale factor
  const scaledHeroWidth = Math.round(heroWidth * scaleFactor);
  const scaledHeroHeight = Math.round(heroHeight * scaleFactor);
  const scaledLeftWidth = Math.round(leftNaturalWidth * scaleFactor);
  const scaledRightWidth = Math.round(rightNaturalWidth * scaleFactor);
  
  // Position hero (centered between scaled sides)
  const heroX = leftNaturalWidth > 0 ? scaledLeftWidth + gap : 0;
  
  const heroCell: CollageCell = {
    photoId: hero.id,
    x: heroX,
    y: 0,
    width: scaledHeroWidth,
    height: scaledHeroHeight,
  };

  // Scale left cells with horizontal-only scaling within their zone
  const leftHorizontalScale = leftNaturalWidth > 0 ? scaledLeftWidth / leftNaturalWidth : 1;
  const leftCells = leftResult.cells.map(cell => ({
    ...cell,
    x: Math.round(cell.x * leftHorizontalScale),
    y: Math.round(cell.y * scaleFactor),
    width: Math.round(cell.width * leftHorizontalScale),
    height: Math.round(cell.height * scaleFactor),
  }));

  // Scale right cells with horizontal-only scaling within their zone
  const rightStartX = heroX + scaledHeroWidth + gap;
  const rightHorizontalScale = rightNaturalWidth > 0 ? scaledRightWidth / rightNaturalWidth : 1;
  const rightCells = rightResult.cells.map(cell => ({
    ...cell,
    x: rightStartX + Math.round(cell.x * rightHorizontalScale),
    y: Math.round(cell.y * scaleFactor),
    width: Math.round(cell.width * rightHorizontalScale),
    height: Math.round(cell.height * scaleFactor),
  }));

  // Collect unused photos for below zone
  const belowPhotos = [
    ...leftCandidates.filter(p => !leftResult.usedIds.has(p.id)),
    ...rightCandidates.filter(p => !rightResult.usedIds.has(p.id)),
    ...initialBelowPhotos,
  ];

  // Pack below zone
  const belowY = scaledHeroHeight + gap;
  const belowCells = packRowsFullWidth(belowPhotos, canvasWidth, gap, belowY);

  // Assemble
  const allCells = [...leftCells, heroCell, ...rightCells, ...belowCells];
  const finalHeight = allCells.length > 0
    ? Math.max(...allCells.map(c => c.y + c.height))
    : scaledHeroHeight;

  return {
    width: canvasWidth,
    height: Math.round(finalHeight),
    cells: allCells,
  };
}

// ============================================================================
// Main Entry Points
// ============================================================================

// Thresholds for adaptive strategy based on photo count
const FEW_PHOTOS_THRESHOLD = 8;

/**
 * Generate layout for a single hero photo.
 * Uses adaptive strategy based on standard photo count.
 */
function generateSingleHeroLayout(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  randomize: boolean
): CollageLayout {
  // Use edge-anchored layout for few photos (simpler, cleaner)
  if (standards.length < FEW_PHOTOS_THRESHOLD) {
    return generateEdgeAnchoredHeroLayout(
      hero, standards, canvasWidth, gap, randomize
    );
  }

  // Use floating layout for many photos (more variety)
  return generateFloatingHeroLayout(
    hero, standards, canvasWidth, gap, randomize
  );
}

/**
 * Handle multiple heroes by processing them sequentially.
 * Each hero uses 2-row beside packing.
 */
function generateMultiHeroLayout(
  heroes: PhotoDimension[],
  standards: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  randomize: boolean
): CollageLayout {
  const orderedHeroes = randomize ? shuffleArray([...heroes]) : heroes;

  // Distribute standards among heroes proportionally
  const standardsPerHero = Math.ceil(standards.length / heroes.length);
  const shuffledStandards = randomize ? shuffleArray(standards) : standards;

  const allCells: CollageCell[] = [];
  let currentY = 0;

  for (let i = 0; i < orderedHeroes.length; i++) {
    const hero = orderedHeroes[i];
    const isLast = i === orderedHeroes.length - 1;

    // Get this hero's share of standards
    const startIdx = i * standardsPerHero;
    const endIdx = isLast ? standards.length : startIdx + standardsPerHero;
    const heroStandards = shuffledStandards.slice(startIdx, endIdx);

    // Determine anchor side (alternating)
    const anchorRight = randomize ? Math.random() < 0.5 : (i % 2 === 1);

    // Try 2-row packing with iterative approach if we have enough photos
    if (heroStandards.length >= 4) {
      const widthFraction = calculateHeroWidthFraction(heroStandards.length);
      const targetBesideWidth = Math.round(canvasWidth * (1 - widthFraction)) - gap;
      
      // Iterative approach: try different beside counts
      let found2RowConfig = false;
      for (let besideCount = Math.min(6, heroStandards.length); besideCount >= 4; besideCount--) {
        const besidePhotos = heroStandards.slice(0, besideCount);
        
        const packResult = packBesideAs2Rows(besidePhotos, targetBesideWidth, gap, 0);
        
        if (packResult.combinedHeight === 0) continue;

        // UNIFIED SCALING: Hero height = beside combined height
        const heroHeight = packResult.combinedHeight;
        const heroWidth = heroHeight * hero.aspectRatio;
        const totalNaturalWidth = heroWidth + gap + packResult.naturalTotalWidth;
        const scaleFactor = canvasWidth / totalNaturalWidth;

        if (scaleFactor >= 0.85 && scaleFactor <= 1.15) {
          // Horizontal-only scaling for beside cells
          const scaledHeroWidth = Math.round(heroWidth * scaleFactor);
          const scaledHeroHeight = Math.round(heroHeight * scaleFactor);
          const availableBesideWidth = canvasWidth - scaledHeroWidth - gap;
          const horizontalScale = availableBesideWidth / packResult.naturalTotalWidth;
          
          const heroX = anchorRight ? canvasWidth - scaledHeroWidth : 0;
          const besideOffsetX = anchorRight ? 0 : scaledHeroWidth + gap;

          // Add hero
          allCells.push({
            photoId: hero.id,
            x: heroX,
            y: currentY,
            width: scaledHeroWidth,
            height: scaledHeroHeight,
          });

          // Add beside cells with horizontal-only scaling
          const adjustedBesideCells = packResult.cells.map(cell => ({
            ...cell,
            x: Math.round(besideOffsetX + (cell.x * horizontalScale)),
            y: currentY + Math.round(cell.y * scaleFactor),
            width: Math.round(cell.width * horizontalScale),
            height: Math.round(cell.height * scaleFactor),
          }));
          allCells.push(...adjustedBesideCells);

          currentY += scaledHeroHeight + gap;

          // Pack remaining photos below
          const belowPhotos = heroStandards.slice(besideCount);
          if (belowPhotos.length > 0) {
            const belowCells = packRowsFullWidth(belowPhotos, canvasWidth, gap, currentY);
            allCells.push(...belowCells);
            if (belowCells.length > 0) {
              currentY = Math.max(...belowCells.map(c => c.y + c.height)) + gap;
            }
          }
          found2RowConfig = true;
          break; // Found working config, move to next hero
        }
      }
      
      if (found2RowConfig) continue; // Next hero
    }

    // Fallback to 1-row for this hero
    const widthFraction = calculateHeroWidthFraction(heroStandards.length);
    const heroWidth = Math.round(canvasWidth * widthFraction);
    const heroHeight = heroWidth / hero.aspectRatio;

    const availableBesideWidth = canvasWidth - heroWidth - gap;
    const besideStartX = anchorRight ? 0 : heroWidth + gap;
    
    const { cells: besideCells, usedIds } = packBesideAs1Row(
      heroStandards,
      heroHeight,
      availableBesideWidth,
      gap,
      besideStartX
    );

    const heroX = anchorRight ? canvasWidth - heroWidth : 0;

    allCells.push({
      photoId: hero.id,
      x: heroX,
      y: currentY,
      width: heroWidth,
      height: Math.round(heroHeight),
    });

    const adjustedBesideCells = besideCells.map(cell => ({
      ...cell,
      y: currentY,
    }));
    allCells.push(...adjustedBesideCells);

    currentY += Math.round(heroHeight) + gap;

    // Pack below for this hero
    const belowPhotos = heroStandards.filter(p => !usedIds.has(p.id));
    if (belowPhotos.length > 0) {
      const belowCells = packRowsFullWidth(belowPhotos, canvasWidth, gap, currentY);
      allCells.push(...belowCells);
      if (belowCells.length > 0) {
        currentY = Math.max(...belowCells.map(c => c.y + c.height)) + gap;
      }
    }
  }

  const finalHeight = allCells.length > 0
    ? Math.max(...allCells.map(c => c.y + c.height))
    : 800;

  return {
    width: canvasWidth,
    height: Math.round(finalHeight),
    cells: allCells,
  };
}

// ============================================================================
// Public API
// ============================================================================

export function generateHeroLayout(
  photos: PhotoItem[],
  settings: CollageSettings,
  targetAspect: number | undefined,
  weights: Record<string, number>,
  randomize: boolean
): CollageLayout {
  const gap = settings.gapSize;

  const dims = getPhotoDimensions(photos, weights);
  const heroes = dims.filter(d => d.weight >= 2.0);
  const standards = dims.filter(d => d.weight < 2.0);

  if (heroes.length === 0) {
    // Fallback: no heroes, return empty (caller should not have routed here)
    return { width: BASE_WIDTH, height: 800, cells: [] };
  }

  if (heroes.length === 1) {
    return generateSingleHeroLayout(
      heroes[0],
      standards,
      BASE_WIDTH,
      gap,
      randomize
    );
  }

  return generateMultiHeroLayout(
    heroes,
    standards,
    BASE_WIDTH,
    gap,
    randomize
  );
}

/**
 * Check if a photo set has heroes that should use hero layout
 */
export function hasHeroPhotos(photos: PhotoItem[], weights: Record<string, number>): boolean {
  const dims = getPhotoDimensions(photos, weights);
  const heroes = dims.filter(d => d.weight >= 2.0);
  const standards = dims.filter(d => d.weight < 2.0);

  // Need at least one hero AND at least one standard
  return heroes.length > 0 && standards.length > 0;
}
