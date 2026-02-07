import { SyntheticPhoto } from './types';

/**
 * Aspect ratio bounds for sampling.
 */
const MIN_ASPECT = 0.5;   // 9:16 portrait
const MAX_ASPECT = 3.0;   // Panorama

/**
 * Photo counts designed to expose edge cases in row-packing math.
 */
export const TEST_PHOTO_COUNTS = [8, 9, 10, 12, 14, 17, 23, 35, 50] as const;

/**
 * Sample an aspect ratio using triangular distribution.
 * orientationBias: -1 (portrait) to +1 (landscape), 0 = balanced
 */
export function sampleAspectRatio(orientationBias: number): number {
  // Center shifts from 0.75 (portrait-ish) to 1.25 (landscape-ish)
  const center = 1.0 + orientationBias * 0.5;
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
 */
export function generatePhotoSet(
  count: number,
  orientationBias: number,
  hasHero: boolean
): SyntheticPhoto[] {
  const photos: SyntheticPhoto[] = [];
  
  for (let i = 0; i < count; i++) {
    const isHero = hasHero && i === 0;
    let aspectRatio: number;
    
    if (isHero) {
      // Hero spans from square to panorama
      // 70% chance: moderate landscape (AR 1.0-1.8)
      // 30% chance: wide panorama (AR 2.0-3.0)
      if (Math.random() < 0.3) {
        // Wide panorama hero - enables beside=0 layouts
        aspectRatio = 2.0 + Math.random() * 1.0;
      } else {
        // Standard landscape-biased hero
        aspectRatio = sampleAspectRatio(0.3 + Math.random() * 0.4);
      }
    } else {
      aspectRatio = sampleAspectRatio(orientationBias);
    }
    
    photos.push(createSyntheticPhoto(
      `photo-${i + 1}`,
      aspectRatio,
      isHero ? 1 : 3
    ));
  }
  
  return photos;
}
