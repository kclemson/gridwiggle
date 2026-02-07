/**
 * V3 Layout Entry Point
 * 
 * First-principles layout engine using constraint intersection
 * and sub-rectangle decomposition.
 */

import { PhotoItem, CollageSettings, CollageLayout, CollageCell } from '@/types/collage';
import { getDisplayCrop } from '@/lib/cropUtils';
import { PhotoDimension, V3Tuning, DEFAULT_V3_TUNING } from './types';
import { findValidConfiguration, getLastRejection, clearRejections } from './intersection';
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
    randomize = false,
  } = options;
  
  const tuning: V3Tuning = { ...DEFAULT_V3_TUNING, ...tuningOverrides };
  
  // Map slider (0-100) directly to normalized gap (0 to 0.04)
  // Middle of slider (~50) produces ~0.02, matching current default
  const normalizedGap = (settings.gapSize / 100) * 0.04;
  
  devLogger.log('v3', 'Starting V3 layout generation', {
    photoCount: photos.length,
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
  
  // Clear rejection tracking before search
  clearRejections();
  
  // Find valid configuration through constraint intersection
  const config = findValidConfiguration(dimensions, normalizedGap, tuning, randomize);
  
  if (!config) {
    devLogger.log('v3', 'No valid configuration found');
    // Production logging - always emit on failure
    const rejection = getLastRejection();
    const avgAR = dimensions.reduce((s, d) => s + d.aspectRatio, 0) / dimensions.length;
    console.warn('[V3 Layout] Generation failed', {
      photoCount: photos.length,
      heroCount,
      avgAR: +avgAR.toFixed(2),
      reason: rejection?.reason ?? 'No valid proposals',
      ...rejection?.details,
    });
    return null;
  }
  
  devLogger.log('v3', 'Selected layout', {
    mode: config.proposal.mode,
    position: config.proposal.position,
    prominenceRatio: config.prominenceRatio.toFixed(2),
    score: config.score.toFixed(3),
  });
  
  // Convert to CollageLayout format
  // Cells are in normalized space - just pass through (rounding for cleaner output)
  const cells: CollageCell[] = config.cells.map(cell => ({
    photoId: cell.photoId,
    x: cell.x,
    y: cell.y,
    width: cell.width,
    height: cell.height,
  }));
  
  devLogger.log('v3', 'Final layout dimensions', {
    width: config.canvasWidth.toFixed(3),
    height: config.canvasHeight.toFixed(3),
    aspectRatio: (config.canvasWidth / config.canvasHeight).toFixed(2),
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
