/**
 * Feasibility Pre-validators
 * 
 * Algebraic estimates to prune search space BEFORE expensive packing.
 * These are optimistic bounds - may allow some failures through,
 * but never reject valid configurations.
 */

import { V3Tuning } from './types';
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
