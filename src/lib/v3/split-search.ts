/**
 * Split Search
 * 
 * Finds the optimal distribution of photos between BESIDE and BELOW regions.
 * Uses normalized space packing to evaluate candidate splits.
 */

import { PhotoDimension, SplitResult, V3Tuning } from './types';
import { packToFillHeight, packToFillWidth, calculateRowCountRange, calculateBelowRowCount } from './normalized-pack';
import { devLogger } from '@/lib/devLogger';
import { shuffleArray } from './utils';

// ============================================================================
// Split Search Algorithm
// ============================================================================

/**
 * Find the optimal split between BESIDE and BELOW photos.
 * 
 * Strategy:
 * 1. Sort photos by AR (narrower photos pack taller → better for BESIDE)
 * 2. Try different beside counts (1 to min(6, n-1))
 * 3. For each split, try different row counts for BESIDE
 * 4. Score by layout balance and uniformity
 * 5. Return the best valid split
 * 
 * @param photos - Content photos (excluding hero)
 * @param heroAR - Hero aspect ratio (hero width in normalized space)
 * @param normalizedGap - Gap as fraction of hero height
 * @param tuning - Tuning parameters
 * @returns Best split result, or null if no valid split found
 */
export function findBestSplit(
  photos: PhotoDimension[],
  heroAR: number,
  normalizedGap: number,
  tuning: V3Tuning
): SplitResult | null {
  if (photos.length === 0) {
    return null;
  }
  
  // Edge case: only 1 photo - must go to BELOW (BESIDE would leave BELOW empty)
  if (photos.length === 1) {
    return {
      besidePhotos: [],
      belowPhotos: photos,
      besideRowCount: 0,
      belowRowCount: 1,
      score: 0,
    };
  }
  
  // Shuffle photos randomly (each call produces different assignments)
  const shuffledPhotos = shuffleArray(photos);
  
  // Search parameters - canvas AR constraint naturally limits valid splits
  const minBesidePhotos = 0;  // Allow "hero at top, all below"
  const maxBesidePhotos = Math.min(photos.length, 12); // Reasonable upper bound for search
  
  // Collect all valid splits instead of tracking best
  const validSplits: SplitResult[] = [];
  
  devLogger.log('v3-split', 'Starting randomized split search', {
    photoCount: photos.length,
    heroAR: heroAR.toFixed(2),
    searchRange: `${minBesidePhotos} to ${maxBesidePhotos} beside photos`,
  });
  
  for (let besideCount = minBesidePhotos; besideCount <= maxBesidePhotos; besideCount++) {
    // Slice from shuffled array (random assignment)
    const besidePhotos = shuffledPhotos.slice(0, besideCount);
    const belowPhotos = shuffledPhotos.slice(besideCount);
    
    // Handle "no BESIDE" case (hero at top, all content below)
    if (besideCount === 0) {
      const heroRowWidth = heroAR; // Just the hero, no beside region
      
      // Calculate BELOW row count
      const belowRowCount = calculateBelowRowCount(
        belowPhotos, 
        heroRowWidth, 
        normalizedGap,
        tuning.canvas_minAR,
        tuning.canvas_maxAR
      );
      
      // Pack BELOW
      const belowResult = packToFillWidth(belowPhotos, heroRowWidth, normalizedGap, belowRowCount);
      
      if (belowResult.cells.length === 0) continue;
      
      // Validate canvas AR
      const totalHeight = 1.0 + normalizedGap + belowResult.height;
      const canvasAR = heroRowWidth / totalHeight;
      
      if (canvasAR < tuning.canvas_minAR || canvasAR > tuning.canvas_maxAR) {
        devLogger.log('v3-split', 'Split rejected (no BESIDE): canvas AR out of range', {
          besideCount: 0,
          canvasAR: canvasAR.toFixed(2),
          allowed: `${tuning.canvas_minAR.toFixed(2)} - ${tuning.canvas_maxAR.toFixed(2)}`,
        });
        continue;
      }
      
      // Score this split (empty BESIDE result)
      const emptyBesideResult = { cells: [], width: 0, height: 1.0 };
      const score = scoreSplit(heroAR, emptyBesideResult, belowResult, normalizedGap, tuning);
      
      devLogger.log('v3-split', 'Valid split candidate (no BESIDE)', {
        besideCount: 0,
        belowCount: belowPhotos.length,
        belowRowCount,
        belowHeight: belowResult.height.toFixed(2),
        canvasAR: canvasAR.toFixed(2),
        score: score.toFixed(3),
      });
      
      validSplits.push({
        besidePhotos: [],
        belowPhotos,
        besideRowCount: 0,
        belowRowCount,
        score,
      });
      continue;
    }
    
    // Try different row counts for BESIDE
    const [minRows, maxRows] = calculateRowCountRange(besidePhotos, 1.0, normalizedGap);
    
    for (let besideRowCount = minRows; besideRowCount <= maxRows; besideRowCount++) {
      // Pack BESIDE at height = 1
      const besideResult = packToFillHeight(besidePhotos, 1.0, normalizedGap, besideRowCount);
      
      if (besideResult.cells.length === 0) continue;
      
      // Calculate hero row width
      const heroRowWidth = heroAR + normalizedGap + besideResult.width;
      
      // Calculate optimal row count for BELOW (respecting both min and max AR)
      const belowRowCount = calculateBelowRowCount(
        belowPhotos, 
        heroRowWidth, 
        normalizedGap,
        tuning.canvas_minAR,
        tuning.canvas_maxAR
      );
      
      // Pack BELOW at derived width
      const belowResult = packToFillWidth(belowPhotos, heroRowWidth, normalizedGap, belowRowCount);
      
      if (belowPhotos.length > 0 && belowResult.cells.length === 0) continue;
      
      // Validate canvas AR
      const totalHeight = 1.0 + normalizedGap + belowResult.height;
      const canvasAR = heroRowWidth / totalHeight;
      
      if (canvasAR < tuning.canvas_minAR || canvasAR > tuning.canvas_maxAR) {
        devLogger.log('v3-split', 'Split rejected: canvas AR out of range', {
          besideCount,
          besideRowCount,
          canvasAR: canvasAR.toFixed(2),
          allowed: `${tuning.canvas_minAR.toFixed(2)} - ${tuning.canvas_maxAR.toFixed(2)}`,
        });
        continue;
      }
      
      // Score this split
      const score = scoreSplit(
        heroAR,
        besideResult,
        belowResult,
        normalizedGap,
        tuning
      );
      
      devLogger.log('v3-split', 'Valid split candidate', {
        besideCount,
        besideRowCount,
        besideWidth: besideResult.width.toFixed(2),
        belowHeight: belowResult.height.toFixed(2),
        canvasAR: canvasAR.toFixed(2),
        score: score.toFixed(3),
      });
      
      validSplits.push({
        besidePhotos,
        belowPhotos,
        besideRowCount,
        belowRowCount,
        score,
      });
    }
  }
  
  if (validSplits.length > 0) {
    const selected = validSplits[Math.floor(Math.random() * validSplits.length)];
    devLogger.log('v3-split', 'Split selected randomly', {
      totalCandidates: validSplits.length,
      besideCount: selected.besidePhotos.length,
      belowCount: selected.belowPhotos.length,
      besideRowCount: selected.besideRowCount,
      score: selected.score.toFixed(3),
    });
    return selected;
  }
  
  devLogger.log('v3-split', 'No valid split found');
  return null;
}

// ============================================================================
// Split Scoring
// ============================================================================

/**
 * Score a split configuration.
 * Higher is better.
 * 
 * Criteria:
 * 1. Balance: hero row height vs BELOW height (prefer ~50/50)
 * 2. Uniformity: cell areas should be similar
 * 3. Compactness: prefer layouts that don't waste space
 */
function scoreSplit(
  heroAR: number,
  besideResult: { cells: { width: number; height: number }[]; width: number; height: number },
  belowResult: { cells: { width: number; height: number }[]; width: number; height: number },
  normalizedGap: number,
  tuning: V3Tuning
): number {
  const heroRowHeight = 1.0; // Hero height = 1 in normalized space
  const totalHeight = heroRowHeight + normalizedGap + belowResult.height;
  
  // Balance score: how close is hero row to 50% of total height?
  // Ideal range: 35-65% for hero row
  const heroRowRatio = heroRowHeight / totalHeight;
  const balanceScore = 1.0 - Math.abs(heroRowRatio - 0.5) * 2; // 1.0 at 50%, 0.0 at 0% or 100%
  
  // Uniformity score: coefficient of variation of cell areas
  const allAreas = [
    ...besideResult.cells.map(c => c.width * c.height),
    ...belowResult.cells.map(c => c.width * c.height),
  ];
  const uniformityScore = 1.0 / (1.0 + coefficientOfVariation(allAreas));
  
  // Hero prominence check (soft constraint)
  // Hero area = heroAR * 1.0 (since height = 1)
  const heroArea = heroAR * 1.0;
  const maxContentArea = Math.max(...allAreas, 0);
  const prominenceRatio = maxContentArea > 0 ? heroArea / maxContentArea : Infinity;
  const prominenceScore = prominenceRatio >= tuning.hero_minProminence ? 1.0 : prominenceRatio / tuning.hero_minProminence;
  
  // Combine scores with weights
  return (balanceScore * 0.3) + (uniformityScore * 0.3) + (prominenceScore * 0.4);
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
