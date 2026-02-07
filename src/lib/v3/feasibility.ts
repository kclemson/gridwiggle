/**
 * Feasibility Pre-validators
 * 
 * Algebraic estimates to prune search space BEFORE expensive packing.
 * These are optimistic bounds - may allow some failures through,
 * but never reject valid configurations.
 */

import { PhotoDimension, V3Tuning } from './types';
import { devLogger } from '@/lib/devLogger';

/**
 * Check if ANY row configuration can satisfy BOTH prominence constraints.
 * 
 * Two constraints form a valid range:
 * 1. hero_minProminence: needs MORE rows (smaller cells)
 *    R ≥ sqrt(minProminence × avgBesideAR / heroAR)
 * 
 * 2. hero_maxToSmallest: needs FEWER rows (larger cells)
 *    R ≤ sqrt(maxToSmallest × avgBesideAR / heroAR)
 * 
 * If the ranges overlap with physical limits [1, min(besideCount, 6)],
 * some row count is feasible.
 * 
 * This is an O(1) algebraic check — no packing involved.
 */
export function canMeetProminenceConstraints(
  heroAR: number,
  besideCount: number,
  avgBesideAR: number,
  tuning: V3Tuning
): { feasible: boolean; minRows: number; maxRows: number; reason?: string } {
  // No beside photos = prominence will be determined by BELOW
  // We can't predict that here, so allow it
  if (besideCount === 0) {
    return { feasible: true, minRows: 0, maxRows: 0 };
  }
  
  // Geometric formulas derived from:
  // cellArea ≈ avgBesideAR / R² (where R = row count)
  // prominenceRatio = heroAR / cellArea = heroAR × R² / avgBesideAR
  
  // Constraint 1: Minimum prominence
  // heroAR × R² / avgBesideAR >= minProminence
  // R >= sqrt(minProminence × avgBesideAR / heroAR)
  const minRowsForProminence = Math.ceil(
    Math.sqrt((tuning.hero_minProminence * avgBesideAR) / heroAR)
  );
  
  // Constraint 2: Maximum prominence (smallest cells)
  // heroAR × R² / avgBesideAR <= maxToSmallest
  // R <= sqrt(maxToSmallest × avgBesideAR / heroAR)
  const maxRowsForSmallest = Math.floor(
    Math.sqrt((tuning.hero_maxToSmallest * avgBesideAR) / heroAR)
  );
  
  // Physical limits
  const maxPhysicalRows = Math.min(besideCount, 6); // Reasonable cap
  
  // Intersect ranges: [minRowsForProminence, maxRowsForSmallest] ∩ [1, maxPhysicalRows]
  const minRows = Math.max(1, minRowsForProminence);
  const maxRows = Math.min(maxPhysicalRows, maxRowsForSmallest);
  
  const feasible = minRows <= maxRows;
  
  if (!feasible) {
    const reason = minRowsForProminence > maxPhysicalRows 
      ? 'need_more_rows_than_available'
      : minRowsForProminence > maxRowsForSmallest 
        ? 'prominence_range_empty' 
        : undefined;
    
    devLogger.log('feasibility', 'Prominence constraints unsatisfiable', {
      heroAR: heroAR.toFixed(2),
      besideCount,
      avgBesideAR: avgBesideAR.toFixed(2),
      minRowsForProminence,
      maxRowsForSmallest,
      maxPhysicalRows,
      reason,
    });
    
    return { feasible, minRows, maxRows, reason };
  }
  
  return { feasible, minRows, maxRows };
}

/**
 * Estimate if ANY row configuration for a given besideCount could produce
 * a valid canvas AR. Uses minimum heroRowWidth estimate.
 * 
 * This is a TRUE pre-pack check — runs before any packing happens.
 * 
 * Key insight: The minimum heroRowWidth occurs when BESIDE is packed into
 * maximum rows (most vertical stacking). We can estimate this without packing:
 * - minBesideWidth ≈ sumBesideAR / maxRows
 * - minHeroRowWidth = heroAR + gap + minBesideWidth
 * 
 * If even this best-case width exceeds canvas AR limits, skip the entire besideCount.
 */
export function canBesideCountMeetCanvasAR(
  heroAR: number,
  besidePhotos: PhotoDimension[],
  totalContentCount: number,
  avgContentAR: number,
  normalizedGap: number,
  tuning: V3Tuning
): { feasible: boolean; minHeroRowWidth: number } {
  if (besidePhotos.length === 0) {
    return { feasible: true, minHeroRowWidth: heroAR };
  }
  
  // Calculate hero row width (minimum besideWidth at max row count)
  const sumBesideAR = besidePhotos.reduce((s, p) => s + p.aspectRatio, 0);
  const maxRows = Math.min(besidePhotos.length, 4);
  const minBesideWidth = sumBesideAR / maxRows;
  const minHeroRowWidth = heroAR + normalizedGap + minBesideWidth;
  const canvasWidth = minHeroRowWidth + 2 * normalizedGap;
  
  // Calculate required BELOW height to meet canvas_maxAR
  // heroRowHeight = 1.0, plus gap below hero, plus top/bottom borders
  const heroRowHeightWithGaps = 1.0 + normalizedGap + 2 * normalizedGap;
  const requiredTotalHeight = canvasWidth / tuning.canvas_maxAR;
  const requiredBelowHeight = Math.max(0, requiredTotalHeight - heroRowHeightWithGaps);
  
  // Estimate achievable BELOW height from remaining photos
  const belowCount = totalContentCount - besidePhotos.length;
  if (belowCount > 0 && requiredBelowHeight > 0) {
    // Geometric estimate: height ≈ √(n × avgAR / width)
    // This is conservative (underestimates) as it assumes optimal packing
    const estimatedBelowHeight = Math.sqrt(belowCount * avgContentAR / minHeroRowWidth);
    
    // Feasible if we can achieve ≥80% of required height (conservative margin)
    const feasible = estimatedBelowHeight >= requiredBelowHeight * 0.8;
    
    if (!feasible) {
      devLogger.log('feasibility', 'Canvas AR infeasible (BELOW too short)', {
        besideCount: besidePhotos.length,
        belowCount,
        requiredBelowHeight: requiredBelowHeight.toFixed(2),
        estimatedBelowHeight: estimatedBelowHeight.toFixed(2),
      });
    }
    
    return { feasible, minHeroRowWidth };
  }
  
  // No BELOW photos or no height needed → use original check
  const bestCaseAR = canvasWidth / (1.0 + 2 * normalizedGap);
  const feasible = bestCaseAR <= tuning.canvas_maxAR * 1.1;
  
  if (!feasible) {
    devLogger.log('feasibility', 'Canvas AR infeasible for besideCount', {
      besideCount: besidePhotos.length,
      minHeroRowWidth: minHeroRowWidth.toFixed(2),
      bestCaseAR: bestCaseAR.toFixed(2),
      maxAR: tuning.canvas_maxAR,
    });
  }
  
  return { feasible, minHeroRowWidth };
}
