import { SyntheticPhoto, AspectDistribution } from './types';

/**
 * Common aspect ratios from real-world photo sources.
 */
export const COMMON_RATIOS = {
  phone_landscape: 4 / 3,      // 1.33
  phone_portrait: 3 / 4,       // 0.75
  wide_landscape: 16 / 9,      // 1.78
  wide_portrait: 9 / 16,       // 0.56
  square: 1.0,                 // 1:1
  dslr_landscape: 3 / 2,       // 1.5
  dslr_portrait: 2 / 3,        // 0.67
  social_portrait: 4 / 5,      // 0.8 (Instagram)
} as const;

/**
 * Photo counts designed to expose edge cases in row-packing math.
 */
export const TEST_PHOTO_COUNTS = [5, 6, 7, 9, 11, 12, 14, 17, 23, 35, 50] as const;

/**
 * Apply smart crop variation: moves ratio 10-30% toward square (1.0).
 * This simulates how smart crop tends to crop edges, making photos more square.
 */
export function applySmartCropVariation(baseAspect: number): number {
  const variation = 0.1 + Math.random() * 0.2; // 10-30%
  return baseAspect + (1.0 - baseAspect) * variation;
}

/**
 * Pick a random ratio based on distribution preset.
 */
function pickRatioForDistribution(distribution: AspectDistribution): number {
  const rand = Math.random();
  
  switch (distribution) {
    case 'phone-mix':
      // 70% portrait (3:4), 30% landscape (4:3)
      return rand < 0.7 ? COMMON_RATIOS.phone_portrait : COMMON_RATIOS.phone_landscape;
      
    case 'social-mix':
      // Mix of 1:1 (40%), 4:5 (35%), 16:9 (25%)
      if (rand < 0.4) return COMMON_RATIOS.square;
      if (rand < 0.75) return COMMON_RATIOS.social_portrait;
      return COMMON_RATIOS.wide_landscape;
      
    case 'camera-mix':
      // 60% 3:2 landscape, 40% 2:3 portrait
      return rand < 0.6 ? COMMON_RATIOS.dslr_landscape : COMMON_RATIOS.dslr_portrait;
      
    case 'balanced':
    default:
      // Equal mix of all common ratios
      const ratios = [
        COMMON_RATIOS.phone_landscape,
        COMMON_RATIOS.phone_portrait,
        COMMON_RATIOS.wide_landscape,
        COMMON_RATIOS.wide_portrait,
        COMMON_RATIOS.square,
        COMMON_RATIOS.dslr_landscape,
        COMMON_RATIOS.dslr_portrait,
      ];
      return ratios[Math.floor(rand * ratios.length)];
  }
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
 * @param distribution Distribution preset for aspect ratios
 * @param hasHero Whether to include a hero photo (priority 1)
 * @param smartCropRatio Fraction of photos to apply smart crop variation (0-1)
 */
export function generatePhotoSet(
  count: number,
  distribution: AspectDistribution,
  hasHero: boolean,
  smartCropRatio: number = 0.7
): SyntheticPhoto[] {
  const photos: SyntheticPhoto[] = [];
  
  for (let i = 0; i < count; i++) {
    const id = `photo-${i + 1}`;
    let aspectRatio = pickRatioForDistribution(distribution);
    
    // Apply smart crop variation to most photos
    if (Math.random() < smartCropRatio) {
      aspectRatio = applySmartCropVariation(aspectRatio);
    }
    
    // First photo is hero if hasHero is true
    const isHero = hasHero && i === 0;
    const priority: 1 | 2 | 3 = isHero ? 1 : 3;
    
    // Hero photos tend to be landscape or square
    if (isHero) {
      const heroRand = Math.random();
      if (heroRand < 0.5) {
        aspectRatio = COMMON_RATIOS.dslr_landscape; // 3:2
      } else if (heroRand < 0.8) {
        aspectRatio = COMMON_RATIOS.phone_landscape; // 4:3
      } else {
        aspectRatio = COMMON_RATIOS.square; // 1:1
      }
      // Light smart crop variation on hero too
      if (Math.random() < 0.5) {
        aspectRatio = applySmartCropVariation(aspectRatio);
      }
    }
    
    photos.push(createSyntheticPhoto(id, aspectRatio, priority));
  }
  
  return photos;
}

/**
 * Distribution weights for test case generation.
 */
export const DISTRIBUTION_WEIGHTS: Record<AspectDistribution, number> = {
  'phone-mix': 0.35,    // Most common (phone photos)
  'balanced': 0.30,     // Good variety
  'social-mix': 0.25,   // Instagram imports
  'camera-mix': 0.10,   // DSLR (less common)
};

/**
 * Pick a distribution based on weights.
 */
export function weightedRandomDistribution(): AspectDistribution {
  const rand = Math.random();
  let cumulative = 0;
  
  for (const [dist, weight] of Object.entries(DISTRIBUTION_WEIGHTS)) {
    cumulative += weight;
    if (rand < cumulative) {
      return dist as AspectDistribution;
    }
  }
  
  return 'balanced';
}
