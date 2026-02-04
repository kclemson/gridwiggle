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
 * The fraction adapts based on standard photo count.
 */
function calculateHeroWidthFraction(standardCount: number): number {
  if (standardCount <= 2) {
    return 0.65; // Few standards → hero takes most of width
  } else if (standardCount <= 5) {
    return 0.55;
  } else if (standardCount <= 10) {
    return 0.48;
  } else {
    return 0.40; // Many standards → hero is smaller
  }
}

// ============================================================================
// Row-Based Beside Packing (Shared Height with Hero)
// ============================================================================

/**
 * Pack photos beside the hero as a HORIZONTAL row sharing the hero's height.
 * Uses tolerance-based scaling to fill the available width exactly.
 * 
 * Key insight: All photos in the row share the same height (heroHeight).
 * Each photo's width = heroHeight × photoAspectRatio.
 * 
 * If the natural total width is within tolerance of availableWidth,
 * we scale all widths to fit exactly (causing symmetric cropping ≤ 10%).
 * 
 * Returns the cells and which photos were used (rest go to below zone).
 */
function packBesideRowWithTolerance(
  photos: PhotoDimension[],
  heroHeight: number,
  availableWidth: number,
  gap: number,
  offsetX: number
): { cells: CollageCell[]; usedIds: Set<string> } {
  if (photos.length === 0 || availableWidth < MIN_DIMENSION) {
    return { cells: [], usedIds: new Set() };
  }

  // Greedily add photos until we can't fit more within tolerance
  const usedPhotos: PhotoDimension[] = [];
  let remaining = [...photos];

  while (remaining.length > 0) {
    // Calculate natural widths for current selection + next candidate
    const candidate = remaining[0];
    const testPhotos = [...usedPhotos, candidate];
    
    const naturalWidths = testPhotos.map(p => heroHeight * p.aspectRatio);
    const gapsTotal = gap * Math.max(0, testPhotos.length - 1);
    const naturalTotalWidth = naturalWidths.reduce((a, b) => a + b, 0) + gapsTotal;
    
    // Check if this fits within tolerance
    const scaleFactor = availableWidth / naturalTotalWidth;
    
    if (scaleFactor >= (1 - SCALE_TOLERANCE) && scaleFactor <= (1 + SCALE_TOLERANCE)) {
      // Within tolerance - accept this photo
      usedPhotos.push(candidate);
      remaining = remaining.slice(1);
    } else if (scaleFactor > (1 + SCALE_TOLERANCE)) {
      // Too much space left - need more photos
      usedPhotos.push(candidate);
      remaining = remaining.slice(1);
    } else {
      // Would require too much scaling - stop here
      break;
    }
  }

  if (usedPhotos.length === 0) {
    return { cells: [], usedIds: new Set() };
  }

  // Calculate final scaled widths
  const naturalWidths = usedPhotos.map(p => heroHeight * p.aspectRatio);
  const gapsTotal = gap * Math.max(0, usedPhotos.length - 1);
  const naturalTotalWidth = naturalWidths.reduce((a, b) => a + b, 0) + gapsTotal;
  const scaleFactor = availableWidth / naturalTotalWidth;

  // Build cells with scaled widths
  const cells: CollageCell[] = [];
  let x = offsetX;

  for (let i = 0; i < usedPhotos.length; i++) {
    const photo = usedPhotos[i];
    const scaledWidth = naturalWidths[i] * scaleFactor;

    cells.push({
      photoId: photo.id,
      x: Math.round(x),
      y: 0, // Will be adjusted by caller
      width: Math.round(scaledWidth),
      height: Math.round(heroHeight),
    });

    x += scaledWidth + gap;
  }

  return {
    cells,
    usedIds: new Set(usedPhotos.map(p => p.id)),
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
 * Generate layout with edge-anchored hero using row-based packing.
 * 
 * New approach:
 * 1. Hero width = fraction of canvas width (based on standard count)
 * 2. Hero height = heroWidth / heroAspectRatio (exact aspect preserved)
 * 3. Beside photos share heroHeight, packed as horizontal row
 * 4. Tolerance-based scaling ensures no blank rectangles (±10%)
 * 5. Overflow goes to full-width rows below
 */
function generateEdgeAnchoredHeroLayout(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  randomize: boolean
): CollageLayout {
  // 1. Calculate hero dimensions (width as fraction, height from aspect)
  const widthFraction = calculateHeroWidthFraction(standards.length);
  const heroWidth = Math.round(canvasWidth * widthFraction);
  const heroHeight = heroWidth / hero.aspectRatio;

  // 2. Determine anchor side
  const anchorRight = randomize ? Math.random() < 0.5 : false;

  // 3. Calculate available width for beside photos
  const availableBesideWidth = canvasWidth - heroWidth - gap;

  // 4. Pack beside photos using tolerance-based row packing
  const shuffled = randomize ? shuffleArray(standards) : standards;
  const besideStartX = anchorRight ? 0 : heroWidth + gap;
  
  const { cells: besideCells, usedIds } = packBesideRowWithTolerance(
    shuffled,
    heroHeight,
    availableBesideWidth,
    gap,
    besideStartX
  );

  // 5. Remaining photos go to below zone
  const belowPhotos = shuffled.filter(p => !usedIds.has(p.id));

  // 6. Create hero cell
  const heroX = anchorRight ? canvasWidth - heroWidth : 0;
  const heroCell: CollageCell = {
    photoId: hero.id,
    x: heroX,
    y: 0,
    width: heroWidth,
    height: Math.round(heroHeight),
  };

  // 7. Adjust beside cell Y positions (they were created at y=0)
  const adjustedBesideCells = besideCells.map(cell => ({
    ...cell,
    y: 0, // Same row as hero
  }));

  // 8. Pack below zone
  const belowY = Math.round(heroHeight) + gap;
  const belowCells = packRowsFullWidth(belowPhotos, canvasWidth, gap, belowY);

  // 9. Assemble and calculate final height
  const allCells = [heroCell, ...adjustedBesideCells, ...belowCells];
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
// Floating Hero Layout (Row-Based, for Many Photos)
// ============================================================================

/**
 * Generate layout with floating hero using row-based packing on both sides.
 * 
 * For many photos, hero can be positioned with photos on left and right.
 * Both sides use the same heroHeight, packed as horizontal rows.
 */
function generateFloatingHeroLayout(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  randomize: boolean
): CollageLayout {
  // 1. Calculate hero dimensions
  const widthFraction = calculateHeroWidthFraction(standards.length);
  const heroWidth = Math.round(canvasWidth * widthFraction);
  const heroHeight = heroWidth / hero.aspectRatio;

  // 2. Distribute photos to left/right/below
  const shuffled = randomize ? shuffleArray(standards) : standards;
  
  // Split roughly: 30% left, 30% right, 40% below
  const leftTarget = Math.ceil(standards.length * 0.3);
  const rightTarget = Math.ceil(standards.length * 0.3);
  
  const leftCandidates = shuffled.slice(0, leftTarget);
  const rightCandidates = shuffled.slice(leftTarget, leftTarget + rightTarget);
  const initialBelowPhotos = shuffled.slice(leftTarget + rightTarget);

  // 3. Calculate available width for each side
  // Hero is centered, so each side gets equal space
  const sideWidth = Math.floor((canvasWidth - heroWidth - 2 * gap) / 2);

  // 4. Pack left side
  const { cells: leftCells, usedIds: leftUsed } = packBesideRowWithTolerance(
    leftCandidates,
    heroHeight,
    sideWidth,
    gap,
    0
  );

  // 5. Calculate hero X position based on actual left width used
  const actualLeftWidth = leftCells.length > 0
    ? Math.max(...leftCells.map(c => c.x + c.width))
    : 0;
  const heroX = actualLeftWidth > 0 ? actualLeftWidth + gap : 0;

  // 6. Pack right side
  const rightStartX = heroX + heroWidth + gap;
  const availableRightWidth = canvasWidth - rightStartX;
  
  const { cells: rightCells, usedIds: rightUsed } = packBesideRowWithTolerance(
    rightCandidates,
    heroHeight,
    availableRightWidth,
    gap,
    rightStartX
  );

  // 7. Collect unused photos for below zone
  const belowPhotos = [
    ...leftCandidates.filter(p => !leftUsed.has(p.id)),
    ...rightCandidates.filter(p => !rightUsed.has(p.id)),
    ...initialBelowPhotos,
  ];

  // 8. Create hero cell
  const heroCell: CollageCell = {
    photoId: hero.id,
    x: heroX,
    y: 0,
    width: heroWidth,
    height: Math.round(heroHeight),
  };

  // 9. Pack below zone
  const belowY = Math.round(heroHeight) + gap;
  const belowCells = packRowsFullWidth(belowPhotos, canvasWidth, gap, belowY);

  // 10. Assemble
  const allCells = [...leftCells, heroCell, ...rightCells, ...belowCells];
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

    // Calculate hero dimensions
    const widthFraction = calculateHeroWidthFraction(heroStandards.length);
    const heroWidth = Math.round(canvasWidth * widthFraction);
    const heroHeight = heroWidth / hero.aspectRatio;

    // Determine anchor side (alternating)
    const anchorRight = randomize ? Math.random() < 0.5 : (i % 2 === 1);

    // Pack beside photos using row-based approach
    const availableBesideWidth = canvasWidth - heroWidth - gap;
    const besideStartX = anchorRight ? 0 : heroWidth + gap;
    
    const { cells: besideCells, usedIds } = packBesideRowWithTolerance(
      heroStandards,
      heroHeight,
      availableBesideWidth,
      gap,
      besideStartX
    );

    // Calculate positions
    const heroX = anchorRight ? canvasWidth - heroWidth : 0;

    // Adjust beside cell positions
    const adjustedBesideCells = besideCells.map(cell => ({
      ...cell,
      y: cell.y + currentY,
    }));

    // Add hero
    allCells.push({
      photoId: hero.id,
      x: heroX,
      y: currentY,
      width: heroWidth,
      height: Math.round(heroHeight),
    });

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
