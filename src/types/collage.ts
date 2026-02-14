import type { LogEntry } from '@/lib/devLogger';

export const MIN_PHOTOS_FOR_SHAPE_SLIDER = 6;

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
  shapeSlider: number | null;  // null = auto (no constraint), 0-100 = AR constraint
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


