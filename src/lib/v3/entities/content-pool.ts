/**
 * ContentPool Entity
 * 
 * Evaluates region viability and provides content statistics.
 */

import { 
  PhotoDimension, 
  RegionSpec, 
  ContentStats,
  V3Tuning
} from '../types';
import { calculateContentStats, isRegionViable } from '../utils';

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
 */
export interface RegionEvaluation {
  viable: boolean;
  reason?: string;
  estimatedCapacity: number;
}

export function evaluateRegion(
  region: RegionSpec,
  photos: PhotoDimension[],
  tuning: V3Tuning
): RegionEvaluation {
  // For unbounded regions, check width only
  const heightToCheck = Number.isFinite(region.height) ? region.height : tuning.region_minHeight;
  
  if (!isRegionViable(region.width, heightToCheck, tuning.region_minWidth, tuning.region_minHeight)) {
    return {
      viable: false,
      reason: `Region ${Math.round(region.width)}x${Math.round(heightToCheck)} below minimum ${tuning.region_minWidth}x${tuning.region_minHeight}`,
      estimatedCapacity: 0,
    };
  }
  
  if (photos.length === 0) {
    return { viable: true, estimatedCapacity: 0 };
  }
  
  // Estimate capacity based on region area vs average photo area
  const stats = calculateContentStats(photos);
  const avgPhotoArea = (tuning.region_minHeight * tuning.region_minHeight) * stats.meanAR;
  const regionArea = region.width * heightToCheck;
  const estimatedCapacity = Math.floor(regionArea / avgPhotoArea);
  
  return {
    viable: true,
    estimatedCapacity: Math.max(1, estimatedCapacity),
  };
}
