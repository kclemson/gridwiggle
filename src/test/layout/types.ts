import { CollageLayout, CollageSettings, LayoutTuning, PhotoPriority } from '@/types/collage';

/**
 * Tag constants for categorizing layout issues and qualities.
 */
export const LAYOUT_ISSUE_TAGS = [
  'hero-not-prominent',
  'hero-too-dominant',
  'single-photo-row',
  'row-too-dense',
  'unbalanced-sizes',
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
 * A single test case to run through the layout algorithm.
 */
export interface LayoutTestCase {
  photos: SyntheticPhoto[];
  shape: CollageSettings['shape'];
  hasHero: boolean;
  orientationBias: number;  // -1 (portrait) to +1 (landscape), 0 = balanced
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
  areaCoefficientOfVariation: number;  // Size uniformity of SUPPORTING photos (excludes hero)
  largestToSmallestRatio: number;      // Max/min area among SUPPORTING photos (excludes hero)
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
  orientationBias: number;  // -1 (portrait) to +1 (landscape), 0 = balanced
  shape: CollageSettings['shape'];
  hasHero: boolean;
  
  // Layout metrics
  rowCount: number;
  rowSizes: number[];
  rowHeroAdjacent: boolean[];  // Which rows overlap vertically with hero
  canvasAspect: number;
  areaCoefficientOfVariation: number;  // Size uniformity of SUPPORTING photos (excludes hero)
  largestToSmallestRatio: number;      // Max/min area among SUPPORTING photos (excludes hero)
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
