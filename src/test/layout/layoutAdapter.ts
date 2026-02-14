import { generateCollageLayoutV4 } from '@/lib/v4/index';
import { 
  CollageSettings, 
  PhotoItem, 
  CollageLayout,
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
import { coefficientOfVariation, shuffleArray } from '@/lib/v3/utils';

/**
 * Convert a synthetic photo to the PhotoItem format expected by the layout algorithm.
 */
export function syntheticToPhotoItem(photo: SyntheticPhoto): PhotoItem {
  return {
    id: photo.id,
    objectUrl: '',
    blob: new Blob(),
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
  const heroPhoto = photos.find(p => p.priority === 1);
  const heroId = heroPhoto?.id ?? null;
  
  const allAreas = layout.cells.map(cell => cell.width * cell.height);
  const canvasArea = layout.width * layout.height;
  
  const supportingAreas = heroId 
    ? layout.cells.filter(c => c.photoId !== heroId).map(c => c.width * c.height)
    : allAreas;
  
  const cellAreaPercents = layout.cells
    .map(cell => Math.round((cell.width * cell.height) / canvasArea * 100))
    .sort((a, b) => b - a);
  
  let heroCoverage: number | null = null;
  let heroToRunnerUpRatio: number | null = null;
  
  if (heroPhoto) {
    const heroCell = layout.cells.find(c => c.photoId === heroPhoto.id);
    if (heroCell) {
      const heroArea = heroCell.width * heroCell.height;
      heroCoverage = heroArea / canvasArea;
      
      const nonHeroCells = layout.cells.filter(c => c.photoId !== heroPhoto.id);
      if (nonHeroCells.length > 0) {
        const runnerUpArea = Math.max(...nonHeroCells.map(c => c.width * c.height));
        heroToRunnerUpRatio = heroArea / runnerUpArea;
      }
    }
  }
  
  const cellsByY = new Map<number, typeof layout.cells>();
  for (const cell of layout.cells) {
    const roundedY = Math.round(cell.y);
    if (!cellsByY.has(roundedY)) {
      cellsByY.set(roundedY, []);
    }
    cellsByY.get(roundedY)!.push(cell);
  }
  
  const sortedYs = Array.from(cellsByY.keys()).sort((a, b) => a - b);
  const rowSizes = sortedYs.map(y => cellsByY.get(y)!.length);
  
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
 * Run a test case through the layout algorithm and compute metrics.
 */
export function runLayoutTest(testCase: LayoutTestCase): LayoutTestResult {
  const { photos, shapeSlider } = testCase;
  
  const photoItems = photos.map(syntheticToPhotoItem);
  
  const photoWeights: Record<string, number> = {};
  for (const photo of photos) {
    photoWeights[photo.id] = photo.priority === 1 ? 2.0 : 1.0;
  }
  
  const v3Tuning: Partial<V3Tuning> = {};
  
  const settings: CollageSettings = {
    shapeSlider,
    gapColor: '#000000',
    gapSize: 4,
    exportScale: 1,
  };
  
  const result = generateCollageLayoutV4(photoItems, settings, {
    photoWeights,
    randomize: false,
    tuning: v3Tuning,
  });
  
  const layout = result?.layout ?? null;
  
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
  
  const metrics = calculateMetrics(layout, photos);
  
  return {
    testCase,
    layout,
    ...metrics,
  };
}

/**
 * Generate a batch of diverse test cases for rating.
 * All cases use shapeSlider: null (auto) since shape is now a continuous slider.
 */
export function generateTestBatch(count: number): LayoutTestCase[] {
  const cases: LayoutTestCase[] = [];
  const VARIATIONS_PER_COMBO = 5;
  
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
      cases.push({
        photos: generatePhotoSet(photoCount, orientationBias, heroCount),
        shapeSlider: null,
        heroCount,
        orientationBias,
      });
    }
  }
  
  return shuffleArray(cases).slice(0, count);
}
