import { generateCollageLayoutV3 } from '@/lib/v3';
import { 
  CollageSettings, 
  PhotoItem, 
  CollageLayout,
  isShapeAvailable,
} from '@/types/collage';
import { V3Tuning, DEFAULT_V3_TUNING } from '@/lib/v3/types';
import { 
  SyntheticPhoto, 
  LayoutTestCase, 
  LayoutTestResult 
} from './types';
import { 
  generatePhotoSet, 
  TEST_PHOTO_COUNTS 
} from './photoGenerator';
import { coefficientOfVariation, shuffleArray } from '@/lib/layoutMath';

/**
 * Convert a synthetic photo to the PhotoItem format expected by the layout algorithm.
 */
export function syntheticToPhotoItem(photo: SyntheticPhoto): PhotoItem {
  // Create a minimal PhotoItem with dummy values for fields we don't need
  return {
    id: photo.id,
    objectUrl: '', // Not needed for layout calculation
    blob: new Blob(), // Not needed for layout calculation
    originalWidth: photo.originalWidth,
    originalHeight: photo.originalHeight,
    smartCropAttempted: false,
    smartCrop: null,
    manualCrop: null,
    isProcessing: false,
    error: null,
    priority: photo.priority,
  };
}

/**
 * Calculate layout metrics from a CollageLayout result.
 */
function calculateMetrics(
  layout: CollageLayout, 
  photos: SyntheticPhoto[]
): Pick<
  LayoutTestResult, 
  'rowCount' | 'rowSizes' | 'rowHeroAdjacent' | 'canvasAspect' | 'areaCoefficientOfVariation' | 
  'largestToSmallestRatio' | 'heroCoverage' | 'cellAreaPercents' | 'heroToRunnerUpRatio'
> {
  // Find hero photo ID if present
  const heroPhoto = photos.find(p => p.priority === 1);
  const heroId = heroPhoto?.id ?? null;
  
  // Calculate cell areas (all photos for cellAreaPercents)
  const allAreas = layout.cells.map(cell => cell.width * cell.height);
  const canvasArea = layout.width * layout.height;
  
  // Calculate supporting photo areas (excludes hero for balance metrics)
  const supportingAreas = heroId 
    ? layout.cells.filter(c => c.photoId !== heroId).map(c => c.width * c.height)
    : allAreas;
  
  // Calculate all cell area percentages, sorted descending
  const cellAreaPercents = layout.cells
    .map(cell => Math.round((cell.width * cell.height) / canvasArea * 100))
    .sort((a, b) => b - a);
  
  // Find hero coverage and ratio
  let heroCoverage: number | null = null;
  let heroToRunnerUpRatio: number | null = null;
  
  if (heroPhoto) {
    const heroCell = layout.cells.find(c => c.photoId === heroPhoto.id);
    if (heroCell) {
      const heroArea = heroCell.width * heroCell.height;
      heroCoverage = heroArea / canvasArea;
      
      // Calculate ratio to largest non-hero cell
      const nonHeroCells = layout.cells.filter(c => c.photoId !== heroPhoto.id);
      if (nonHeroCells.length > 0) {
        const runnerUpArea = Math.max(...nonHeroCells.map(c => c.width * c.height));
        heroToRunnerUpRatio = heroArea / runnerUpArea;
      }
    }
  }
  
  // Group cells into rows based on Y position
  const cellsByY = new Map<number, typeof layout.cells>();
  for (const cell of layout.cells) {
    const roundedY = Math.round(cell.y);
    if (!cellsByY.has(roundedY)) {
      cellsByY.set(roundedY, []);
    }
    cellsByY.get(roundedY)!.push(cell);
  }
  
  // Sort rows by Y position and count photos per row
  const sortedYs = Array.from(cellsByY.keys()).sort((a, b) => a - b);
  const rowSizes = sortedYs.map(y => cellsByY.get(y)!.length);
  
  // Determine which rows overlap with the hero cell's Y range
  let heroYMin = 0, heroYMax = 0;
  if (heroPhoto) {
    const heroCell = layout.cells.find(c => c.photoId === heroPhoto.id);
    if (heroCell) {
      heroYMin = heroCell.y;
      heroYMax = heroCell.y + heroCell.height;
    }
  }
  
  const rowHeroAdjacent = sortedYs.map(y => {
    if (!heroPhoto) return false;
    const rowCells = cellsByY.get(y)!;
    const rowHeight = Math.max(...rowCells.map(c => c.height));
    const rowYMax = y + rowHeight;
    // Row overlaps with hero if Y ranges intersect
    return y < heroYMax && rowYMax > heroYMin;
  });
  
  return {
    rowCount: rowSizes.length,
    rowSizes,
    rowHeroAdjacent,
    canvasAspect: layout.width / layout.height,
    areaCoefficientOfVariation: coefficientOfVariation(supportingAreas),
    largestToSmallestRatio: supportingAreas.length > 1 
      ? Math.max(...supportingAreas) / Math.min(...supportingAreas) 
      : 1,
    heroCoverage,
    cellAreaPercents,
    heroToRunnerUpRatio,
  };
}

/**
 * Run a test case through the V3 layout algorithm and compute metrics.
 */
export function runLayoutTest(testCase: LayoutTestCase): LayoutTestResult {
  const { photos, shape, tuning } = testCase;
  
  // Convert synthetic photos to PhotoItems
  const photoItems = photos.map(syntheticToPhotoItem);
  
  // Convert priority to photoWeights
  // Priority 1 = hero → weight 2.0
  // Priority 2, 3 = standard → weight 1.0
  const photoWeights: Record<string, number> = {};
  for (const photo of photos) {
    photoWeights[photo.id] = photo.priority === 1 ? 2.0 : 1.0;
  }
  
  // Build V3 tuning with test case overrides (currently no direct mapping)
  const v3Tuning: Partial<V3Tuning> = {};
  
  // Run the V3 layout algorithm
  const settings: CollageSettings = {
    shape,
    gapColor: '#000000',
    gapSize: 4,
    exportScale: 1,
  };
  
  const layout = generateCollageLayoutV3(photoItems, settings, {
    photoWeights,
    randomize: false, // Deterministic for testing
    tuning: v3Tuning,
  });
  
  // Handle null layouts (V3 returns null on failure)
  if (!layout) {
    return {
      testCase,
      layout: { width: 0, height: 0, cells: [] },
      rowCount: 0,
      rowSizes: [],
      rowHeroAdjacent: [],
      canvasAspect: 0,
      areaCoefficientOfVariation: 0,
      largestToSmallestRatio: 0,
      heroCoverage: null,
      cellAreaPercents: [],
      heroToRunnerUpRatio: null,
    };
  }
  
  // Calculate metrics
  const metrics = calculateMetrics(layout, photos);
  
  return {
    testCase,
    layout,
    ...metrics,
  };
}

/**
 * Pick a random minPhotosPerRow tuning value.
 * This forces different row structures even with similar inputs.
 */
function randomMinPhotosPerRow(): number {
  const options = [2, 3, 4];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Generate a batch of diverse test cases for rating.
 * Hero layouts always use 'auto' shape (matches app UX constraint).
 * Non-hero layouts test all available shapes for regression coverage.
 * Generates 5 variations per photo count for variety.
 */
export function generateTestBatch(count: number): LayoutTestCase[] {
  const cases: LayoutTestCase[] = [];
  const VARIATIONS_PER_COMBO = 5;
  
  // Hero count distribution matching V3Test HERO_MIX
  const HERO_MIX: Record<number, number> = {
    0: 0.05,
    1: 0.45,
    2: 0.50,
  };
  const MIN_PHOTOS_FOR_HEROES: Record<number, number> = { 0: 1, 1: 1, 2: 8 };
  
  function sampleHeroCount(photoCount: number): number {
    const roll = Math.random();
    let cumulative = 0;
    for (const [k, prob] of Object.entries(HERO_MIX)) {
      const hc = Number(k);
      cumulative += prob;
      if (roll <= cumulative) {
        if (photoCount < (MIN_PHOTOS_FOR_HEROES[hc] ?? 1)) return Math.min(1, photoCount);
        return hc;
      }
    }
    return 1;
  }
  
  for (const photoCount of TEST_PHOTO_COUNTS) {
    for (let v = 0; v < VARIATIONS_PER_COMBO; v++) {
      const heroCount = sampleHeroCount(photoCount);
      const orientationBias = (Math.random() - 0.5) * 1.2;
      const tuning = { minPhotosPerRow: randomMinPhotosPerRow() };
      
      if (heroCount > 0) {
        // Hero layouts ALWAYS use 'auto' (matches app UX constraint)
        cases.push({
          photos: generatePhotoSet(photoCount, orientationBias, heroCount),
          shape: 'auto',
          heroCount,
          orientationBias,
          tuning,
        });
      } else {
        // No-hero layouts can test all available shapes
        const shapes: CollageSettings['shape'][] = ['auto'];
        if (isShapeAvailable('landscape', photoCount)) shapes.push('landscape');
        if (isShapeAvailable('portrait', photoCount)) shapes.push('portrait');
        if (isShapeAvailable('square', photoCount)) shapes.push('square');
        
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        cases.push({
          photos: generatePhotoSet(photoCount, orientationBias, 0),
          shape,
          heroCount: 0,
          orientationBias,
          tuning,
        });
      }
    }
  }
  
  // Shuffle for variety in rating session
  return shuffleArray(cases).slice(0, count);
}
