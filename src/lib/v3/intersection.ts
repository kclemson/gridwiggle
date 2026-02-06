/**
 * Constraint Intersection Engine
 * 
 * Orchestrates Canvas, Hero, and ContentPool entities to find
 * valid layout configurations where all constraints overlap.
 */

import { 
  PhotoDimension,
  V3Tuning,
  HeroProposal,
  ScoredConfiguration,
  LayoutCell,
  RegionSpec,
  DEFAULT_V3_TUNING
} from './types';
import { packPhotosIntoRegion } from './row-pack';
import { calculateContentStats } from './utils';
import { decomposeCanvas } from './entities/canvas';
import { proposePositions, validateProminence, findHeroPhoto, getContentPhotos } from './entities/hero';
import { distributePhotos, packAllRegions } from './entities/content-pool';
import { devLogger } from '@/lib/devLogger';

// ============================================================================
// Main Intersection Algorithm
// ============================================================================

/**
 * Find valid layout configurations through constraint intersection.
 * 
 * Algorithm:
 * 1. Hero proposes positions based on content count thresholds
 * 2. For each proposal: decompose canvas, check region viability, distribute content
 * 3. Validate prominence: heroArea / runnerUpArea >= hero_minProminence
 * 4. Return best valid config (or null - no silent fallbacks)
 */
export function findValidConfiguration(
  photos: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  tuning: V3Tuning = DEFAULT_V3_TUNING
): ScoredConfiguration | null {
  // Find hero and content photos
  const heroPhoto = findHeroPhoto(photos);
  const contentPhotos = getContentPhotos(photos);
  
  // If no hero, generate simple rows layout
  if (!heroPhoto) {
    return generateSimpleRowsLayout(photos, canvasWidth, gap, tuning);
  }
  
  // Get content statistics
  const contentStats = calculateContentStats(contentPhotos);
  
  // Generate hero position proposals
  const proposals = proposePositions(
    heroPhoto,
    canvasWidth,
    gap,
    contentStats,
    tuning
  );
  
  // Evaluate each proposal
  const validConfigs: ScoredConfiguration[] = [];
  
  for (const proposal of proposals) {
    const config = evaluateProposal(
      proposal,
      heroPhoto,
      contentPhotos,
      canvasWidth,
      gap,
      tuning
    );
    
    if (config) {
      validConfigs.push(config);
    }
  }
  
  // Return null if no valid configurations (no silent fallback)
  if (validConfigs.length === 0) {
    return null;
  }
  
  // Sort by score and return best
  validConfigs.sort((a, b) => b.score - a.score);
  return validConfigs[0];
}

// ============================================================================
// Proposal Evaluation
// ============================================================================

/**
 * Evaluate a single hero proposal.
 */
function evaluateProposal(
  proposal: HeroProposal,
  heroPhoto: PhotoDimension,
  contentPhotos: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  tuning: V3Tuning
): ScoredConfiguration | null {
  // Decompose canvas around hero
  const decomposition = decomposeCanvas(
    canvasWidth,
    proposal.rect,
    proposal.mode,
    gap,
    tuning
  );
  
  // Check region viability
  if (!decomposition.valid) {
    devLogger.log('v3', 'Proposal rejected: decomposition invalid', {
      mode: proposal.mode,
      position: proposal.position,
    });
    return null;
  }
  
  // Distribute content photos to regions
  const distribution = distributePhotos(contentPhotos, decomposition.regions);
  
  // Pack all regions
  const { cells: contentCells, totalHeight, contentAreas } = packAllRegions(
    contentPhotos,
    decomposition.regions,
    distribution,
    gap,
    tuning
  );
  
  // Calculate maximum allowed content cell area
  const heroArea = proposal.rect.width * proposal.rect.height;
  const maxContentArea = heroArea / tuning.hero_minProminence;
  
  // Check if any content cell exceeds the cap
  const largestContentArea = contentAreas.length > 0 ? Math.max(...contentAreas) : 0;
  if (largestContentArea > maxContentArea) {
    devLogger.log('v3', 'Proposal rejected: content cell exceeds cap', {
      mode: proposal.mode,
      position: proposal.position,
      heroArea: Math.round(heroArea),
      maxContentArea: Math.round(maxContentArea),
      largestContentArea: Math.round(largestContentArea),
      excessRatio: (largestContentArea / maxContentArea).toFixed(2),
    });
    return null;
  }
  
  // Add hero cell
  const heroCell: LayoutCell = {
    photoId: heroPhoto.id,
    x: proposal.rect.x,
    y: proposal.rect.y,
    width: proposal.rect.width,
    height: proposal.rect.height,
  };
  
  const allCells = [heroCell, ...contentCells];
  
  // Validate hero prominence (heroArea already calculated above)
  const prominence = validateProminence(heroArea, contentAreas, tuning);
  
  if (!prominence.valid) {
    devLogger.log('v3', 'Proposal rejected: prominence too low', {
      mode: proposal.mode,
      position: proposal.position,
      heroArea,
      runnerUpArea: contentAreas.length > 0 ? Math.max(...contentAreas) : 0,
      ratio: prominence.ratio,
      required: tuning.hero_minProminence,
    });
    return null;
  }
  
  // Calculate canvas height (max of hero bottom and content bottom)
  const heroBottom = proposal.rect.y + proposal.rect.height;
  const canvasHeight = Math.max(heroBottom, totalHeight);
  
  // Score the configuration
  const score = scoreConfiguration(prominence.ratio, allCells, tuning);
  
  return {
    proposal,
    distribution,
    cells: allCells,
    canvasHeight,
    prominenceRatio: prominence.ratio,
    score,
  };
}

// ============================================================================
// Scoring
// ============================================================================

/**
 * Score a configuration.
 * Higher is better.
 */
function scoreConfiguration(
  prominenceRatio: number,
  cells: LayoutCell[],
  tuning: V3Tuning
): number {
  // Base score from prominence (higher prominence = better)
  // Normalized: ratio of 1.5 gives score of 1.0
  const prominenceScore = prominenceRatio / tuning.hero_targetProminence;
  
  // Cell area uniformity (lower variance = better)
  const areas = cells.slice(1).map(c => c.width * c.height); // Exclude hero
  const areaUniformity = areas.length > 1 ? 1 / (1 + coefficientOfVariation(areas)) : 1;
  
  // Combine scores
  // For Phase 1, keep it simple - just prominence and uniformity
  return (prominenceScore * 0.6) + (areaUniformity * 0.4);
}

/**
 * Calculate coefficient of variation (std dev / mean).
 */
function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  if (avg === 0) return 0;
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance) / avg;
}

// ============================================================================
// Hero-less Layout Generation
// ============================================================================

/**
 * Generate a layout with no hero - all photos in rows.
 * Used when no hero photo is designated.
 */
function generateSimpleRowsLayout(
  photos: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  tuning: V3Tuning
): ScoredConfiguration | null {
  if (photos.length === 0) {
    return null;
  }
  
  // Create a region spanning the full canvas width
  const region: RegionSpec = {
    x: 0,
    y: 0,
    width: canvasWidth,
    height: Infinity, // Will be determined by packing
  };
  
  // Pack all photos into rows
  const { cells, actualHeight } = packPhotosIntoRegion(
    photos,
    region,
    gap,
    tuning
  );
  
  if (cells.length === 0) {
    return null;
  }
  
  // Create a "dummy" proposal for consistency with ScoredConfiguration type
  const dummyProposal: HeroProposal = {
    rect: { x: 0, y: 0, width: 0, height: 0 },
    mode: 'corner',
    position: 'top-left',
  };
  
  // Score based on area uniformity (no hero prominence to consider)
  const areas = cells.map(c => c.width * c.height);
  const areaUniformity = 1 / (1 + coefficientOfVariation(areas));
  
  return {
    proposal: dummyProposal,
    distribution: { assignments: new Map([[0, photos.map(p => p.id)]]), totalAssigned: photos.length },
    cells,
    canvasHeight: actualHeight,
    prominenceRatio: 1, // No hero, so ratio is neutral
    score: areaUniformity, // Simple scoring for hero-less layouts
  };
}
