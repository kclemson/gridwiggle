export interface PhotoItem {
  id: string;
  originalDataUrl: string;
  originalWidth: number;
  originalHeight: number;
  smartCrop: CropRegion | null;
  manualCrop: CropRegion | null;
  isProcessing: boolean;
  error: string | null;
}

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
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

export interface CollageState {
  photos: PhotoItem[];
  settings: CollageSettings;
  layout: CollageLayout | null;
  step: 'upload' | 'review' | 'collage';
}
