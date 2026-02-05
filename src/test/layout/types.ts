import { CollageLayout, CollageSettings, LayoutTuning, PhotoPriority } from '@/types/collage';

/**
 * Tag constants for categorizing layout issues and qualities.
 */
export const LAYOUT_ISSUE_TAGS = [
  'hero-not-prominent',
  'hero-too-dominant',
  'single-photo-row',
  'row-too-dense',
  'uneven-sizes',
  'wrong-shape',
  'extreme-aspect',
  'wasted-space',
] as const;

export const LAYOUT_POSITIVE_TAGS = [
  'well-balanced',
  'hero-works',
] as const;

export type LayoutTag =
  | typeof LAYOUT_ISSUE_TAGS[number]
  | typeof LAYOUT_POSITIVE_TAGS[number];

/**
 * Synthetic photo for layout testing - no actual image data.
 * Just aspect ratio and priority, which is all the algorithm needs.
 */
export interface SyntheticPhoto {
  id: string;
  aspectRatio: number;
  priority: PhotoPriority;
  // Required for PhotoItem compatibility
  originalWidth: number;
  originalHeight: number;
}

/**
 * Distribution presets for photo generation.
 * Weighted toward common real-world use cases.
 */
export type AspectDistribution = 
  | 'phone-mix'    // 70% portrait (3:4), 30% landscape (4:3)
  | 'social-mix'   // Mix of 1:1, 4:5, 16:9
  | 'camera-mix'   // 60% 3:2 landscape, 40% 2:3 portrait
  | 'balanced';    // Equal mix of all common ratios

/**
 * A single test case to run through the layout algorithm.
 */
export interface LayoutTestCase {
  photos: SyntheticPhoto[];
  shape: CollageSettings['shape'];
  hasHero: boolean;
  distribution: AspectDistribution;
  tuning?: Partial<LayoutTuning>;
}

/**
 * Results from running a test case through the layout algorithm.
 */
export interface LayoutTestResult {
  // Test case inputs
  testCase: LayoutTestCase;
  
  // Raw layout output
  layout: CollageLayout;
  
  // Computed metrics for analysis
  rowCount: number;
  rowSizes: number[];           // Photos per row
  rowHeroAdjacent: boolean[];   // Which rows overlap vertically with hero
  canvasAspect: number;         // width / height
  areaCoefficientOfVariation: number;  // Size uniformity (lower = more uniform)
  largestToSmallestRatio: number;      // Max area / min area
  heroCoverage: number | null;  // % of canvas area hero occupies
  cellAreaPercents: number[];   // All cell areas as %, sorted descending
  heroToRunnerUpRatio: number | null;  // Hero area / runner-up area
}

/**
 * A rated layout with user feedback.
 */
export interface RatedLayout {
  // Inputs
  photoCount: number;
  distribution: AspectDistribution;
  shape: CollageSettings['shape'];
  hasHero: boolean;
  
  // Layout metrics
  rowCount: number;
  rowSizes: number[];
  canvasAspect: number;
  areaCoefficientOfVariation: number;
  largestToSmallestRatio: number;
  heroCoverage: number | null;
  cellAreaPercents: number[];
  heroToRunnerUpRatio: number | null;
  
  // User rating
  rating: 'good' | 'bad' | 'skip';
  tags: LayoutTag[];  // Selected checkboxes for categorization
  
  // Timestamp for session tracking
  ratedAt: string;
}

/**
 * Session export format for analysis.
 */
export interface RatingSession {
  sessionId: string;
  totalRated: number;
  ratings: RatedLayout[];
  summary: {
    goodCount: number;
    badCount: number;
    skipCount: number;
  };
}
