/**
 * ContentPool Entity
 * 
 * Evaluates region viability and provides content statistics.
 * Works in normalized space (hero height = 1.0).
 */

import { 
  PhotoDimension, 
  RegionSpec, 
  ContentStats,
  V3Tuning
} from '../types';
import { calculateContentStats } from '../utils';

// ============================================================================
// Content Statistics
// ============================================================================

/**
 * Get aggregate statistics for content photos.
 */
export function getContentStats(photos: PhotoDimension[]): ContentStats {
  return calculateContentStats(photos);
}

// ============================================================================
// Region Viability
// ============================================================================

/**
 * Evaluate if a region can viably hold at least one photo.
 * In normalized space, any positive-dimension region is viable.
 */
export interface RegionEvaluation {
  viable: boolean;
  reason?: string;
  estimatedCapacity: number;
}

export function evaluateRegion(
  region: RegionSpec,
  photos: PhotoDimension[],
  _tuning: V3Tuning
): RegionEvaluation {
  // In normalized space, any region with positive dimensions is viable
  const heightToCheck = Number.isFinite(region.height) ? region.height : 1.0;
  
  if (region.width <= 0 || heightToCheck <= 0) {
    return {
      viable: false,
      reason: `Region has non-positive dimensions: ${region.width.toFixed(3)} x ${heightToCheck.toFixed(3)}`,
      estimatedCapacity: 0,
    };
  }
  
  if (photos.length === 0) {
    return { viable: true, estimatedCapacity: 0 };
  }
  
  // Estimate capacity based on region area vs average photo area
  // In normalized space, photos have area ~ meanAR × 1 (at row height = 1)
  const stats = calculateContentStats(photos);
  const avgPhotoArea = stats.meanAR; // height=1, width=meanAR
  const regionArea = region.width * heightToCheck;
  const estimatedCapacity = Math.floor(regionArea / avgPhotoArea);
  
  return {
    viable: true,
    estimatedCapacity: Math.max(1, estimatedCapacity),
  };
}
