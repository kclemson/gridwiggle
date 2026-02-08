import { SyntheticPhoto } from './types';

/**
 * Aspect ratio bounds for sampling.
 */
const MIN_ASPECT = 0.5;   // 9:16 portrait
const MAX_ASPECT = 3.0;   // Panorama

/**
 * Common real-world aspect ratios with weights.
 * Based on DSLR (3:2), phone (4:3), widescreen (16:9), and square formats.
 */
const COMMON_ASPECT_RATIOS = [
  { ar: 1.50, weight: 25 },  // 3:2 DSLR landscape (most common)
  { ar: 1.33, weight: 20 },  // 4:3 phone landscape
  { ar: 0.75, weight: 20 },  // 4:3 phone portrait
  { ar: 0.67, weight: 15 },  // 3:2 DSLR portrait
  { ar: 1.78, weight: 10 },  // 16:9 widescreen
  { ar: 0.56, weight: 5 },   // 9:16 vertical video
  { ar: 1.00, weight: 5 },   // Square (rare in practice)
];

/**
 * Photo counts designed to expose edge cases in row-packing math.
 */
export const TEST_PHOTO_COUNTS = [5, 6, 8, 9, 10, 12, 14, 16, 17, 20, 23, 30, 35] as const;

/**
 * Sample an aspect ratio from common camera/device ratios.
 * orientationBias: -1 (portrait) to +1 (landscape), 0 = balanced
 */
export function sampleAspectRatio(orientationBias: number): number {
  // Adjust weights based on orientation bias
  // bias < 0 = more portrait, bias > 0 = more landscape
  const adjustedRatios = COMMON_ASPECT_RATIOS.map(({ ar, weight }) => {
    const isLandscape = ar > 1.0;
    const multiplier = isLandscape 
      ? 1 + orientationBias  // boost landscape when bias > 0
      : 1 - orientationBias; // boost portrait when bias < 0
    return { ar, weight: weight * Math.max(0.1, multiplier) };
  });
  
  // Weighted random selection
  const totalWeight = adjustedRatios.reduce((s, r) => s + r.weight, 0);
  let roll = Math.random() * totalWeight;
  
  for (const { ar, weight } of adjustedRatios) {
    roll -= weight;
    if (roll <= 0) {
      // Add ±10% jitter for variety
      const jitter = 1 + (Math.random() - 0.5) * 0.2;
      return Math.max(MIN_ASPECT, Math.min(MAX_ASPECT, ar * jitter));
    }
  }
  
  return 1.33; // Fallback
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
