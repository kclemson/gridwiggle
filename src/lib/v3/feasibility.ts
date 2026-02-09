/**
 * Feasibility Pre-validators
 * 
 * Algebraic estimates to prune search space BEFORE expensive packing.
 * These are optimistic bounds - may allow some failures through,
 * but never reject valid configurations.
 */

import { PhotoDimension, V3Tuning } from './types';
import { devLogger } from '@/lib/devLogger';
import { getEffectiveMinProminence, getEffectiveMaxToSmallest, getEffectiveCanvasMinAR, getEffectiveCanvasMaxAR } from './utils';

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
  contentCount: number,
  tuning: V3Tuning
): { feasible: boolean; minRows: number; maxRows: number; reason?: string } {
  // No beside photos = prominence will be determined by BELOW
  // We can't predict that here, so allow it
  if (besideCount === 0) {
    return { feasible: true, minRows: 0, maxRows: 0 };
  }
  
  // Get effective prominence threshold (lower for small photo counts)
  const effectiveMinProminence = getEffectiveMinProminence(contentCount, tuning);
  
  // Geometric formulas derived from:
  // cellArea ≈ avgBesideAR / R² (where R = row count)
  // prominenceRatio = heroAR / cellArea = heroAR × R² / avgBesideAR
  
  // Constraint 1: Minimum prominence
  // heroAR × R² / avgBesideAR >= minProminence
  // R >= sqrt(minProminence × avgBesideAR / heroAR)
  const minRowsForProminence = Math.ceil(
    Math.sqrt((effectiveMinProminence * avgBesideAR) / heroAR)
  );
  
  // Constraint 2: Maximum prominence (smallest cells)
  // heroAR × R² / avgBesideAR <= maxToSmallest
  // R <= sqrt(maxToSmallest × avgBesideAR / heroAR)
  // Use effective threshold (relaxed for low photo counts)
  const effectiveMaxToSmallest = getEffectiveMaxToSmallest(contentCount, tuning);
  const maxRowsForSmallest = Math.floor(
    Math.sqrt((effectiveMaxToSmallest * avgBesideAR) / heroAR)
  );
  
  // Physical limits
  const maxPhysicalRows = Math.min(besideCount, 10); // Allow more rows for large sets
  
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
  const maxRows = Math.min(besidePhotos.length, 10);
  const minBesideWidth = sumBesideAR / maxRows;
  const minHeroRowWidth = heroAR + normalizedGap + minBesideWidth;
  const canvasWidth = minHeroRowWidth + 2 * normalizedGap;
  
  // Calculate required BELOW height to meet canvas_maxAR
  // heroRowHeight = 1.0, plus gap below hero, plus top/bottom borders
  const heroRowHeightWithGaps = 1.0 + normalizedGap + 2 * normalizedGap;
  const requiredTotalHeight = canvasWidth / tuning.canvas_maxAR;
  const requiredBelowHeight = Math.max(0, requiredTotalHeight - heroRowHeightWithGaps);
  
  // Always return feasible - let region-search.ts validate canvas AR
  // with full knowledge of BELOW height (accurate vs. this estimate).
  // The previous check here ignored BELOW height entirely, causing it to
  // reject valid landscape configurations for large photo sets.
  return { feasible: true, minHeroRowWidth };
}

/**
 * Calculate geometrically valid range for besideCount.
 * 
 * Key insight: Hero AR determines how many photos can fit beside:
 * - Tall portrait heroes (low AR) → can have MANY photos beside (provides width)
 * - Wide landscape heroes (high AR) → should have FEW photos beside (already wide)
 * 
 * This replaces the hardcoded 0–12 limit with bounds derived from:
 * 1. canvas_minAR: Minimum beside needed to avoid "too tall" canvas
 * 2. canvas_maxAR: Maximum beside before canvas becomes "too wide"
 * 3. Physical limit: Can't exceed total content photos
 */
export function calculateBesideCountRange(
  heroAR: number,
  totalContentCount: number,
  avgContentAR: number,
  normalizedGap: number,
  tuning: V3Tuning
): { minBeside: number; maxBeside: number } {
  if (totalContentCount === 0) {
    return { minBeside: 0, maxBeside: 0 };
  }
  
  // === Lower Bound (minBeside) ===
  // For narrow heroes with many photos, we may need beside width to avoid too-tall canvas
  let minBeside = 0;
  
  // Get effective canvas AR bounds (relaxed for low photo counts)
  const effectiveMinAR = getEffectiveCanvasMinAR(totalContentCount, tuning);
  const effectiveMaxAR = getEffectiveCanvasMaxAR(totalContentCount, tuning);
  
  if (heroAR < 1.0 && totalContentCount > 10) {
    // Estimate: with 0 beside, how tall would canvas be?
    // belowHeight ≈ sqrt(totalContentCount × avgContentAR / heroAR)
    const estimatedBelowHeight = Math.sqrt(totalContentCount * avgContentAR / heroAR);
    const estimatedTotalHeight = 1.0 + normalizedGap + estimatedBelowHeight + 2 * normalizedGap;
    const estimatedCanvasAR = (heroAR + 2 * normalizedGap) / estimatedTotalHeight;
    
    if (estimatedCanvasAR < effectiveMinAR) {
      // Need wider canvas → need beside photos
      // Approximate: how much width do we need to add?
      const targetWidth = effectiveMinAR * estimatedTotalHeight;
      const widthNeeded = targetWidth - heroAR - 2 * normalizedGap;
      
      // Width from beside ≈ besideCount × avgContentAR / besideRows
      // Assume 3-4 rows for initial estimate
      const assumedBesideRows = 3;
      minBeside = Math.ceil(widthNeeded * assumedBesideRows / avgContentAR);
      minBeside = Math.max(0, Math.min(minBeside, totalContentCount - 1));
    }
  }
  
  // === Upper Bound (maxBeside) ===
  
  // Constraint 1: Canvas width limit (prevent too-wide)
  // Key insight: BELOW adds height, which allows MORE width within AR limit
  // Iterate to find where width limit kicks in
  
  let maxBesideByWidth = 0;
  const maxTestBeside = totalContentCount; // Let geometry determine the limit
  
  for (let testBeside = 0; testBeside <= maxTestBeside; testBeside++) {
    const testBelowCount = totalContentCount - testBeside;
    
    // Estimate BESIDE width contribution
    // besideWidth ≈ besideCount × avgContentAR / besideRows
    const assumedBesideRows = testBeside > 0 ? Math.max(2, Math.ceil(testBeside / 4)) : 0;
    const estimatedBesideWidth = testBeside > 0
      ? (testBeside * avgContentAR) / assumedBesideRows
      : 0;
    
    // Estimate hero row width INCLUDING beside contribution
    // This is the key fix: wider hero row → shorter BELOW → more room for beside
    const estimatedHeroRowWidth = heroAR + (testBeside > 0 ? normalizedGap + estimatedBesideWidth : 0);
    
    // Estimate BELOW height at the correct width
    const estimatedBelowHeight = testBelowCount > 0
      ? Math.sqrt(testBelowCount * avgContentAR / estimatedHeroRowWidth)
      : 0;
    
    // Actual canvas height includes hero row + gap + below + borders
    const estimatedCanvasHeight = 1.0 + normalizedGap + estimatedBelowHeight + 2 * normalizedGap;
    
    // Width limit from this height
    const maxCanvasWidth = effectiveMaxAR * estimatedCanvasHeight;
    const maxHeroRowWidth = maxCanvasWidth - 2 * normalizedGap;
    
    // Check if this beside configuration fits within the width limit
    const requiredHeroRowWidth = estimatedHeroRowWidth;
    
    // If this besideCount fits within the allowed width, update max
    if (requiredHeroRowWidth <= maxHeroRowWidth) {
      maxBesideByWidth = testBeside;
    }
  }
  
  // Constraint 2: Physical limit - can't exceed total photos
  // Note: ALL photos beside (empty BELOW) is valid for portrait heroes!
  const physicalMax = totalContentCount;
  
  // Final upper bound
  const maxBeside = Math.max(minBeside, Math.min(physicalMax, maxBesideByWidth));
  
  devLogger.log('feasibility', 'Calculated besideCount range', {
    heroAR: heroAR.toFixed(2),
    totalContentCount,
    avgContentAR: avgContentAR.toFixed(2),
    minBeside,
    maxBeside,
    maxBesideByWidth,
  });
  
  return { minBeside, maxBeside };
}
