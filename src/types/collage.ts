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
  objectUrl: string;          // For <img src> rendering
  blob: Blob;                 // For canvas operations
  originalWidth: number;
  originalHeight: number;
  smartCrop: CropRegion | null;
  manualCrop: CropRegion | null;
  isProcessing: boolean;
  error: string | null;
  priority: PhotoPriority;    // Default: 3 (standard)
}

/**
 * Photo metadata persisted to localStorage (no image data).
 */
export interface PhotoMetadata {
  id: string;
  originalWidth: number;
  originalHeight: number;
  smartCrop: CropRegion | null;
  manualCrop: CropRegion | null;
  priority: PhotoPriority;
}

export interface CollageSettings {
  orientation: 'auto' | 'landscape' | 'portrait' | 'square';
  gapColor: string;
  gapSize: number;
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
}
