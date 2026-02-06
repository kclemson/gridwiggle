/**
 * V2 Layout Scoring
 * 
 * Unified scoring function for evaluating layout quality.
 * All layouts are evaluated with the same criteria.
 */

import { LayoutCell, ShapeTarget, V2Tuning } from './types';
import { coefficientOfVariation, area, aspectRatio } from './math';

// ============================================================================
// Score Components
// ============================================================================

/**
 * Calculate area uniformity score.
 * Lower CV = more uniform = better score.
 * Returns value between 0 (terrible) and 1 (perfect).
 */
export function scoreAreaUniformity(cells: LayoutCell[]): number {
  if (cells.length === 0) return 0;
  
  const areas = cells.map(c => area(c.width, c.height));
  const cv = coefficientOfVariation(areas);
  
  // CV of 0 = perfect uniformity → score 1
  // CV of 1+ = very non-uniform → score ~0
  return Math.exp(-cv * 2);
}

/**
 * Calculate shape compliance score.
 * How well does the layout match the target shape?
 * Returns value between 0 (wrong shape) and 1 (exact match).
 */
export function scoreShapeCompliance(
  canvasWidth: number,
  canvasHeight: number,
  target: ShapeTarget,
  tuning: Pick<V2Tuning, 'landscapeMinAR' | 'portraitMaxAR' | 'squareTolerance'>
): number {
  if (target === 'auto') return 1; // Always compliant
  
  const ar = aspectRatio(canvasWidth, canvasHeight);
  
  switch (target) {
    case 'landscape':
      // AR >= landscapeMinAR is clearly landscape
      if (ar >= tuning.landscapeMinAR) return 1;
      if (ar >= 1.0) return (ar - 1.0) / (tuning.landscapeMinAR - 1.0); // Partial credit
      return 0;
      
    case 'portrait':
      // AR <= portraitMaxAR is clearly portrait
      if (ar <= tuning.portraitMaxAR) return 1;
      if (ar <= 1.0) return (1.0 - ar) / (1.0 - tuning.portraitMaxAR); // Partial credit
      return 0;
      
    case 'square':
      // AR within squareTolerance of 1.0 is square-ish
      const deviation = Math.abs(ar - 1.0);
      if (deviation <= tuning.squareTolerance) return 1;
      if (deviation <= tuning.squareTolerance * 3) {
        return 1 - (deviation - tuning.squareTolerance) / (tuning.squareTolerance * 2);
      }
      return 0;
      
    default:
      return 1;
  }
}

/**
 * Calculate hero prominence score.
 * Does the hero photo(s) have appropriate visual weight?
 * Returns value between 0 (hero too small) and 1 (hero properly prominent).
 */
export function scoreHeroProminence(
  cells: LayoutCell[],
  heroIds: Set<string>,
  canvasWidth: number,
  canvasHeight: number,
  tuning: Pick<V2Tuning, 'minHeroCanvasPercent' | 'maxHeroCanvasPercent'>
): number {
  if (heroIds.size === 0) return 1; // No heroes = always fine
  
  const totalCanvasArea = area(canvasWidth, canvasHeight);
  
  // Calculate total hero area
  let heroArea = 0;
  for (const cell of cells) {
    if (heroIds.has(cell.photoId)) {
      heroArea += area(cell.width, cell.height);
    }
  }
  
  const heroPercent = heroArea / totalCanvasArea;
  
  // Score based on whether hero is in target range
  if (heroPercent >= tuning.minHeroCanvasPercent && 
      heroPercent <= tuning.maxHeroCanvasPercent) {
    return 1;
  }
  
  if (heroPercent < tuning.minHeroCanvasPercent) {
    // Hero too small
    return heroPercent / tuning.minHeroCanvasPercent;
  }
  
  // Hero too large
  const excess = heroPercent - tuning.maxHeroCanvasPercent;
  return Math.max(0, 1 - excess / 0.2);
}

// ============================================================================
// Combined Scoring
// ============================================================================

export interface ScoreBreakdown {
  areaUniformity: number;
  shapeCompliance: number;
  heroProminence: number;
  total: number;
}

/**
 * Calculate overall layout score combining all factors.
 */
export function scoreLayout(
  cells: LayoutCell[],
  canvasWidth: number,
  canvasHeight: number,
  heroIds: Set<string>,
  target: ShapeTarget,
  tuning: V2Tuning
): ScoreBreakdown {
  const areaUniformity = scoreAreaUniformity(cells);
  const shapeCompliance = scoreShapeCompliance(canvasWidth, canvasHeight, target, tuning);
  const heroProminence = scoreHeroProminence(
    cells, heroIds, canvasWidth, canvasHeight, tuning
  );
  
  // Weighted combination
  const totalWeight = tuning.areaUniformityWeight + tuning.shapeComplianceWeight + tuning.heroProminenceWeight;
  const total = (
    areaUniformity * tuning.areaUniformityWeight +
    shapeCompliance * tuning.shapeComplianceWeight +
    heroProminence * tuning.heroProminenceWeight
  ) / totalWeight;
  
  return {
    areaUniformity,
    shapeCompliance,
    heroProminence,
    total,
  };
}
