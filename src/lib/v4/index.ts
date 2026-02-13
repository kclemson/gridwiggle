/**
 * V4 Layout Orchestrator (thin wrapper)
 * 
 * Converts PhotoItem[] to PhotoDimension[], then delegates to the shared engine.
 * The engine is the single source of truth for the layout algorithm.
 */

import { PhotoItem, CollageSettings } from '@/types/collage';
import { getDisplayCrop } from '@/lib/cropUtils';
import { PhotoDimension, V3Tuning } from '@/lib/v3/types';
import { generateLayoutFromDimensions, EngineResult } from './engine';

// ============================================================================
// Types (re-exported for consumers)
// ============================================================================

export interface V4LayoutResult {
  layout: EngineResult['layout'];
  layoutMeta: Record<string, unknown>;
}

export interface GenerateLayoutV4Options {
  photoWeights?: Record<string, number>;
  tuning?: Partial<V3Tuning>;
  randomize?: boolean;
}

// Re-export engine for direct use (worker, fallback)
export { generateLayoutFromDimensions } from './engine';
export type { EngineResult } from './engine';

// ============================================================================
// Photo Extraction
// ============================================================================

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

export function generateCollageLayoutV4(
  photos: PhotoItem[],
  settings: CollageSettings,
  options: GenerateLayoutV4Options = {}
): V4LayoutResult | null {
  if (photos.length < 2) return null;
  
  const { 
    photoWeights = {}, 
    tuning: tuningOverrides = {},
    randomize = false,
  } = options;
  
  const normalizedGap = (settings.gapSize / 100) * 0.04;
  const dimensions = extractPhotoDimensions(photos, photoWeights);
  
  const result = generateLayoutFromDimensions(dimensions, normalizedGap, tuningOverrides, randomize);
  
  // Engine always returns a layout (never null), but we still return null
  // for the < 2 photos case above
  return {
    layout: result.layout,
    layoutMeta: result.layoutMeta ?? {},
  };
}
