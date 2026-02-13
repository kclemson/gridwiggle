import type { LogEntry } from '@/lib/devLogger';

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Photo priority for layout weighting.
 * 1 = hero (largest), 2 = medium, 3 = standard (default).
 * Currently UI only supports 1 (hero) vs 3 (standard), but 2 is reserved for future expansion.
 */
export type PhotoPriority = 1 | 2 | 3;

/**
 * Runtime photo state (in-memory).
 * objectUrl and blob are NOT persisted - they're hydrated from IndexedDB on load.
 */
export interface PhotoItem {
  id: string;
  filename?: string;          // Original filename for debugging
  objectUrl: string;          // For <img src> rendering (full-res, used for export)
  blob: Blob;                 // For canvas operations (export)
  originalWidth: number;
  originalHeight: number;
  smartCrop: CropRegion | null;
  manualCrop: CropRegion | null;
  isProcessing: boolean;
  error: string | null;
  priority: PhotoPriority;    // Default: 3 (standard)
  smartCropAttempted: boolean; // True after DETR ran (even if no person found)
  previewUrl?: string;        // Scaled-down preview for crop editor (~1200px max)
  previewBlob?: Blob;         // Preview blob for memory management
  thumbnailUrl?: string;      // Smaller preview for collage canvas (~480px max)
  thumbnailBlob?: Blob;       // Thumbnail blob for memory management
}

/**
 * Photo metadata persisted to localStorage (no image data).
 */
export interface PhotoMetadata {
  id: string;
  filename?: string;          // Original filename for debugging
  originalWidth: number;
  originalHeight: number;
  smartCrop: CropRegion | null;
  manualCrop: CropRegion | null;
  priority: PhotoPriority;
  smartCropAttempted?: boolean; // Optional for backwards compatibility with old data
}

export interface CollageSettings {
  shape: 'auto' | 'landscape' | 'portrait' | 'square';
  gapColor: string;
  gapSize: number;
  exportScale: 1 | 1.5 | 2;
}

export interface CollageLayout {
  width: number;
  height: number;
  cells: CollageCell[];
}

export interface CollageCell {
  photoId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Full collage state (runtime only - not directly persisted).
 */
export interface CollageState {
  photos: PhotoItem[];
  settings: CollageSettings;
  layout: CollageLayout | null;
}

/**
 * What gets persisted to localStorage (metadata only, no image data).
 */
export interface PersistedCollageState {
  photos: PhotoMetadata[];
  settings: CollageSettings;
  layout: CollageLayout | null;
  debugLogs?: LogEntry[];  // Optional for backwards compatibility
}

/**
 * Layout tuning parameters for real-time experimentation.
 * DEV-only feature for debugging and tuning the layout algorithm.
 */
export interface LayoutTuning {
  // Hero beside packing
  maxBeside1Row: number;      // Max photos beside hero in 1-row mode (default 4)
  maxBeside2Row: number;      // Max photos beside hero in 2-row mode (default 6)
  maxBeside3Row: number;      // Max photos beside hero in 3-row mode (default 12)
  // Content blocks
  contentPhotosPerBlock: number;  // Photos per full-width content row block (default 4)
  
  // Hero fraction bounds
  heroMinFraction: number;    // Minimum hero width fraction (default 0.30)
  heroMaxFraction: number;    // Maximum hero width fraction (default 0.60)
  
  // Scale tolerance
  scaleToleranceLow: number;  // Reject configs that scale below this (default 0.75)
  scaleToleranceHigh: number; // Reject configs that scale above this (default 1.25)
  
  // Balance controls
  maxBesideFraction: number;  // Hero beside can consume at most this % of total photos (default 0.6)
  minContentPhotos: number;   // Reserve at least this many photos for content blocks (default 4)
  minPhotosPerRow: number;    // Content rows must have at least this many photos (default 2)
  
  // Mathematical structure selection (unified aspect geometry)
  baseMaxBesideFraction: number;  // Max % of non-hero photos in beside zone (default 0.40)
  minBelowPhotos: number;         // Reserve this many for below zone (default 3)
  aspectContrastFloor: number;    // Min aspect contrast modifier (default 0.8)
  aspectContrastCap: number;      // Max aspect contrast modifier (default 1.3)
  minHeroProminenceRatio: number; // Hero must be this much bigger than runner-up (default 1.3)
  
  // Canvas-level hero prominence
  minHeroCoverage: number;        // Minimum hero area as % of total canvas (default 0.08 = 8%)
}

export const DEFAULT_TUNING: LayoutTuning = {
  maxBeside1Row: 4,
  maxBeside2Row: 6,
  maxBeside3Row: 12,
  contentPhotosPerBlock: 4,
  heroMinFraction: 0.30,
  heroMaxFraction: 0.60,
  scaleToleranceLow: 0.75,
  scaleToleranceHigh: 1.25,
  maxBesideFraction: 0.6,
  minContentPhotos: 4,
  minPhotosPerRow: 2,
  
  // Mathematical structure selection
  baseMaxBesideFraction: 0.40,
  minBelowPhotos: 3,
  aspectContrastFloor: 0.8,
  aspectContrastCap: 1.3,
  minHeroProminenceRatio: 1.3,
  
  // Canvas-level hero prominence
  minHeroCoverage: 0.08,  // 8% of canvas
};

/**
 * Minimum photos required for each shape option.
 * Square is hardest to satisfy, requiring more photos.
 */
export const MIN_PHOTOS_FOR_SHAPE: Record<'landscape' | 'portrait' | 'square', number> = {
  landscape: 8,
  portrait: 8,
  square: 10,
};

/**
 * Minimum photos required to allow any shape control (the lowest threshold).
 * With fewer photos, aspect ratio constraints are too hard to satisfy.
 */
export const MIN_PHOTOS_FOR_SHAPE_CONTROL = 8;

/**
 * Check if a shape is available for a given photo count.
 * 'auto' is always available.
 */
export function isShapeAvailable(
  shape: 'auto' | 'landscape' | 'portrait' | 'square',
  photoCount: number
): boolean {
  if (shape === 'auto') return true;
  return photoCount >= MIN_PHOTOS_FOR_SHAPE[shape];
}
