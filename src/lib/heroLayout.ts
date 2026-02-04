import { PhotoItem, CollageLayout, CollageCell, CollageSettings } from '@/types/collage';
import { getDisplayCrop } from '@/lib/cropUtils';
import { packPhotosIntoRegion } from '@/lib/collageLayout';

// ============================================================================
// Constants
// ============================================================================

const MIN_REGION_DIMENSION = 100;

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

interface AnchorPosition {
  x: number;           // Hero's left edge in pixels
  y: number;           // Hero's top edge in pixels
  spanFraction: number; // Size scaling (0.35 to 0.65)
}

interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================================================
// Helpers
// ============================================================================

/** Fisher-Yates shuffle - returns new shuffled array */
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
// Grid Candidate Generation
// ============================================================================

function generateAnchorCandidates(
  canvasWidth: number,
  canvasHeight: number,
  randomize: boolean
): AnchorPosition[] {
  const step = MIN_REGION_DIMENSION;
  const candidates: AnchorPosition[] = [];
  
  const spanOptions = randomize 
    ? [0.35 + Math.random() * 0.30]
    : [0.35, 0.50, 0.65];
  
  // Generate grid of positions
  for (let x = 0; x <= canvasWidth; x += step) {
    for (let y = 0; y <= canvasHeight; y += step) {
      for (const span of spanOptions) {
        candidates.push({ x, y, spanFraction: span });
      }
    }
  }
  
  return candidates;
}

// ============================================================================
// Hero Dimension Calculation
// ============================================================================

function calculateHeroDimensions(
  anchor: AnchorPosition,
  heroAspect: number,
  canvasWidth: number,
  canvasHeight: number,
  areaBudget: number
): { x: number; y: number; width: number; height: number } {
  const targetArea = canvasWidth * canvasHeight * areaBudget;
  
  // Preserve aspect ratio: width = sqrt(area * aspect)
  let width = Math.sqrt(targetArea * heroAspect) * (anchor.spanFraction / 0.5);
  let height = width / heroAspect;
  
  // Constrain to canvas
  if (width > canvasWidth * 0.85) {
    width = canvasWidth * 0.85;
    height = width / heroAspect;
  }
  if (height > canvasHeight * 0.85) {
    height = canvasHeight * 0.85;
    width = height * heroAspect;
  }
  
  // Position: anchor is top-left, clamp to keep hero inside canvas
  const x = Math.min(anchor.x, canvasWidth - width);
  const y = Math.min(anchor.y, canvasHeight - height);
  
  return { 
    x: Math.round(x), 
    y: Math.round(y), 
    width: Math.round(width), 
    height: Math.round(height) 
  };
}

// ============================================================================
// Remaining Region Calculation
// ============================================================================

function calculateRemainingRegions(
  hero: { x: number; y: number; width: number; height: number },
  canvasWidth: number,
  canvasHeight: number,
  gap: number
): Region[] {
  const regions: Region[] = [];
  
  // Left strip (full height, to the left of hero)
  if (hero.x > gap) {
    regions.push({ 
      x: 0, 
      y: 0, 
      width: hero.x - gap, 
      height: canvasHeight 
    });
  }
  
  // Right strip (full height, to the right of hero)
  if (hero.x + hero.width < canvasWidth - gap) {
    regions.push({ 
      x: hero.x + hero.width + gap, 
      y: 0, 
      width: canvasWidth - hero.x - hero.width - gap, 
      height: canvasHeight 
    });
  }
  
  // Top strip (between left/right strips, above hero)
  if (hero.y > gap) {
    const left = hero.x > gap ? hero.x : 0;
    const right = hero.x + hero.width < canvasWidth - gap ? hero.x + hero.width : canvasWidth;
    if (right > left) {
      regions.push({ 
        x: left, 
        y: 0, 
        width: right - left, 
        height: hero.y - gap 
      });
    }
  }
  
  // Bottom strip (between left/right strips, below hero)
  if (hero.y + hero.height < canvasHeight - gap) {
    const left = hero.x > gap ? hero.x : 0;
    const right = hero.x + hero.width < canvasWidth - gap ? hero.x + hero.width : canvasWidth;
    if (right > left) {
      regions.push({ 
        x: left, 
        y: hero.y + hero.height + gap, 
        width: right - left, 
        height: canvasHeight - hero.y - hero.height - gap 
      });
    }
  }
  
  return regions;
}

// ============================================================================
// Validation: The Only Filter
// ============================================================================

function isValidAnchor(
  anchor: AnchorPosition,
  heroAspect: number,
  canvasWidth: number,
  canvasHeight: number,
  areaBudget: number,
  gap: number
): boolean {
  const hero = calculateHeroDimensions(anchor, heroAspect, canvasWidth, canvasHeight, areaBudget);
  
  // Hero must meet minimum size
  if (hero.width < MIN_REGION_DIMENSION || hero.height < MIN_REGION_DIMENSION) {
    return false;
  }
  
  const regions = calculateRemainingRegions(hero, canvasWidth, canvasHeight, gap);
  
  // Must have at least one region and all regions must meet minimum dimensions
  return regions.length > 0 && regions.every(r => 
    r.width >= MIN_REGION_DIMENSION && r.height >= MIN_REGION_DIMENSION
  );
}

// ============================================================================
// Anchor Selection
// ============================================================================

function selectAnchor(
  candidates: AnchorPosition[],
  heroAspect: number,
  canvasWidth: number,
  canvasHeight: number,
  areaBudget: number,
  gap: number,
  randomize: boolean
): AnchorPosition | null {
  const valid = candidates.filter(c => 
    isValidAnchor(c, heroAspect, canvasWidth, canvasHeight, areaBudget, gap)
  );
  
  if (valid.length === 0) return null;
  
  return randomize 
    ? valid[Math.floor(Math.random() * valid.length)]
    : valid[0];
}

// ============================================================================
// Dynamic Area Budget
// ============================================================================

function getHeroAreaBudget(heroCount: number, standardCount: number): number {
  // Total hero area shouldn't exceed 70% of canvas
  const maxTotal = 0.70;
  const perHero = maxTotal / heroCount;
  
  // Each standard needs roughly 5% minimum area
  const standardsNeed = Math.min(0.50, standardCount * 0.05);
  
  return Math.min(perHero, (1.0 - standardsNeed) / heroCount);
}

// ============================================================================
// Multi-Hero Recursive Placement
// ============================================================================

function placeHeroes(
  heroes: PhotoDimension[],
  standards: PhotoDimension[],
  canvasWidth: number,
  canvasHeight: number,
  gap: number,
  randomize: boolean
): { heroCells: CollageCell[]; remainingRegions: Region[] } {
  let regions: Region[] = [{ x: 0, y: 0, width: canvasWidth, height: canvasHeight }];
  const heroCells: CollageCell[] = [];
  const orderedHeroes = randomize ? shuffleArray([...heroes]) : heroes;
  
  for (const hero of orderedHeroes) {
    // Sort regions by area (largest first)
    regions.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    const target = regions.shift();
    
    if (!target || target.width < MIN_REGION_DIMENSION || target.height < MIN_REGION_DIMENSION) {
      break;
    }
    
    const budget = getHeroAreaBudget(heroes.length, standards.length);
    const candidates = generateAnchorCandidates(target.width, target.height, randomize);
    const anchor = selectAnchor(
      candidates, 
      hero.aspectRatio, 
      target.width, 
      target.height, 
      budget, 
      gap, 
      randomize
    );
    
    if (!anchor) {
      // Fallback: place hero filling the region proportionally
      const h = Math.min(target.height, target.width / hero.aspectRatio);
      const w = h * hero.aspectRatio;
      heroCells.push({
        photoId: hero.id,
        x: Math.round(target.x),
        y: Math.round(target.y),
        width: Math.round(w),
        height: Math.round(h),
      });
      continue;
    }
    
    const dims = calculateHeroDimensions(anchor, hero.aspectRatio, target.width, target.height, budget);
    heroCells.push({
      photoId: hero.id,
      x: dims.x + target.x,
      y: dims.y + target.y,
      width: dims.width,
      height: dims.height,
    });
    
    // Calculate remaining regions and offset by target position
    const newRegions = calculateRemainingRegions(dims, target.width, target.height, gap);
    regions.push(...newRegions.map(r => ({
      x: r.x + target.x,
      y: r.y + target.y,
      width: r.width,
      height: r.height,
    })));
  }
  
  return { heroCells, remainingRegions: regions };
}

// ============================================================================
// Pack Standards into Remaining Regions
// ============================================================================

function packStandardsIntoRegions(
  standards: PhotoDimension[],
  regions: Region[],
  gap: number
): CollageCell[] {
  if (standards.length === 0 || regions.length === 0) {
    return [];
  }
  
  // Sort regions by area (largest first)
  const sortedRegions = [...regions].sort((a, b) => 
    (b.width * b.height) - (a.width * a.height)
  );
  
  // Distribute standards across regions proportionally to area
  const totalArea = sortedRegions.reduce((sum, r) => sum + r.width * r.height, 0);
  const allCells: CollageCell[] = [];
  let standardIndex = 0;
  
  for (const region of sortedRegions) {
    if (standardIndex >= standards.length) break;
    
    // How many standards for this region (proportional to area)
    const regionArea = region.width * region.height;
    const proportion = regionArea / totalArea;
    const countForRegion = Math.max(1, Math.round(standards.length * proportion));
    
    const regionStandards = standards.slice(standardIndex, standardIndex + countForRegion);
    standardIndex += regionStandards.length;
    
    if (regionStandards.length === 0) continue;
    
    // Use existing packPhotosIntoRegion
    const packed = packPhotosIntoRegion(regionStandards, {
      width: region.width,
      gap,
      offsetX: region.x,
      offsetY: region.y,
      isLandscape: region.width > region.height,
    });
    
    allCells.push(...packed.cells);
  }
  
  // Handle any remaining standards (put in largest region)
  if (standardIndex < standards.length && sortedRegions.length > 0) {
    const remaining = standards.slice(standardIndex);
    const region = sortedRegions[0];
    
    // Find max Y already used in this region
    const regionCells = allCells.filter(c => 
      c.x >= region.x && c.x < region.x + region.width
    );
    const maxUsedY = regionCells.length > 0 
      ? Math.max(...regionCells.map(c => c.y + c.height)) + gap
      : region.y;
    
    const packed = packPhotosIntoRegion(remaining, {
      width: region.width,
      gap,
      offsetX: region.x,
      offsetY: maxUsedY,
      isLandscape: region.width > region.height,
    });
    
    allCells.push(...packed.cells);
  }
  
  return allCells;
}

// ============================================================================
// Main Entry Point
// ============================================================================

export function generateHeroLayout(
  photos: PhotoItem[],
  settings: CollageSettings,
  targetAspect: number,
  weights: Record<string, number>,
  randomize: boolean
): CollageLayout {
  const baseWidth = 1200;
  const baseHeight = Math.round(baseWidth / targetAspect);
  const gap = settings.gapSize;
  
  const dims = getPhotoDimensions(photos, weights);
  const heroes = dims.filter(d => d.weight >= 2.0);
  const standards = dims.filter(d => d.weight < 2.0);
  
  const { heroCells, remainingRegions } = placeHeroes(
    heroes, 
    standards, 
    baseWidth, 
    baseHeight, 
    gap, 
    randomize
  );
  
  const standardCells = packStandardsIntoRegions(standards, remainingRegions, gap);
  const allCells = [...heroCells, ...standardCells];
  
  // Calculate actual bounds
  const maxY = allCells.length > 0 
    ? Math.max(...allCells.map(c => c.y + c.height))
    : baseHeight;
  
  return { 
    width: baseWidth, 
    height: Math.round(maxY), 
    cells: allCells 
  };
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
