import { PhotoItem, CollageLayout, CollageCell, CollageSettings } from '@/types/collage';
import { getDisplayCrop } from '@/lib/cropUtils';
import { packPhotosIntoRegion } from '@/lib/collageLayout';

// ============================================================================
// Constants
// ============================================================================

const MIN_DIMENSION = 100;
const BASE_WIDTH = 1200;

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

interface ZoneDistribution {
  above: PhotoDimension[];
  left: PhotoDimension[];
  right: PhotoDimension[];
  below: PhotoDimension[];
}

interface ZoneAreas {
  above: number;
  left: number;
  right: number;
  below: number;
  total: number;
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
 * Heroes get larger portions when there are fewer standards.
 */
function calculateHeroSize(
  hero: PhotoDimension,
  canvasWidth: number,
  canvasHeight: number,
  heroCount: number,
  standardCount: number
): { width: number; height: number } {
  // Budget per hero: scales down with more heroes, leaves room for standards
  const maxTotalBudget = 0.60; // All heroes together max 60%
  const standardsNeed = Math.min(0.50, standardCount * 0.04);
  const perHeroBudget = Math.min(
    maxTotalBudget / heroCount,
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
 * Returns x coordinate for hero's left edge.
 */
function chooseHeroX(
  heroWidth: number,
  canvasWidth: number,
  gap: number,
  randomize: boolean
): number {
  // Valid positions: left edge, center, right edge, or random valid spot
  const leftX = 0;
  const centerX = Math.round((canvasWidth - heroWidth) / 2);
  const rightX = canvasWidth - heroWidth;
  
  if (randomize) {
    // Choose from grid of valid positions
    const step = MIN_DIMENSION;
    const validPositions: number[] = [];
    for (let x = 0; x <= canvasWidth - heroWidth; x += step) {
      validPositions.push(x);
    }
    // Always include exact center and right edge
    if (!validPositions.includes(centerX)) validPositions.push(centerX);
    if (!validPositions.includes(rightX)) validPositions.push(rightX);
    
    return validPositions[Math.floor(Math.random() * validPositions.length)];
  }
  
  // Default: prefer center, then right, then left
  return centerX;
}

// ============================================================================
// Zone-Based Photo Distribution
// ============================================================================

/**
 * Calculate available areas for each zone given hero position and size.
 */
function calculateZoneAreas(
  heroX: number,
  heroWidth: number,
  heroHeight: number,
  canvasWidth: number,
  aboveHeight: number,
  gap: number
): ZoneAreas {
  const leftWidth = Math.max(0, heroX - gap);
  const rightWidth = Math.max(0, canvasWidth - heroX - heroWidth - gap);
  
  // Above and below use full canvas width
  // Left and right strips are beside the hero (within hero zone height)
  const aboveArea = aboveHeight > MIN_DIMENSION ? canvasWidth * aboveHeight : 0;
  const leftArea = leftWidth > MIN_DIMENSION ? leftWidth * heroHeight : 0;
  const rightArea = rightWidth > MIN_DIMENSION ? rightWidth * heroHeight : 0;
  // Below area: we don't know exact height yet, estimate based on remaining photos
  // For distribution, use a reasonable estimate
  const belowArea = canvasWidth * heroHeight; // Estimate same as hero height
  
  return {
    above: aboveArea,
    left: leftArea,
    right: rightArea,
    below: belowArea,
    total: aboveArea + leftArea + rightArea + belowArea,
  };
}

/**
 * Distribute standard photos to zones based on area proportions.
 */
function distributeToZones(
  standards: PhotoDimension[],
  zones: ZoneAreas
): ZoneDistribution {
  if (zones.total === 0 || standards.length === 0) {
    return { above: [], left: [], right: [], below: standards };
  }
  
  const n = standards.length;
  
  // Calculate proportional counts
  let aboveCount = Math.round(n * (zones.above / zones.total));
  let leftCount = Math.round(n * (zones.left / zones.total));
  let rightCount = Math.round(n * (zones.right / zones.total));
  
  // Ensure at least 1 photo per non-empty zone if possible
  if (zones.above > 0 && aboveCount === 0 && n >= 4) aboveCount = 1;
  if (zones.left > 0 && leftCount === 0 && n >= 4) leftCount = 1;
  if (zones.right > 0 && rightCount === 0 && n >= 4) rightCount = 1;
  
  // Clamp totals to not exceed available photos
  const assignedCount = aboveCount + leftCount + rightCount;
  if (assignedCount > n) {
    // Scale down proportionally
    const scale = n / assignedCount;
    aboveCount = Math.floor(aboveCount * scale);
    leftCount = Math.floor(leftCount * scale);
    rightCount = Math.floor(rightCount * scale);
  }
  
  // Rest goes to below
  const belowCount = n - aboveCount - leftCount - rightCount;
  
  // Slice photos into zones
  let idx = 0;
  const above = standards.slice(idx, idx + aboveCount); idx += aboveCount;
  const left = standards.slice(idx, idx + leftCount); idx += leftCount;
  const right = standards.slice(idx, idx + rightCount); idx += rightCount;
  const below = standards.slice(idx, idx + belowCount);
  
  return { above, left, right, below };
}

// ============================================================================
// Zone Packing Functions
// ============================================================================

/**
 * Pack photos into full-width rows (for above/below zones).
 * Returns cells with proper positioning.
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

/**
 * Pack photos into a vertical strip beside the hero.
 * Uses portrait-oriented packing to fill the height.
 * If the natural pack height doesn't match target, scale to fit.
 */
function packVerticalStrip(
  photos: PhotoDimension[],
  stripWidth: number,
  targetHeight: number,
  offsetX: number,
  offsetY: number,
  gap: number
): CollageCell[] {
  if (photos.length === 0 || stripWidth < MIN_DIMENSION) return [];
  
  // Pack with portrait orientation preference
  const result = packPhotosIntoRegion(photos, {
    width: stripWidth,
    gap,
    offsetX,
    offsetY,
    isLandscape: false, // Prefer vertical stacking
    targetHeight,
  });
  
  const cells = result.cells;
  if (cells.length === 0) return [];
  
  // Calculate achieved height
  const packedHeight = getCellsHeight(cells);
  
  // If significantly off from target, scale to fit exactly
  if (Math.abs(packedHeight - targetHeight) > gap) {
    const scale = targetHeight / packedHeight;
    const minY = Math.min(...cells.map(c => c.y));
    
    return cells.map(cell => ({
      photoId: cell.photoId,
      x: cell.x, // X stays the same
      y: Math.round(offsetY + (cell.y - minY) * scale),
      width: cell.width, // Width stays the same
      height: Math.round(cell.height * scale),
    }));
  }
  
  return cells;
}

// ============================================================================
// Main Hero Layout Algorithm
// ============================================================================

/**
 * Generate layout with hero photo(s) using zone-based flow packing.
 * 
 * Algorithm:
 * 1. Calculate hero size and horizontal position
 * 2. Pack "above" zone photos at full width → determines hero Y position
 * 3. Pack left/right strip photos beside hero → scaled to match hero height
 * 4. Place hero cell
 * 5. Pack "below" zone photos at full width
 */
function generateSingleHeroLayout(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  targetAspect: number,
  gap: number,
  randomize: boolean
): CollageLayout {
  // Estimate initial canvas height
  const estimatedHeight = Math.round(canvasWidth / targetAspect);
  
  // 1. Calculate hero size
  const heroSize = calculateHeroSize(
    hero, 
    canvasWidth, 
    estimatedHeight, 
    1, 
    standards.length
  );
  
  // 2. Choose hero X position
  const heroX = chooseHeroX(heroSize.width, canvasWidth, gap, randomize);
  
  // 3. Calculate zone areas for distribution
  // For initial distribution, estimate above height as ~20% of canvas
  const estimatedAboveHeight = Math.round(estimatedHeight * 0.2);
  const zoneAreas = calculateZoneAreas(
    heroX, 
    heroSize.width, 
    heroSize.height, 
    canvasWidth, 
    estimatedAboveHeight, 
    gap
  );
  
  // 4. Distribute photos to zones
  const shuffledStandards = randomize ? shuffleArray(standards) : standards;
  const distribution = distributeToZones(shuffledStandards, zoneAreas);
  
  // 5. Pack ABOVE zone (full width rows)
  const aboveCells = packRowsFullWidth(distribution.above, canvasWidth, gap, 0);
  const aboveHeight = aboveCells.length > 0 ? getCellsHeight(aboveCells) : 0;
  
  // 6. Calculate hero Y position (after above zone + gap)
  const heroY = aboveHeight > 0 ? aboveHeight + gap : 0;
  
  // 7. Pack LEFT strip (beside hero, scaled to hero height)
  const leftWidth = heroX - gap;
  const leftCells = packVerticalStrip(
    distribution.left,
    leftWidth,
    heroSize.height,
    0,
    heroY,
    gap
  );
  
  // 8. Pack RIGHT strip (beside hero, scaled to hero height)
  const rightX = heroX + heroSize.width + gap;
  const rightWidth = canvasWidth - rightX;
  const rightCells = packVerticalStrip(
    distribution.right,
    rightWidth,
    heroSize.height,
    rightX,
    heroY,
    gap
  );
  
  // 9. Create hero cell
  const heroCell: CollageCell = {
    photoId: hero.id,
    x: heroX,
    y: heroY,
    width: heroSize.width,
    height: heroSize.height,
  };
  
  // 10. Pack BELOW zone (full width rows)
  const belowY = heroY + heroSize.height + gap;
  const belowCells = packRowsFullWidth(distribution.below, canvasWidth, gap, belowY);
  
  // 11. Assemble all cells and calculate final height
  const allCells = [...aboveCells, ...leftCells, heroCell, ...rightCells, ...belowCells];
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
 * Handle multiple heroes by processing them sequentially.
 * Each hero after the first gets placed in the "below" zone of the previous.
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
    const isFirst = i === 0;
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
    
    // Choose X position
    const heroX = chooseHeroX(heroSize.width, canvasWidth, gap, randomize);
    
    // For first hero, pack above zone
    if (isFirst && heroStandards.length > 0) {
      // Use ~25% for above on first hero
      const aboveCount = Math.max(1, Math.floor(heroStandards.length * 0.25));
      const abovePhotos = heroStandards.slice(0, aboveCount);
      
      const aboveCells = packRowsFullWidth(abovePhotos, canvasWidth, gap, currentY);
      allCells.push(...aboveCells);
      
      if (aboveCells.length > 0) {
        currentY = Math.max(...aboveCells.map(c => c.y + c.height)) + gap;
      }
    }
    
    // Pack left/right strips
    const leftWidth = heroX - gap;
    const rightX = heroX + heroSize.width + gap;
    const rightWidth = canvasWidth - rightX;
    
    // Distribute remaining standards to left/right/below
    const remainingStandards = isFirst 
      ? heroStandards.slice(Math.floor(heroStandards.length * 0.25))
      : heroStandards;
    
    // Simple split: 30% left, 30% right, 40% below (if zones exist)
    const hasLeft = leftWidth >= MIN_DIMENSION;
    const hasRight = rightWidth >= MIN_DIMENSION;
    
    let leftCount = 0, rightCount = 0;
    if (hasLeft && hasRight) {
      leftCount = Math.floor(remainingStandards.length * 0.3);
      rightCount = Math.floor(remainingStandards.length * 0.3);
    } else if (hasLeft) {
      leftCount = Math.floor(remainingStandards.length * 0.4);
    } else if (hasRight) {
      rightCount = Math.floor(remainingStandards.length * 0.4);
    }
    
    const leftPhotos = remainingStandards.slice(0, leftCount);
    const rightPhotos = remainingStandards.slice(leftCount, leftCount + rightCount);
    const belowPhotos = remainingStandards.slice(leftCount + rightCount);
    
    // Pack left strip
    const leftCells = packVerticalStrip(leftPhotos, leftWidth, heroSize.height, 0, currentY, gap);
    allCells.push(...leftCells);
    
    // Pack right strip
    const rightCells = packVerticalStrip(rightPhotos, rightWidth, heroSize.height, rightX, currentY, gap);
    allCells.push(...rightCells);
    
    // Place hero
    allCells.push({
      photoId: hero.id,
      x: heroX,
      y: currentY,
      width: heroSize.width,
      height: heroSize.height,
    });
    
    currentY += heroSize.height + gap;
    
    // Pack below for this hero (or remaining if last)
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
    // No heroes - shouldn't happen if hasHeroPhotos was checked
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
