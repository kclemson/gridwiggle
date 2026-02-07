/**
 * V3 Layout Entry Point
 * 
 * First-principles layout engine using constraint intersection
 * and sub-rectangle decomposition.
 */

import { PhotoItem, CollageSettings, CollageLayout, CollageCell } from '@/types/collage';
import { getDisplayCrop } from '@/lib/cropUtils';
import { PhotoDimension, V3Tuning, DEFAULT_V3_TUNING } from './types';
import { findValidConfiguration } from './intersection';
import { devLogger } from '@/lib/devLogger';

// ============================================================================
// Photo Extraction
// ============================================================================

/**
 * Extract layout-relevant dimensions from PhotoItems.
 */
function extractPhotoDimensions(
  photos: PhotoItem[],
  weights: Record<string, number> = {}
): PhotoDimension[] {
  return photos.map(photo => {
    const crop = getDisplayCrop(photo);
    const width = crop ? crop.width : photo.originalWidth;
    const height = crop ? crop.height : photo.originalHeight;
    return {
      id: photo.id,
      aspectRatio: width / height,
      weight: weights[photo.id] ?? 1,
    };
  });
}

// ============================================================================
// Main API
// ============================================================================

// ============================================================================
// Helpers
// ============================================================================

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ============================================================================
// Main API
// ============================================================================

export interface GenerateLayoutV3Options {
  /** Photo weights - hero photos have weight > 1 */
  photoWeights?: Record<string, number>;
  /** Tuning parameter overrides */
  tuning?: Partial<V3Tuning>;
  /** Canvas width - caller provides based on container */
  canvasWidth?: number;
  /** Shuffle photos for variety (refresh button) */
  randomize?: boolean;
}

/**
 * Generate a collage layout using the V3 algorithm.
 * 
 * V3 uses constraint intersection and sub-rectangle decomposition.
 * Row counts are derived from geometry, not specified.
 * 
 * @param photos - Photos to include in the collage
 * @param settings - User's collage settings (gap, etc.)
 * @param options - Generation options
 * @returns CollageLayout or null if generation fails
 */
export function generateCollageLayoutV3(
  photos: PhotoItem[],
  settings: CollageSettings,
  options: GenerateLayoutV3Options = {}
): CollageLayout | null {
  if (photos.length < 2) return null;
  
  const { 
    photoWeights = {}, 
    tuning: tuningOverrides,
    canvasWidth: providedCanvasWidth,
    randomize = false,
  } = options;
  
  const tuning: V3Tuning = { ...DEFAULT_V3_TUNING, ...tuningOverrides };
  const canvasWidth = providedCanvasWidth ?? 480;
  
  // Map spacing slider (0-100) to actual pixel gap (0-32px)
  const pixelGap = Math.round((settings.gapSize / 100) * 32);
  
  devLogger.log('v3', 'Starting V3 layout generation', {
    photoCount: photos.length,
    canvasWidth,
    tuning: {
      hero_targetProminence: tuning.hero_targetProminence,
      hero_minProminence: tuning.hero_minProminence,
    },
  });
  
  // Extract dimensions with weights
  let dimensions = extractPhotoDimensions(photos, photoWeights);
  
  // Shuffle for variety when requested
  if (randomize) {
    dimensions = shuffleArray(dimensions);
  }
  
  // Check for hero
  const heroCount = dimensions.filter(d => d.weight > 1).length;
  
  devLogger.log('v3', 'Photo analysis', {
    heroCount,
    contentCount: dimensions.length - heroCount,
    avgAR: dimensions.reduce((s, d) => s + d.aspectRatio, 0) / dimensions.length,
  });
  
  // Find valid configuration through constraint intersection
  const config = findValidConfiguration(dimensions, canvasWidth, pixelGap, tuning, randomize);
  
  if (!config) {
    devLogger.log('v3', 'No valid configuration found');
    return null;
  }
  
  devLogger.log('v3', 'Selected layout', {
    mode: config.proposal.mode,
    position: config.proposal.position,
    prominenceRatio: config.prominenceRatio.toFixed(2),
    score: config.score.toFixed(3),
    canvasHeight: Math.round(config.canvasHeight),
  });
  
  // Convert to CollageLayout format
  const cells: CollageCell[] = config.cells.map(cell => ({
    photoId: cell.photoId,
    x: Math.round(cell.x),
    y: Math.round(cell.y),
    width: Math.round(cell.width),
    height: Math.round(cell.height),
  }));
  
  devLogger.log('v3', 'Final layout dimensions', {
    inputWidth: canvasWidth,
    outputWidth: Math.round(config.canvasWidth),
    outputHeight: Math.round(config.canvasHeight),
    outputAR: (config.canvasWidth / config.canvasHeight).toFixed(2),
  });
  
  return {
    width: Math.round(config.canvasWidth),
    height: Math.round(config.canvasHeight),
    cells,
  };
}

// Re-export types for convenience
export type { V3Tuning, PhotoDimension } from './types';
export { DEFAULT_V3_TUNING } from './types';
