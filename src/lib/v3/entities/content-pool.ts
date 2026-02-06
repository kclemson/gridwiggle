/**
 * ContentPool Entity
 * 
 * Evaluates region viability and distributes photos.
 * Row counts are derived from geometry, not specified.
 */

import { 
  PhotoDimension, 
  RegionSpec, 
  ContentStats,
  PhotoDistribution,
  LayoutCell,
  V3Tuning
} from '../types';
import { calculateContentStats, isRegionViable } from '../utils';
import { packPhotosIntoRegion } from '../row-pack';

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
  // Basic dimension check
  if (!isRegionViable(region.width, region.height, tuning.region_minWidth, tuning.region_minHeight)) {
    return {
      viable: false,
      reason: `Region ${Math.round(region.width)}x${Math.round(region.height)} below minimum ${tuning.region_minWidth}x${tuning.region_minHeight}`,
      estimatedCapacity: 0,
    };
  }
  
  if (photos.length === 0) {
    return { viable: true, estimatedCapacity: 0 };
  }
  
  // Estimate capacity based on region area vs average photo area
  const stats = calculateContentStats(photos);
  const avgPhotoArea = (tuning.region_minHeight * tuning.region_minHeight) * stats.meanAR;
  const regionArea = region.width * region.height;
  const estimatedCapacity = Math.floor(regionArea / avgPhotoArea);
  
  return {
    viable: true,
    estimatedCapacity: Math.max(1, estimatedCapacity),
  };
}

// ============================================================================
// Photo Distribution
// ============================================================================

/**
 * Distribute photos across regions proportionally by area.
 */
export function distributePhotos(
  photos: PhotoDimension[],
  regions: RegionSpec[]
): PhotoDistribution {
  if (regions.length === 0 || photos.length === 0) {
    return { assignments: new Map(), totalAssigned: 0 };
  }
  
  const assignments = new Map<number, string[]>();
  
  // Calculate total region area
  const totalArea = regions.reduce((sum, r) => sum + r.width * r.height, 0);
  
  // Distribute proportionally
  let photosRemaining = [...photos];
  let assigned = 0;
  
  regions.forEach((region, index) => {
    if (photosRemaining.length === 0) {
      assignments.set(index, []);
      return;
    }
    
    // Calculate this region's share
    const regionArea = region.width * region.height;
    const share = regionArea / totalArea;
    
    // For last region, take all remaining
    const isLast = index === regions.length - 1;
    const count = isLast 
      ? photosRemaining.length 
      : Math.max(1, Math.round(photos.length * share));
    
    const regionPhotos = photosRemaining.slice(0, count);
    assignments.set(index, regionPhotos.map(p => p.id));
    photosRemaining = photosRemaining.slice(count);
    assigned += regionPhotos.length;
  });
  
  return { assignments, totalAssigned: assigned };
}

// ============================================================================
// Full Region Packing
// ============================================================================

/**
 * Pack all regions with their assigned photos.
 * Returns final cells and computed canvas height.
 */
export function packAllRegions(
  photos: PhotoDimension[],
  regions: RegionSpec[],
  distribution: PhotoDistribution,
  gap: number,
  tuning: V3Tuning
): { cells: LayoutCell[]; totalHeight: number; contentAreas: number[] } {
  const allCells: LayoutCell[] = [];
  const contentAreas: number[] = [];
  let maxY = 0;
  
  // Create a map for quick photo lookup
  const photoMap = new Map(photos.map(p => [p.id, p]));
  
  regions.forEach((region, index) => {
    const photoIds = distribution.assignments.get(index) ?? [];
    const regionPhotos = photoIds
      .map(id => photoMap.get(id))
      .filter((p): p is PhotoDimension => p !== undefined);
    
    if (regionPhotos.length === 0) return;
    
    // Pack photos into this region
    const { cells, actualHeight } = packPhotosIntoRegion(
      regionPhotos,
      region,
      gap,
      tuning
    );
    
    allCells.push(...cells);
    
    // Track content areas for prominence check
    cells.forEach(cell => {
      contentAreas.push(cell.width * cell.height);
    });
    
    // Track max Y for canvas height
    const regionBottom = region.y + actualHeight;
    if (regionBottom > maxY) {
      maxY = regionBottom;
    }
  });
  
  return { cells: allCells, totalHeight: maxY, contentAreas };
}
