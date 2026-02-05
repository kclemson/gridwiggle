import { generateCollageLayout } from '@/lib/collageLayout';
import { 
  CollageSettings, 
  LayoutTuning, 
  PhotoItem, 
  DEFAULT_TUNING,
  CollageLayout,
  isShapeAvailable,
} from '@/types/collage';
import { 
  SyntheticPhoto, 
  AspectDistribution, 
  LayoutTestCase, 
  LayoutTestResult 
} from './types';
import { 
  generatePhotoSet, 
  weightedRandomDistribution, 
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
  // Calculate cell areas
  const areas = layout.cells.map(cell => cell.width * cell.height);
  const canvasArea = layout.width * layout.height;
  
  // Calculate all cell area percentages, sorted descending
  const cellAreaPercents = layout.cells
    .map(cell => Math.round((cell.width * cell.height) / canvasArea * 100))
    .sort((a, b) => b - a);
  
  // Find hero coverage and ratio
  const heroPhoto = photos.find(p => p.priority === 1);
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
    areaCoefficientOfVariation: coefficientOfVariation(areas),
    largestToSmallestRatio: areas.length > 0 ? Math.max(...areas) / Math.min(...areas) : 1,
    heroCoverage,
    cellAreaPercents,
    heroToRunnerUpRatio,
  };
}

/**
 * Run a test case through the layout algorithm and compute metrics.
 */
export function runLayoutTest(testCase: LayoutTestCase): LayoutTestResult {
  const { photos, shape, tuning } = testCase;
  
  // Convert synthetic photos to PhotoItems
  const photoItems = photos.map(syntheticToPhotoItem);
  
  // Convert priority to photoWeights (same logic as Index.tsx)
  // Priority 1 = hero → weight 2.0
  // Priority 2, 3 = standard → weight 1.0
  const photoWeights: Record<string, number> = {};
  for (const photo of photos) {
    photoWeights[photo.id] = photo.priority === 1 ? 2.0 : 1.0;
  }
  
  // Merge tuning with defaults
  const fullTuning: LayoutTuning = { ...DEFAULT_TUNING, ...tuning };
  
  // Run the layout algorithm WITH WEIGHTS
  const settings: CollageSettings = {
    shape,
    gapColor: '#000000',
    gapSize: 4,
  };
  
  const layout = generateCollageLayout(photoItems, settings, {
    tuning: fullTuning,
    randomize: false, // Deterministic for testing
    photoWeights, // Now heroes will be detected!
  });
  
  // Calculate metrics
  const metrics = calculateMetrics(layout, photos);
  
  return {
    testCase,
    layout,
    ...metrics,
  };
}

/**
 * Generate a batch of diverse test cases for rating.
 */
export function generateTestBatch(count: number): LayoutTestCase[] {
  const cases: LayoutTestCase[] = [];
  
  // Generate cases covering all combinations
  for (const photoCount of TEST_PHOTO_COUNTS) {
    // Build list of available shapes for this photo count
    const shapes: CollageSettings['shape'][] = ['auto'];
    if (isShapeAvailable('landscape', photoCount)) shapes.push('landscape');
    if (isShapeAvailable('portrait', photoCount)) shapes.push('portrait');
    if (isShapeAvailable('square', photoCount)) shapes.push('square');
    
    for (const shape of shapes) {
      // Weight toward hero layouts since no-hero consistently works well
      // 80% hero, 20% no-hero for regression coverage
      const hasHero = Math.random() < 0.8;
      const distribution = weightedRandomDistribution();
      cases.push({
        photos: generatePhotoSet(photoCount, distribution, hasHero),
        shape,
        hasHero,
        distribution,
      });
    }
  }
  
  // Shuffle for variety in rating session
  return shuffleArray(cases).slice(0, count);
}
