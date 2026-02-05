import { CropRegion, PhotoItem } from '@/types/collage';

// Minimum crop dimension in pixels
export const MIN_CROP_SIZE = 50;

/**
 * Check if crop dimensions meet minimum size requirements.
 */
export function isValidCrop(crop: CropRegion): boolean {
  return crop.width >= MIN_CROP_SIZE && crop.height >= MIN_CROP_SIZE;
}

/**
 * Clamp crop coordinates to stay within image bounds.
 * Ensures x, y are non-negative and crop doesn't extend past edges.
 */
export function clampCropToImage(
  crop: CropRegion,
  imageWidth: number,
  imageHeight: number
): CropRegion {
  const x = Math.max(0, Math.min(crop.x, imageWidth - MIN_CROP_SIZE));
  const y = Math.max(0, Math.min(crop.y, imageHeight - MIN_CROP_SIZE));
  const width = Math.max(MIN_CROP_SIZE, Math.min(crop.width, imageWidth - x));
  const height = Math.max(MIN_CROP_SIZE, Math.min(crop.height, imageHeight - y));
  
  return { x, y, width, height };
}

/**
 * Get the preferred crop (manualCrop takes precedence over smartCrop).
 * Does NOT validate - returns raw crop or null.
 */
export function getPreferredCrop(
  photo: { manualCrop: CropRegion | null; smartCrop: CropRegion | null }
): CropRegion | null {
  return photo.manualCrop || photo.smartCrop;
}

/**
 * Get the display-ready crop for a photo.
 * Returns null if no valid crop exists or dimensions are missing.
 * This is the main function to use for rendering.
 */
export function getDisplayCrop(photo: PhotoItem): CropRegion | null {
  // Can't compute crop without dimensions
  if (!photo.originalWidth || !photo.originalHeight) {
    return null;
  }
  
  const crop = getPreferredCrop(photo);
  if (!crop) {
    return null;
  }
  
  // Clamp to image bounds
  const clamped = clampCropToImage(crop, photo.originalWidth, photo.originalHeight);
  
  // Validate after clamping
  if (!isValidCrop(clamped)) {
    return null;
  }
  
  return clamped;
}

/**
 * Get initial crop for the crop editor.
 * If no valid crop exists, returns a centered 80% crop.
 */
export function getEditorInitialCrop(photo: PhotoItem): CropRegion {
  const displayCrop = getDisplayCrop(photo);
  
  if (displayCrop) {
    return { ...displayCrop };
  }
  
  // Default to full image (no crop)
  return {
    x: 0,
    y: 0,
    width: photo.originalWidth,
    height: photo.originalHeight,
  };
}
