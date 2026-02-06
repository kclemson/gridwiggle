/**
 * ContentPool Entity
 * 
 * Evaluates region viability and distributes photos.
 * Row counts are derived from geometry, not specified.
 * Supports constraint-aware distribution and packing.
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
import { packPhotosIntoRegion, PackingConstraints, PackingResult } from '../row-pack';

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

// ============================================================================
// Constraint-Aware Distribution
// ============================================================================

export interface DistributionResult {
  assignments: Map<number, string[]>;
  totalAssigned: number;
  splitInfo?: {
    besideCount: number;
    belowCount: number;
  };
}

/**
 * Distribute photos across regions with constraint awareness.
 * For 2-region corner decomposition, uses constraint-driven split search.
 */
export function distributePhotosConstrained(
  photos: PhotoDimension[],
  regions: RegionSpec[],
  gap: number,
  tuning: V3Tuning,
  maxCellArea?: number
): DistributionResult {
  if (regions.length === 0 || photos.length === 0) {
    return { assignments: new Map(), totalAssigned: 0 };
  }
  
  // For 2 regions (corner decomposition), use constraint-driven split
  if (regions.length === 2 && maxCellArea) {
    return findOptimalSplit(photos, regions, gap, tuning, maxCellArea);
  }
  
  // Fallback to simple proportional distribution for other cases
  return distributePhotosSimple(photos, regions);
}

/**
 * Find optimal photo split between BESIDE (bounded height) and BELOW (unbounded).
 * Searches candidate splits to find one that satisfies constraints.
 */
function findOptimalSplit(
  photos: PhotoDimension[],
  regions: RegionSpec[],
  gap: number,
  tuning: V3Tuning,
  maxCellArea: number
): DistributionResult {
  // Identify bounded vs unbounded regions
  const besideIdx = regions.findIndex(r => Number.isFinite(r.height));
  const belowIdx = regions.findIndex(r => !Number.isFinite(r.height));
  
  // If we can't identify both, fall back to simple distribution
  if (besideIdx === -1 || belowIdx === -1) {
    return distributePhotosSimple(photos, regions);
  }
  
  const besideRegion = regions[besideIdx];
  const belowRegion = regions[belowIdx];
  
  // Sort photos by AR (wider photos first - they pack better in BELOW)
  const sortedPhotos = [...photos].sort((a, b) => b.aspectRatio - a.aspectRatio);
  
  // Try different splits: how many photos go to BESIDE
  // Range: 0 to min(photos.length, reasonable max for BESIDE height)
  const maxBesidePhotos = Math.min(photos.length - 1, 8); // Leave at least 1 for BELOW
  
  let bestSplit: { besideCount: number; score: number } | null = null;
  
  for (let besideCount = 0; besideCount <= maxBesidePhotos; besideCount++) {
    const belowCount = photos.length - besideCount;
    
    // Skip if BELOW would be empty (need at least 1 photo there for wide regions)
    if (belowCount === 0 && photos.length > 1) continue;
    
    // Assign narrower photos to BESIDE (they need less height per photo)
    // So we take from the END of sorted array for BESIDE
    const besidePhotos = sortedPhotos.slice(photos.length - besideCount);
    const belowPhotos = sortedPhotos.slice(0, belowCount);
    
    // Test BESIDE packing
    let besideResult: PackingResult = { cells: [], actualHeight: 0, maxCellArea: 0, usedRowCount: 0 };
    if (besidePhotos.length > 0) {
      besideResult = packPhotosIntoRegion(
        besidePhotos,
        besideRegion,
        gap,
        tuning,
        { maxCellArea, maxHeight: besideRegion.height }
      );
      
      // Check if BESIDE fits its height constraint
      if (besideResult.actualHeight > besideRegion.height) {
        continue; // This split doesn't work
      }
      
      // Check if BESIDE cells are under cap
      if (besideResult.maxCellArea > maxCellArea) {
        continue; // This split doesn't work
      }
    }
    
    // Test BELOW packing
    let belowResult: PackingResult = { cells: [], actualHeight: 0, maxCellArea: 0, usedRowCount: 0 };
    if (belowPhotos.length > 0) {
      belowResult = packPhotosIntoRegion(
        belowPhotos,
        belowRegion,
        gap,
        tuning,
        { maxCellArea } // No height constraint for BELOW
      );
      
      // Check if BELOW cells are under cap
      if (belowResult.maxCellArea > maxCellArea) {
        continue; // This split doesn't work
      }
    }
    
    // Score this split (lower is better)
    // Prefer minimizing max cell area across both regions
    const worstCellArea = Math.max(besideResult.maxCellArea, belowResult.maxCellArea);
    const score = worstCellArea;
    
    if (bestSplit === null || score < bestSplit.score) {
      bestSplit = { besideCount, score };
    }
  }
  
  // If no valid split found, return empty (will cause proposal rejection)
  if (bestSplit === null) {
    return { 
      assignments: new Map(), 
      totalAssigned: 0,
      splitInfo: { besideCount: 0, belowCount: photos.length }
    };
  }
  
  // Build assignments based on best split
  const besidePhotos = sortedPhotos.slice(photos.length - bestSplit.besideCount);
  const belowPhotos = sortedPhotos.slice(0, photos.length - bestSplit.besideCount);
  
  const assignments = new Map<number, string[]>();
  assignments.set(besideIdx, besidePhotos.map(p => p.id));
  assignments.set(belowIdx, belowPhotos.map(p => p.id));
  
  return {
    assignments,
    totalAssigned: photos.length,
    splitInfo: {
      besideCount: bestSplit.besideCount,
      belowCount: photos.length - bestSplit.besideCount,
    }
  };
}

/**
 * Simple proportional distribution (original logic).
 */
function distributePhotosSimple(
  photos: PhotoDimension[],
  regions: RegionSpec[]
): DistributionResult {
  const assignments = new Map<number, string[]>();
  
  // For unbounded regions, use width as proxy for capacity
  const getRegionWeight = (r: RegionSpec) => {
    if (Number.isFinite(r.height)) {
      return r.width * r.height;
    }
    // Unbounded region - use width squared as rough area proxy
    return r.width * r.width;
  };
  
  const totalWeight = regions.reduce((sum, r) => sum + getRegionWeight(r), 0);
  
  let photosRemaining = [...photos];
  let assigned = 0;
  
  regions.forEach((region, index) => {
    if (photosRemaining.length === 0) {
      assignments.set(index, []);
      return;
    }
    
    const weight = getRegionWeight(region);
    const share = weight / totalWeight;
    
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
// Legacy Distribution (for backwards compatibility)
// ============================================================================

/**
 * Distribute photos across regions proportionally by area.
 * @deprecated Use distributePhotosConstrained for constraint-aware distribution
 */
export function distributePhotos(
  photos: PhotoDimension[],
  regions: RegionSpec[]
): PhotoDistribution {
  const result = distributePhotosSimple(photos, regions);
  return { assignments: result.assignments, totalAssigned: result.totalAssigned };
}

// ============================================================================
// Region Packing Result
// ============================================================================

export interface RegionPackingDiagnostics {
  regionIndex: number;
  maxCellArea: number;
  actualHeight: number;
  usedRowCount: number;
  constraintViolation?: string;
}

export interface PackAllRegionsResult {
  cells: LayoutCell[];
  totalHeight: number;
  contentAreas: number[];
  diagnostics: RegionPackingDiagnostics[];
}

/**
 * Pack all regions with their assigned photos.
 * Returns final cells and computed canvas height.
 */
export function packAllRegions(
  photos: PhotoDimension[],
  regions: RegionSpec[],
  distribution: DistributionResult,
  gap: number,
  tuning: V3Tuning,
  maxCellArea?: number
): PackAllRegionsResult {
  const allCells: LayoutCell[] = [];
  const contentAreas: number[] = [];
  const diagnostics: RegionPackingDiagnostics[] = [];
  let maxY = 0;
  
  // Create a map for quick photo lookup
  const photoMap = new Map(photos.map(p => [p.id, p]));
  
  regions.forEach((region, index) => {
    const photoIds = distribution.assignments.get(index) ?? [];
    const regionPhotos = photoIds
      .map(id => photoMap.get(id))
      .filter((p): p is PhotoDimension => p !== undefined);
    
    if (regionPhotos.length === 0) {
      diagnostics.push({
        regionIndex: index,
        maxCellArea: 0,
        actualHeight: 0,
        usedRowCount: 0,
      });
      return;
    }
    
    // Determine constraints for this region
    const constraints: PackingConstraints = { maxCellArea };
    if (Number.isFinite(region.height)) {
      constraints.maxHeight = region.height;
    }
    
    // Pack photos into this region
    const result = packPhotosIntoRegion(
      regionPhotos,
      region,
      gap,
      tuning,
      constraints
    );
    
    // Check for constraint violations
    let violation: string | undefined;
    if (maxCellArea && result.maxCellArea > maxCellArea) {
      violation = `Cell area ${Math.round(result.maxCellArea)} > max ${Math.round(maxCellArea)}`;
    } else if (constraints.maxHeight && result.actualHeight > constraints.maxHeight) {
      violation = `Height ${Math.round(result.actualHeight)} > max ${Math.round(constraints.maxHeight)}`;
    }
    
    diagnostics.push({
      regionIndex: index,
      maxCellArea: result.maxCellArea,
      actualHeight: result.actualHeight,
      usedRowCount: result.usedRowCount,
      constraintViolation: violation,
    });
    
    allCells.push(...result.cells);
    
    // Track content areas for prominence check
    result.cells.forEach(cell => {
      contentAreas.push(cell.width * cell.height);
    });
    
    // Track max Y for canvas height
    const regionBottom = region.y + result.actualHeight;
    if (regionBottom > maxY) {
      maxY = regionBottom;
    }
  });
  
  return { cells: allCells, totalHeight: maxY, contentAreas, diagnostics };
}
