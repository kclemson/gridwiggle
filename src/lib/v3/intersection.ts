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
  DEFAULT_V3_TUNING
} from './types';
import { calculateContentStats } from './utils';
import { decomposeCanvas } from './entities/canvas';
import { proposePositions, validateProminence, findHeroPhoto, getContentPhotos } from './entities/hero';
import { distributePhotos, packAllRegions } from './entities/content-pool';

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
  
  // If no hero, we can't do hero layout
  if (!heroPhoto) {
    return null;
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
  
  // Add hero cell
  const heroCell: LayoutCell = {
    photoId: heroPhoto.id,
    x: proposal.rect.x,
    y: proposal.rect.y,
    width: proposal.rect.width,
    height: proposal.rect.height,
  };
  
  const allCells = [heroCell, ...contentCells];
  
  // Validate hero prominence
  const heroArea = proposal.rect.width * proposal.rect.height;
  const prominence = validateProminence(heroArea, contentAreas, tuning);
  
  if (!prominence.valid) {
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
