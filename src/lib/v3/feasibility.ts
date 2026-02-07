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
 * Check if prominence can possibly be achieved for a given beside count.
 * 
 * Algebraic estimate:
 * - Hero area = heroAR × 1.0 (fixed in normalized space)
 * - Max beside cell area ≈ (besideWidth / besideCount) × (1 / besideRowCount)
 * - For few photos in 1 row, each photo is ~50% of hero row height
 * 
 * This is conservative (optimistic) - allows some failures through
 * but never rejects valid configurations.
 */
export function canMeetProminence(
  heroAR: number,
  besideCount: number,
  besideRowCount: number,
  avgBesideAR: number,
  tuning: V3Tuning
): { feasible: boolean; estimatedRatio: number } {
  // No beside photos = prominence will be determined by BELOW
  // We can't predict that here, so allow it
  if (besideCount === 0) {
    return { feasible: true, estimatedRatio: Infinity };
  }
  
  const heroArea = heroAR * 1.0;
  
  // Estimate: each beside photo gets roughly equal share of the region
  // Region height = 1.0 (hero height), split into besideRowCount rows
  // Region width = sum of all beside ARs × row height
  const rowHeight = 1.0 / besideRowCount;
  
  // The largest beside cell is likely the one with the highest AR
  // But we use average as a conservative estimate
  const estimatedCellWidth = avgBesideAR * rowHeight;
  const estimatedCellArea = estimatedCellWidth * rowHeight;
  
  // This is the estimated largest cell area
  // Reality may be different due to row distribution
  const estimatedRatio = heroArea / estimatedCellArea;
  
  // Use 80% of required threshold as feasibility gate
  // This is conservative - allows marginal cases through for exact check
  const feasibilityThreshold = tuning.hero_minProminence * 0.8;
  const feasible = estimatedRatio >= feasibilityThreshold;
  
  if (!feasible) {
    devLogger.log('feasibility', 'Prominence unlikely', {
      besideCount,
      besideRowCount,
      estimatedRatio: estimatedRatio.toFixed(2),
      threshold: feasibilityThreshold.toFixed(2),
    });
  }
  
  return { feasible, estimatedRatio };
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
