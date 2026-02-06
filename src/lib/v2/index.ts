/**
 * V2 Layout Entry Point
 * 
 * Main API for generating collage layouts using the v2 algorithm.
 */

import { PhotoItem, CollageSettings, CollageLayout, CollageCell } from '@/types/collage';
import { getDisplayCrop } from '@/lib/cropUtils';
import { PhotoDimension, LayoutCandidate, V2Tuning, DEFAULT_V2_TUNING } from './types';
import { generateCandidates } from './strategy';
import { shuffleArray } from './math';
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

export interface GenerateLayoutV2Options {
  photoWeights?: Record<string, number>;
  randomize?: boolean;
  tuning?: Partial<V2Tuning>;
  /** Canvas width - no longer hardcoded, caller provides */
  canvasWidth?: number;
}

/**
 * Generate a collage layout using the v2 algorithm.
 * 
 * @param photos - Photos to include in the collage
 * @param settings - User's collage settings (shape, gap, etc.)
 * @param options - Generation options
 * @returns CollageLayout or null if generation fails
 */
export function generateCollageLayoutV2(
  photos: PhotoItem[],
  settings: CollageSettings,
  options: GenerateLayoutV2Options = {}
): CollageLayout | null {
  if (photos.length < 2) return null;
  
  const { 
    photoWeights = {}, 
    randomize = false, 
    tuning: tuningOverrides,
    canvasWidth: providedCanvasWidth,
  } = options;
  const tuning: V2Tuning = { ...DEFAULT_V2_TUNING, ...tuningOverrides };
  
  // Canvas width from caller - fall back to a reasonable default
  // This should ideally come from the container/preview size
  const canvasWidth = providedCanvasWidth ?? 480;
  const gap = settings.gapSize;
  
  devLogger.log('v2', 'Starting V2 layout generation', {
    photoCount: photos.length,
    shape: settings.shape,
    canvasWidth,
    randomize,
  });
  
  // Extract dimensions with weights
  const dimensions = extractPhotoDimensions(photos, photoWeights);
  
  // Identify heroes (weight > 1)
  const heroIds = new Set(
    dimensions.filter(d => d.weight > 1).map(d => d.id)
  );
  
  devLogger.log('v2', 'Photo analysis', {
    heroCount: heroIds.size,
    avgAR: dimensions.reduce((s, d) => s + d.aspectRatio, 0) / dimensions.length,
  });
  
  // Generate candidates from different strategies
  const candidates = generateCandidates(
    dimensions,
    heroIds,
    canvasWidth,
    gap,
    settings.shape,
    tuning,
    randomize
  );
  
  if (candidates.length === 0) {
    devLogger.log('v2', 'No valid candidates generated');
    return null;
  }
  
  // Sort by score (highest first)
  candidates.sort((a, b) => b.score - a.score);
  
  // Log top candidates
  for (let i = 0; i < Math.min(3, candidates.length); i++) {
    const c = candidates[i];
    devLogger.log('v2', `Candidate ${i + 1}: ${c.metadata?.strategy}`, {
      score: c.score.toFixed(3),
      canvasAR: (c.canvasWidth / c.canvasHeight).toFixed(2),
      areaCV: c.metadata?.areaCV?.toFixed(3),
    });
  }
  
  // Select winner
  let selected: LayoutCandidate;
  
  if (randomize && candidates.length > 1) {
    // Pick randomly from top 3 with probability proportional to score
    const topN = candidates.slice(0, 3);
    const totalScore = topN.reduce((s, c) => s + c.score, 0);
    
    if (totalScore > 0) {
      const rand = Math.random() * totalScore;
      let cumulative = 0;
      selected = topN[0];
      
      for (const c of topN) {
        cumulative += c.score;
        if (rand <= cumulative) {
          selected = c;
          break;
        }
      }
    } else {
      selected = topN[Math.floor(Math.random() * topN.length)];
    }
  } else {
    selected = candidates[0];
  }
  
  devLogger.log('v2', 'Selected layout', {
    strategy: selected.metadata?.strategy,
    score: selected.score.toFixed(3),
    canvasHeight: Math.round(selected.canvasHeight),
  });
  
  // Convert to CollageLayout format
  const cells: CollageCell[] = selected.cells.map(cell => ({
    photoId: cell.photoId,
    x: Math.round(cell.x),
    y: Math.round(cell.y),
    width: Math.round(cell.width),
    height: Math.round(cell.height),
  }));
  
  return {
    width: Math.round(selected.canvasWidth),
    height: Math.round(selected.canvasHeight),
    cells,
  };
}

// Re-export types for convenience
export type { V2Tuning, PhotoDimension, LayoutCandidate } from './types';
export { DEFAULT_V2_TUNING } from './types';
