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
// 2-Row Beside Packing (Hero Spans Both Rows)
// ============================================================================

/**
 * Pack photos beside the hero into exactly 2 rows.
 * The hero will span both rows (2× height of individual photos).
 * 
 * This inverts the dependency:
 * - Pack beside photos into 2 rows first (natural row heights)
 * - Hero height = combined height of both rows
 * - Hero width = heroHeight × heroAspect
 * 
 * Returns combined height so caller can size the hero accordingly.
 */
function packBesideAs2Rows(
  photos: PhotoDimension[],
  targetWidth: number,
  gap: number,
  offsetX: number
): { 
  cells: CollageCell[]; 
  combinedHeight: number; 
  row1Height: number;
  row2Height: number;
  usedIds: Set<string>;
} {
  if (photos.length < 2) {
    // Not enough for 2 rows - return empty
    return { cells: [], combinedHeight: 0, row1Height: 0, row2Height: 0, usedIds: new Set() };
  }

  // Split photos roughly evenly between 2 rows
  const midpoint = Math.ceil(photos.length / 2);
  const row1Photos = photos.slice(0, midpoint);
  const row2Photos = photos.slice(midpoint);

  if (row2Photos.length === 0) {
    // Only 1 photo - can't make 2 rows
    return { cells: [], combinedHeight: 0, row1Height: 0, row2Height: 0, usedIds: new Set() };
  }

  // Calculate natural height for each row at targetWidth
  const row1AspectSum = row1Photos.reduce((sum, p) => sum + p.aspectRatio, 0);
  const row2AspectSum = row2Photos.reduce((sum, p) => sum + p.aspectRatio, 0);

  const row1Gaps = gap * Math.max(0, row1Photos.length - 1);
  const row2Gaps = gap * Math.max(0, row2Photos.length - 1);

  const row1Height = (targetWidth - row1Gaps) / row1AspectSum;
  const row2Height = (targetWidth - row2Gaps) / row2AspectSum;

  const combinedHeight = row1Height + gap + row2Height;

  // Build cells for row 1
  const cells: CollageCell[] = [];
  let x = offsetX;
  
  for (const photo of row1Photos) {
    const photoWidth = row1Height * photo.aspectRatio;
    cells.push({
      photoId: photo.id,
      x: Math.round(x),
      y: 0, // Will be adjusted by caller
      width: Math.round(photoWidth),
      height: Math.round(row1Height),
    });
    x += photoWidth + gap;
  }

  // Build cells for row 2
  x = offsetX;
  for (const photo of row2Photos) {
    const photoWidth = row2Height * photo.aspectRatio;
    cells.push({
      photoId: photo.id,
      x: Math.round(x),
      y: Math.round(row1Height + gap), // Below row 1
      width: Math.round(photoWidth),
      height: Math.round(row2Height),
    });
    x += photoWidth + gap;
  }

  return {
    cells,
    combinedHeight,
    row1Height,
    row2Height,
    usedIds: new Set([...row1Photos, ...row2Photos].map(p => p.id)),
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

  // Target: hero takes a fraction of width, beside photos get the rest
  const widthFraction = calculateHeroWidthFraction(standards.length);
  const targetBesideWidth = Math.round(canvasWidth * (1 - widthFraction)) - gap;
  
  // Determine how many photos to use beside (4-6 for 2 rows)
  const besideCount = Math.min(6, Math.max(4, Math.ceil(standards.length * 0.4)));
  const besidePhotos = shuffled.slice(0, besideCount);
  const belowPhotos = shuffled.slice(besideCount);

  // Pack beside photos into 2 rows
  const besideStartX = anchorRight ? 0 : 0; // We'll adjust after calculating hero width
  const { cells: rawBesideCells, combinedHeight, usedIds } = packBesideAs2Rows(
    besidePhotos,
    targetBesideWidth,
    gap,
    0 // Temporary offset, will adjust
  );

  if (combinedHeight === 0) {
    // Fallback to 1-row if 2-row packing fails
    return generateEdgeAnchoredHeroLayout1Row(hero, shuffled, canvasWidth, gap, anchorRight);
  }

  // Hero height = combined height of 2 beside rows
  const heroHeight = combinedHeight;
  const naturalHeroWidth = heroHeight * hero.aspectRatio;
  
  // Check if hero width + beside width fits canvas within tolerance
  const totalNaturalWidth = naturalHeroWidth + gap + targetBesideWidth;
  const scaleFactor = canvasWidth / totalNaturalWidth;
  
  if (scaleFactor < (1 - SCALE_TOLERANCE) || scaleFactor > (1 + SCALE_TOLERANCE)) {
    // Outside tolerance - fall back to 1-row
    return generateEdgeAnchoredHeroLayout1Row(hero, shuffled, canvasWidth, gap, anchorRight);
  }

  // Scale to fit canvas exactly
  const heroWidth = Math.round(naturalHeroWidth * scaleFactor);
  const actualBesideWidth = canvasWidth - heroWidth - gap;
  const besideScaleFactor = actualBesideWidth / targetBesideWidth;

  // Position hero
  const heroX = anchorRight ? canvasWidth - heroWidth : 0;
  const heroCell: CollageCell = {
    photoId: hero.id,
    x: heroX,
    y: 0,
    width: heroWidth,
    height: Math.round(heroHeight * scaleFactor),
  };

  // Adjust beside cells with correct offset and scaling
  const besideOffsetX = anchorRight ? 0 : heroWidth + gap;
  const adjustedBesideCells = rawBesideCells.map(cell => ({
    ...cell,
    x: Math.round(besideOffsetX + (cell.x * besideScaleFactor)),
    y: Math.round(cell.y * scaleFactor),
    width: Math.round(cell.width * besideScaleFactor),
    height: Math.round(cell.height * scaleFactor),
  }));

  // Pack below zone with remaining photos
  const actualHeroHeight = Math.round(heroHeight * scaleFactor);
  const belowY = actualHeroHeight + gap;
  const allBelowPhotos = [...belowPhotos, ...besidePhotos.filter(p => !usedIds.has(p.id))];
  const belowCells = packRowsFullWidth(allBelowPhotos, canvasWidth, gap, belowY);

  // Assemble
  const allCells = [heroCell, ...adjustedBesideCells, ...belowCells];
  const finalHeight = allCells.length > 0
    ? Math.max(...allCells.map(c => c.y + c.height))
    : actualHeroHeight;

  return {
    width: canvasWidth,
    height: Math.round(finalHeight),
    cells: allCells,
  };
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

  // Hero matches the combined height
  const heroHeight = maxSideHeight;
  const naturalHeroWidth = heroHeight * hero.aspectRatio;
  
  // Calculate actual widths
  const actualLeftWidth = leftResult.cells.length > 0 ? targetSideWidth : 0;
  const actualRightWidth = rightResult.cells.length > 0 ? targetSideWidth : 0;
  const totalNaturalWidth = actualLeftWidth + (actualLeftWidth > 0 ? gap : 0) + 
                            naturalHeroWidth + 
                            (actualRightWidth > 0 ? gap : 0) + actualRightWidth;
  
  const scaleFactor = canvasWidth / totalNaturalWidth;
  
  if (scaleFactor < (1 - SCALE_TOLERANCE) || scaleFactor > (1 + SCALE_TOLERANCE)) {
    // Outside tolerance - fall back to edge-anchored
    return generateEdgeAnchoredHeroLayout(hero, standards, canvasWidth, gap, randomize);
  }

  // Scale everything
  const heroWidth = Math.round(naturalHeroWidth * scaleFactor);
  const heroX = actualLeftWidth > 0 
    ? Math.round(actualLeftWidth * scaleFactor) + gap 
    : 0;
  
  const heroCell: CollageCell = {
    photoId: hero.id,
    x: heroX,
    y: 0,
    width: heroWidth,
    height: Math.round(heroHeight * scaleFactor),
  };

  // Adjust left cells
  const leftCells = leftResult.cells.map(cell => ({
    ...cell,
    x: Math.round(cell.x * scaleFactor),
    y: Math.round(cell.y * scaleFactor),
    width: Math.round(cell.width * scaleFactor),
    height: Math.round(cell.height * scaleFactor),
  }));

  // Adjust right cells
  const rightStartX = heroX + heroWidth + gap;
  const rightCells = rightResult.cells.map(cell => ({
    ...cell,
    x: rightStartX + Math.round(cell.x * scaleFactor),
    y: Math.round(cell.y * scaleFactor),
    width: Math.round(cell.width * scaleFactor),
    height: Math.round(cell.height * scaleFactor),
  }));

  // Collect unused photos for below zone
  const belowPhotos = [
    ...leftCandidates.filter(p => !leftResult.usedIds.has(p.id)),
    ...rightCandidates.filter(p => !rightResult.usedIds.has(p.id)),
    ...initialBelowPhotos,
  ];

  // Pack below zone
  const actualHeroHeight = Math.round(heroHeight * scaleFactor);
  const belowY = actualHeroHeight + gap;
  const belowCells = packRowsFullWidth(belowPhotos, canvasWidth, gap, belowY);

  // Assemble
  const allCells = [...leftCells, heroCell, ...rightCells, ...belowCells];
  const finalHeight = allCells.length > 0
    ? Math.max(...allCells.map(c => c.y + c.height))
    : actualHeroHeight;

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

    // Try 2-row packing if we have enough photos
    if (heroStandards.length >= 4) {
      const widthFraction = calculateHeroWidthFraction(heroStandards.length);
      const targetBesideWidth = Math.round(canvasWidth * (1 - widthFraction)) - gap;
      
      const besideCount = Math.min(6, heroStandards.length);
      const besidePhotos = heroStandards.slice(0, besideCount);
      
      const { cells: rawBesideCells, combinedHeight, usedIds } = packBesideAs2Rows(
        besidePhotos,
        targetBesideWidth,
        gap,
        0
      );

      if (combinedHeight > 0) {
        // Hero height = combined height of 2 beside rows
        const heroHeight = combinedHeight;
        const naturalHeroWidth = heroHeight * hero.aspectRatio;
        const totalNaturalWidth = naturalHeroWidth + gap + targetBesideWidth;
        const scaleFactor = canvasWidth / totalNaturalWidth;

        if (scaleFactor >= (1 - SCALE_TOLERANCE) && scaleFactor <= (1 + SCALE_TOLERANCE)) {
          const heroWidth = Math.round(naturalHeroWidth * scaleFactor);
          const heroX = anchorRight ? canvasWidth - heroWidth : 0;
          const besideOffsetX = anchorRight ? 0 : heroWidth + gap;
          const besideScaleFactor = (canvasWidth - heroWidth - gap) / targetBesideWidth;

          // Add hero
          allCells.push({
            photoId: hero.id,
            x: heroX,
            y: currentY,
            width: heroWidth,
            height: Math.round(heroHeight * scaleFactor),
          });

          // Add beside cells
          const adjustedBesideCells = rawBesideCells.map(cell => ({
            ...cell,
            x: Math.round(besideOffsetX + (cell.x * besideScaleFactor)),
            y: currentY + Math.round(cell.y * scaleFactor),
            width: Math.round(cell.width * besideScaleFactor),
            height: Math.round(cell.height * scaleFactor),
          }));
          allCells.push(...adjustedBesideCells);

          currentY += Math.round(heroHeight * scaleFactor) + gap;

          // Pack remaining photos below
          const belowPhotos = heroStandards.filter(p => !usedIds.has(p.id));
          if (belowPhotos.length > 0) {
            const belowCells = packRowsFullWidth(belowPhotos, canvasWidth, gap, currentY);
            allCells.push(...belowCells);
            if (belowCells.length > 0) {
              currentY = Math.max(...belowCells.map(c => c.y + c.height)) + gap;
            }
          }
          continue; // Next hero
        }
      }
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
