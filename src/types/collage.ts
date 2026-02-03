export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
}

export interface CollageSettings {
  orientation: 'portrait' | 'landscape';
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
