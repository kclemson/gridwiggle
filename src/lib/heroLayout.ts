import { PhotoItem, CollageLayout, CollageCell, CollageSettings } from '@/types/collage';
import { getDisplayCrop } from '@/lib/cropUtils';
import { packPhotosIntoRegion } from '@/lib/collageLayout';

// ============================================================================
// Constants
// ============================================================================

const MIN_DIMENSION = 100;
const BASE_WIDTH = 1200;

// Thresholds for adaptive strategy based on photo count
const FEW_PHOTOS_THRESHOLD = 8;   // Edge-anchor only
const MANY_PHOTOS_THRESHOLD = 15; // Full flexibility

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

function getCellsHeight(cells: CollageCell[]): number {
  if (cells.length === 0) return 0;
  const maxY = Math.max(...cells.map(c => c.y + c.height));
  const minY = Math.min(...cells.map(c => c.y));
  return maxY - minY;
}

// ============================================================================
// Hero Size & Position Calculation
// ============================================================================

/**
 * Calculate hero size based on area budget.
 * Budget adapts based on standard photo count.
 */
function calculateHeroSize(
  hero: PhotoDimension,
  canvasWidth: number,
  canvasHeight: number,
  heroCount: number,
  standardCount: number
): { width: number; height: number } {
  // Reduce hero budget when few standards available (per plan)
  let maxBudget: number;
  if (standardCount < 5) {
    maxBudget = 0.35;
  } else if (standardCount < 10) {
    maxBudget = 0.45;
  } else {
    maxBudget = 0.60;
  }
  
  const standardsNeed = Math.min(0.50, standardCount * 0.04);
  const perHeroBudget = Math.min(
    maxBudget / heroCount,
    (1.0 - standardsNeed) / heroCount
  );
  
  const targetArea = canvasWidth * canvasHeight * perHeroBudget;
  
  // Calculate dimensions preserving aspect ratio
  let width = Math.sqrt(targetArea * hero.aspectRatio);
  let height = width / hero.aspectRatio;
  
  // Constrain to reasonable maximums
  const maxWidth = canvasWidth * 0.75;
  const maxHeight = canvasHeight * 0.75;
  
  if (width > maxWidth) {
    width = maxWidth;
    height = width / hero.aspectRatio;
  }
  if (height > maxHeight) {
    height = maxHeight;
    width = height * hero.aspectRatio;
  }
  
  // Ensure minimums
  width = Math.max(MIN_DIMENSION, width);
  height = Math.max(MIN_DIMENSION, height);
  
  return { 
    width: Math.round(width), 
    height: Math.round(height) 
  };
}

/**
 * Choose hero horizontal position.
 * Uses adaptive strategy based on standard photo count:
 * - Few photos: Always anchor to left or right edge
 * - Many photos: Allow center positioning
 */
function chooseHeroX(
  heroWidth: number,
  canvasWidth: number,
  gap: number,
  standardCount: number,
  randomize: boolean
): number {
  const leftX = 0;
  const rightX = canvasWidth - heroWidth;
  
  // Few photos: ALWAYS anchor to edge (eliminates problematic center floating)
  if (standardCount < FEW_PHOTOS_THRESHOLD) {
    if (randomize) {
      return Math.random() < 0.5 ? leftX : rightX;
    }
    return leftX; // Default to left edge
  }
  
  // Many photos: Allow more flexibility including center
  if (standardCount >= MANY_PHOTOS_THRESHOLD) {
    if (randomize) {
      const step = MIN_DIMENSION;
      const validPositions: number[] = [];
      for (let x = 0; x <= canvasWidth - heroWidth; x += step) {
        validPositions.push(x);
      }
      return validPositions[Math.floor(Math.random() * validPositions.length)];
    }
  }
  
  // Medium count: Prefer edges but allow some center positions
  if (randomize) {
    const centerX = Math.round((canvasWidth - heroWidth) / 2);
    // 70% edge, 30% center
    const roll = Math.random();
    if (roll < 0.35) return leftX;
    if (roll < 0.70) return rightX;
    return centerX;
  }
  
  return leftX; // Default to left edge for predictability
}

// ============================================================================
// Vertical Strip Packing (with proper aspect ratio preservation)
// ============================================================================

/**
 * Calculate the natural width a set of photos needs to fill a target height
 * when stacked vertically as a single column.
 * 
 * For a single column: each photo height = width / aspectRatio
 * Total height = width * sum(1/aspectRatio) + gaps
 * Solving for width: width = (targetHeight - gaps) / sum(1/aspectRatio)
 */
function calculateNaturalStripWidth(
  photos: PhotoDimension[],
  targetHeight: number,
  gap: number
): number {
  if (photos.length === 0) return 0;
  
  const inverseAspectSum = photos.reduce((sum, p) => sum + 1 / p.aspectRatio, 0);
  const gapTotal = gap * (photos.length - 1);
  const photoHeightTotal = targetHeight - gapTotal;
  
  if (inverseAspectSum <= 0 || photoHeightTotal <= 0) return MIN_DIMENSION;
  
  return photoHeightTotal / inverseAspectSum;
}

/**
 * Pack photos as a single vertical column with exact height matching.
 * Returns cells that fill exactly the target height with correct aspect ratios.
 */
function packVerticalColumn(
  photos: PhotoDimension[],
  targetHeight: number,
  offsetX: number,
  offsetY: number,
  gap: number
): { cells: CollageCell[]; width: number } {
  if (photos.length === 0) {
    return { cells: [], width: 0 };
  }
  
  // Calculate the width needed to fill target height exactly
  const columnWidth = calculateNaturalStripWidth(photos, targetHeight, gap);
  
  if (columnWidth < MIN_DIMENSION) {
    return { cells: [], width: 0 };
  }
  
  // Pack photos vertically at the calculated width
  const cells: CollageCell[] = [];
  let y = offsetY;
  
  for (const photo of photos) {
    const cellHeight = columnWidth / photo.aspectRatio;
    
    cells.push({
      photoId: photo.id,
      x: Math.round(offsetX),
      y: Math.round(y),
      width: Math.round(columnWidth),
      height: Math.round(cellHeight),
    });
    
    y += cellHeight + gap;
  }
  
  return { cells, width: columnWidth };
}

/**
 * Pack photos into a vertical strip using row-based layout,
 * then scale UNIFORMLY to match target height (preserving aspect ratios).
 */
function packVerticalStripWithUniformScale(
  photos: PhotoDimension[],
  maxWidth: number,
  targetHeight: number,
  offsetX: number,
  offsetY: number,
  gap: number
): CollageCell[] {
  if (photos.length === 0 || maxWidth < MIN_DIMENSION) return [];
  
  // Pack with portrait orientation preference
  const result = packPhotosIntoRegion(photos, {
    width: maxWidth,
    gap,
    offsetX: 0,
    offsetY: 0,
    isLandscape: false,
  });
  
  const cells = result.cells;
  if (cells.length === 0) return [];
  
  const packedHeight = getCellsHeight(cells);
  const packedWidth = Math.max(...cells.map(c => c.x + c.width));
  
  // Scale UNIFORMLY to match target height
  const scale = targetHeight / packedHeight;
  const minY = Math.min(...cells.map(c => c.y));
  const minX = Math.min(...cells.map(c => c.x));
  
  return cells.map(cell => ({
    photoId: cell.photoId,
    // Scale BOTH x and width to preserve aspect ratios
    x: Math.round(offsetX + (cell.x - minX) * scale),
    y: Math.round(offsetY + (cell.y - minY) * scale),
    width: Math.round(cell.width * scale),
    height: Math.round(cell.height * scale),
  }));
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
// Simplified Edge-Anchored Hero Layout
// ============================================================================

/**
 * Generate layout with edge-anchored hero.
 * 
 * Simplified approach (per plan):
 * 1. Hero anchored to left or right edge
 * 2. Single vertical column beside hero (fills hero height exactly)
 * 3. Remaining photos in full-width rows below
 * 
 * This eliminates blank rectangles because:
 * - No "above" zone splitting
 * - Single column calculates exact width to fill hero height
 * - Below zone absorbs remaining photos naturally
 */
function generateEdgeAnchoredHeroLayout(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  targetAspect: number,
  gap: number,
  randomize: boolean
): CollageLayout {
  const estimatedHeight = Math.round(canvasWidth / targetAspect);
  
  // 1. Calculate hero size (scaled by standard count)
  const heroSize = calculateHeroSize(
    hero, 
    canvasWidth, 
    estimatedHeight, 
    1, 
    standards.length
  );
  
  // 2. Determine which edge (left or right)
  const anchorRight = randomize ? Math.random() < 0.5 : false;
  
  // 3. Calculate how many photos to put beside vs below
  // Aim for 1-3 photos beside (enough to fill without extreme sizing)
  const besideCount = Math.min(3, Math.max(1, Math.floor(standards.length * 0.3)));
  const shuffled = randomize ? shuffleArray(standards) : standards;
  const besidePhotos = shuffled.slice(0, besideCount);
  const belowPhotos = shuffled.slice(besideCount);
  
  // 4. Pack beside column - calculate natural width to fill hero height
  const { cells: besideCells, width: besideWidth } = packVerticalColumn(
    besidePhotos,
    heroSize.height,
    0, // Will adjust X later
    0, // Will adjust Y later
    gap
  );
  
  // 5. Calculate positions based on anchor side
  let heroX: number;
  let besideX: number;
  
  if (anchorRight) {
    // Hero on right, beside column on left
    besideX = 0;
    heroX = besideWidth > 0 ? besideWidth + gap : 0;
  } else {
    // Hero on left, beside column on right
    heroX = 0;
    besideX = heroSize.width + gap;
  }
  
  // 6. Adjust beside cell positions
  const adjustedBesideCells = besideCells.map(cell => ({
    ...cell,
    x: Math.round(besideX + (cell.x)),
  }));
  
  // 7. Create hero cell
  const heroCell: CollageCell = {
    photoId: hero.id,
    x: heroX,
    y: 0,
    width: heroSize.width,
    height: heroSize.height,
  };
  
  // 8. Pack below zone
  const belowY = heroSize.height + gap;
  const belowCells = packRowsFullWidth(belowPhotos, canvasWidth, gap, belowY);
  
  // 9. Assemble and calculate final height
  const allCells = [heroCell, ...adjustedBesideCells, ...belowCells];
  const finalHeight = allCells.length > 0
    ? Math.max(...allCells.map(c => c.y + c.height))
    : estimatedHeight;
  
  return {
    width: canvasWidth,
    height: Math.round(finalHeight),
    cells: allCells,
  };
}

/**
 * Generate layout with floating hero (for many photos).
 * Uses uniform scaling to preserve aspect ratios.
 */
function generateFloatingHeroLayout(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  targetAspect: number,
  gap: number,
  randomize: boolean
): CollageLayout {
  const estimatedHeight = Math.round(canvasWidth / targetAspect);
  
  // 1. Calculate hero size
  const heroSize = calculateHeroSize(
    hero, 
    canvasWidth, 
    estimatedHeight, 
    1, 
    standards.length
  );
  
  // 2. Choose hero X position (can be anywhere)
  const heroX = chooseHeroX(heroSize.width, canvasWidth, gap, standards.length, randomize);
  
  // 3. Calculate strip widths
  const leftWidth = heroX - gap;
  const rightX = heroX + heroSize.width + gap;
  const rightWidth = canvasWidth - rightX;
  
  const hasLeft = leftWidth >= MIN_DIMENSION;
  const hasRight = rightWidth >= MIN_DIMENSION;
  
  // 4. Distribute photos to left/right/below
  const shuffled = randomize ? shuffleArray(standards) : standards;
  
  let leftCount = 0, rightCount = 0;
  const totalBesideRatio = 0.4; // 40% beside, 60% below
  
  if (hasLeft && hasRight) {
    // Split beside photos proportionally to strip widths
    const leftRatio = leftWidth / (leftWidth + rightWidth);
    const besideTotal = Math.floor(standards.length * totalBesideRatio);
    leftCount = Math.max(1, Math.floor(besideTotal * leftRatio));
    rightCount = Math.max(1, besideTotal - leftCount);
  } else if (hasLeft) {
    leftCount = Math.floor(standards.length * totalBesideRatio);
  } else if (hasRight) {
    rightCount = Math.floor(standards.length * totalBesideRatio);
  }
  
  const leftPhotos = shuffled.slice(0, leftCount);
  const rightPhotos = shuffled.slice(leftCount, leftCount + rightCount);
  const belowPhotos = shuffled.slice(leftCount + rightCount);
  
  // 5. Pack left strip with UNIFORM scaling
  const leftCells = hasLeft 
    ? packVerticalStripWithUniformScale(leftPhotos, leftWidth, heroSize.height, 0, 0, gap)
    : [];
  
  // 6. Pack right strip with UNIFORM scaling
  const rightCells = hasRight
    ? packVerticalStripWithUniformScale(rightPhotos, rightWidth, heroSize.height, rightX, 0, gap)
    : [];
  
  // 7. Create hero cell
  const heroCell: CollageCell = {
    photoId: hero.id,
    x: heroX,
    y: 0,
    width: heroSize.width,
    height: heroSize.height,
  };
  
  // 8. Pack below zone
  const belowY = heroSize.height + gap;
  const belowCells = packRowsFullWidth(belowPhotos, canvasWidth, gap, belowY);
  
  // 9. Assemble
  const allCells = [...leftCells, heroCell, ...rightCells, ...belowCells];
  const finalHeight = allCells.length > 0
    ? Math.max(...allCells.map(c => c.y + c.height))
    : estimatedHeight;
  
  return {
    width: canvasWidth,
    height: Math.round(finalHeight),
    cells: allCells,
  };
}

// ============================================================================
// Main Entry Points
// ============================================================================

/**
 * Generate layout for a single hero photo.
 * Uses adaptive strategy based on standard photo count.
 */
function generateSingleHeroLayout(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  targetAspect: number,
  gap: number,
  randomize: boolean
): CollageLayout {
  // Use edge-anchored layout for few photos (simpler, no gaps)
  if (standards.length < FEW_PHOTOS_THRESHOLD) {
    return generateEdgeAnchoredHeroLayout(
      hero, standards, canvasWidth, targetAspect, gap, randomize
    );
  }
  
  // Use floating layout for many photos (more variety, uniform scaling preserves aspect)
  return generateFloatingHeroLayout(
    hero, standards, canvasWidth, targetAspect, gap, randomize
  );
}

/**
 * Handle multiple heroes by processing them sequentially.
 */
function generateMultiHeroLayout(
  heroes: PhotoDimension[],
  standards: PhotoDimension[],
  canvasWidth: number,
  targetAspect: number,
  gap: number,
  randomize: boolean
): CollageLayout {
  const estimatedHeight = Math.round(canvasWidth / targetAspect);
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
    
    // Calculate hero size
    const heroSize = calculateHeroSize(
      hero,
      canvasWidth,
      estimatedHeight,
      heroes.length,
      standards.length
    );
    
    // Always edge-anchor for multi-hero (simpler)
    const anchorRight = randomize ? Math.random() < 0.5 : (i % 2 === 1);
    
    // Beside photos: 1-2 per hero
    const besideCount = Math.min(2, Math.max(1, Math.floor(heroStandards.length * 0.25)));
    const besidePhotos = heroStandards.slice(0, besideCount);
    const belowPhotos = heroStandards.slice(besideCount);
    
    // Pack beside column
    const { cells: besideCells, width: besideWidth } = packVerticalColumn(
      besidePhotos,
      heroSize.height,
      0,
      currentY,
      gap
    );
    
    // Calculate positions
    let heroX: number;
    if (anchorRight) {
      heroX = besideWidth > 0 ? besideWidth + gap : 0;
    } else {
      heroX = 0;
    }
    
    const besideX = anchorRight ? 0 : (heroSize.width + gap);
    const adjustedBesideCells = besideCells.map(cell => ({
      ...cell,
      x: Math.round(besideX),
    }));
    
    // Add hero
    allCells.push({
      photoId: hero.id,
      x: heroX,
      y: currentY,
      width: heroSize.width,
      height: heroSize.height,
    });
    
    allCells.push(...adjustedBesideCells);
    
    currentY += heroSize.height + gap;
    
    // Pack below for this hero
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
    : estimatedHeight;
  
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
  targetAspect: number,
  weights: Record<string, number>,
  randomize: boolean
): CollageLayout {
  const gap = settings.gapSize;
  
  const dims = getPhotoDimensions(photos, weights);
  const heroes = dims.filter(d => d.weight >= 2.0);
  const standards = dims.filter(d => d.weight < 2.0);
  
  if (heroes.length === 0) {
    return { width: BASE_WIDTH, height: Math.round(BASE_WIDTH / targetAspect), cells: [] };
  }
  
  if (heroes.length === 1) {
    return generateSingleHeroLayout(
      heroes[0],
      standards,
      BASE_WIDTH,
      targetAspect,
      gap,
      randomize
    );
  }
  
  return generateMultiHeroLayout(
    heroes,
    standards,
    BASE_WIDTH,
    targetAspect,
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
