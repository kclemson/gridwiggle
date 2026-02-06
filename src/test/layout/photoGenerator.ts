import { SyntheticPhoto } from './types';

/**
 * Aspect ratio bounds for sampling.
 */
const MIN_ASPECT = 0.5;   // 9:16 portrait
const MAX_ASPECT = 2.0;   // 16:9 landscape

/**
 * Photo counts designed to expose edge cases in row-packing math.
 */
export const TEST_PHOTO_COUNTS = [8, 9, 10, 12, 14, 17, 23, 35, 50] as const;

/**
 * Apply smart crop variation: moves ratio 10-30% toward square (1.0).
 * This simulates how smart crop tends to crop edges, making photos more square.
 */
export function applySmartCropVariation(baseAspect: number): number {
  const variation = 0.15 + Math.random() * 0.35; // 15-50%
  return baseAspect + (1.0 - baseAspect) * variation;
}

/**
 * Sample an aspect ratio using triangular distribution.
 * orientationBias: -1 (portrait) to +1 (landscape), 0 = balanced
 */
export function sampleAspectRatio(orientationBias: number): number {
  // Center shifts from 0.75 (portrait-ish) to 1.25 (landscape-ish)
  const center = 1.0 + orientationBias * 0.25;
  const spread = 0.5;
  
  // Triangular distribution: sum of two uniforms shifted and scaled
  const u = Math.random();
  const v = Math.random();
  const sample = center + spread * (u - v);
  
  return Math.max(MIN_ASPECT, Math.min(MAX_ASPECT, sample));
}

/**
 * Generate a synthetic photo with the given aspect ratio and priority.
 */
function createSyntheticPhoto(
  id: string,
  aspectRatio: number,
  priority: 1 | 2 | 3 = 3
): SyntheticPhoto {
  // Use fixed width, derive height from aspect ratio
  const originalWidth = 1000;
  const originalHeight = Math.round(originalWidth / aspectRatio);
  
  return {
    id,
    aspectRatio,
    priority,
    originalWidth,
    originalHeight,
  };
}

/**
 * Generate a set of synthetic photos for testing.
 * 
 * @param count Number of photos to generate
 * @param orientationBias Bias from -1 (portrait) to +1 (landscape), 0 = balanced
 * @param hasHero Whether to include a hero photo (priority 1)
 * @param smartCropRatio Fraction of photos to apply smart crop variation (0-1)
 */
export function generatePhotoSet(
  count: number,
  orientationBias: number,
  hasHero: boolean,
  smartCropRatio: number = 0.5
): SyntheticPhoto[] {
  const photos: SyntheticPhoto[] = [];
  
  for (let i = 0; i < count; i++) {
    const isHero = hasHero && i === 0;
    let aspectRatio: number;
    
    if (isHero) {
      // Hero biased toward landscape/square (0.3 to 0.7 range)
      aspectRatio = sampleAspectRatio(0.3 + Math.random() * 0.4);
      if (Math.random() < 0.5) {
        aspectRatio = applySmartCropVariation(aspectRatio);
      }
    } else {
      aspectRatio = sampleAspectRatio(orientationBias);
      
      // Apply smart crop variation to some photos
      if (Math.random() < smartCropRatio) {
        aspectRatio = applySmartCropVariation(aspectRatio);
      }
    }
    
    photos.push(createSyntheticPhoto(
      `photo-${i + 1}`,
      aspectRatio,
      isHero ? 1 : 3
    ));
  }
  
  return photos;
}
