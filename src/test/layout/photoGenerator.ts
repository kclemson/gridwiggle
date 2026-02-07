import { SyntheticPhoto } from './types';

/**
 * Aspect ratio bounds for sampling.
 */
const MIN_ASPECT = 0.5;   // 9:16 portrait
const MAX_ASPECT = 3.0;   // Panorama

/**
 * Photo counts designed to expose edge cases in row-packing math.
 */
export const TEST_PHOTO_COUNTS = [5, 6, 8, 9, 10, 12, 14, 16, 17, 20, 23, 30, 35] as const;

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
      // Realistic hero AR distribution
      // 5% very tall portrait, 25% portrait, 25% square-ish,
      // 35% moderate landscape, 10% wide panorama
      const roll = Math.random();
      
      if (roll < 0.05) {
        // 5%: Very tall portrait (tight face crops, vertical products)
        aspectRatio = 0.4 + Math.random() * 0.2;  // AR 0.4 - 0.6
      } else if (roll < 0.30) {
        // 25%: Portrait
        aspectRatio = 0.6 + Math.random() * 0.3;  // AR 0.6 - 0.9
      } else if (roll < 0.55) {
        // 25%: Square-ish
        aspectRatio = 0.9 + Math.random() * 0.3;  // AR 0.9 - 1.2
      } else if (roll < 0.90) {
        // 35%: Moderate landscape
        aspectRatio = 1.2 + Math.random() * 0.6;  // AR 1.2 - 1.8
      } else {
        // 10%: Wide panorama
        aspectRatio = 2.0 + Math.random() * 1.0;  // AR 2.0 - 3.0
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
