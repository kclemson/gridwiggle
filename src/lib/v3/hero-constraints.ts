/**
 * Hero Placement Constraints & Template Registry
 *
 * Derived from 4 rounds of visual rating (~120 trials).
 *
 * SINGLE HERO:
 * - General area range: 0.15 - 0.40
 * - Square canvas (AR 0.85-1.15) ceiling: 0.35
 *
 * DUAL HERO:
 * - Combined area range: 0.22 - 0.42
 *
 * TEMPLATE RESTRICTIONS:
 * - Band templates (top/bottom/left/right-band):
 *     only on square-ish canvases (AR 0.85-1.15)
 * - side-by-side: banned on portrait canvases
 * - top-bottom: banned on landscape canvases
 *
 * RELIABLE TEMPLATES:
 * - corner-anchor: works on all canvas shapes
 * - diagonal-corners: works on all canvas shapes (dual hero)
 */

// ============================================================================
// Types
// ============================================================================

export interface CanvasARRange {
  min: number;
  max: number;
}

export interface HeroAreaRange {
  min: number;
  max: number;
}

export interface HeroARRange {
  min: number;
  max: number;
}

export interface HeroTemplate {
  id: string;
  heroCount: 1 | 2;
  canvasAR: CanvasARRange;
  heroAreaFraction: HeroAreaRange;
  /** What hero aspect ratios work well with this template */
  heroAR: HeroARRange;
  /** Valid hero positions within this template */
  positions: string[];
  /** Human-readable description for debugging */
  description: string;
}

// ============================================================================
// Registry
// ============================================================================

export const HERO_TEMPLATES: readonly HeroTemplate[] = Object.freeze([
  // --- Single hero ---
  {
    id: 'corner-anchor',
    heroCount: 1,
    canvasAR: { min: 0.50, max: 2.25 },
    heroAreaFraction: { min: 0.15, max: 0.40 },
    heroAR: { min: 0.4, max: 3.0 },
    positions: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    description: 'Universal corner placement; tighter area ceiling on square canvases',
  },
  {
    id: 'hero-column',
    heroCount: 1,
    canvasAR: { min: 1.15, max: 2.25 },
    heroAreaFraction: { min: 0.15, max: 0.35 },
    heroAR: { min: 0.4, max: 0.85 },
    positions: ['left', 'right'],
    description: 'Full-height hero column; portrait hero on landscape canvas',
  },
  {
    id: 'hero-row',
    heroCount: 1,
    canvasAR: { min: 0.50, max: 0.85 },
    heroAreaFraction: { min: 0.15, max: 0.35 },
    heroAR: { min: 1.2, max: 3.0 },
    positions: ['top', 'bottom'],
    description: 'Full-width hero row; landscape hero on portrait canvas',
  },
  {
    id: 'top-band',
    heroCount: 1,
    canvasAR: { min: 0.85, max: 1.15 },
    heroAreaFraction: { min: 0.20, max: 0.35 },
    heroAR: { min: 0.8, max: 3.0 },
    positions: ['top'],
    description: 'Full-width band at top; square canvases only; landscape-ish heroes',
  },
  {
    id: 'bottom-band',
    heroCount: 1,
    canvasAR: { min: 0.85, max: 1.15 },
    heroAreaFraction: { min: 0.20, max: 0.35 },
    heroAR: { min: 0.8, max: 3.0 },
    positions: ['bottom'],
    description: 'Full-width band at bottom; square canvases only; landscape-ish heroes',
  },
  {
    id: 'left-band',
    heroCount: 1,
    canvasAR: { min: 0.85, max: 1.15 },
    heroAreaFraction: { min: 0.20, max: 0.35 },
    heroAR: { min: 0.3, max: 1.2 },
    positions: ['left'],
    description: 'Full-height band at left; square canvases only; portrait-ish heroes',
  },
  {
    id: 'right-band',
    heroCount: 1,
    canvasAR: { min: 0.85, max: 1.15 },
    heroAreaFraction: { min: 0.20, max: 0.35 },
    heroAR: { min: 0.3, max: 1.2 },
    positions: ['right'],
    description: 'Full-height band at right; square canvases only; portrait-ish heroes',
  },
  // --- Dual hero ---
  {
    id: 'diagonal-corners',
    heroCount: 2,
    canvasAR: { min: 0.50, max: 2.25 },
    heroAreaFraction: { min: 0.22, max: 0.42 },
    heroAR: { min: 0.4, max: 3.0 },
    positions: ['top-left+bottom-right', 'top-right+bottom-left'],
    description: 'Universal dual hero in opposite corners',
  },
  {
    id: 'side-by-side',
    heroCount: 2,
    canvasAR: { min: 1.15, max: 2.25 },
    heroAreaFraction: { min: 0.22, max: 0.42 },
    heroAR: { min: 0.3, max: 1.5 },
    positions: ['left+right'],
    description: 'Two heroes side by side; landscape canvases only',
  },
  {
    id: 'top-bottom',
    heroCount: 2,
    canvasAR: { min: 0.50, max: 0.85 },
    heroAreaFraction: { min: 0.22, max: 0.42 },
    heroAR: { min: 0.8, max: 3.0 },
    positions: ['top+bottom'],
    description: 'Two heroes stacked; portrait canvases only',
  },
]) as readonly HeroTemplate[];

// ============================================================================
// Dynamic Area Fraction Ceiling
// ============================================================================

/**
 * Scale hero constraints based on total photo count.
 * At high counts, heroes don't need to dominate as much.
 *
 * baseCount = 20 (photo count where current tuning is calibrated)
 * floor = 0.55 (never reduce below 55% of the base values)
 *
 * | Photos | Scale |
 * |--------|-------|
 * | ≤20    | 1.00  |
 * | 25     | 0.80  |
 * | 30     | 0.67  |
 * | 36     | 0.56  |
 * | ≥50    | 0.55  |
 */
export function photoCountScale(totalPhotos: number): number {
  const BASE_COUNT = 20;
  const FLOOR = 0.55;
  return Math.max(FLOOR, Math.min(1.0, BASE_COUNT / totalPhotos));
}

/**
 * Compute the effective maximum area fraction for a template at a given canvas AR,
 * optionally scaled by total photo count.
 *
 * Two independent scaling factors:
 *   arScale: clamp(1 / canvasAR, 0.5, 1.0) — prevents hero from dominating wide canvases
 *   countScale: photoCountScale(totalPhotos) — tapers hero at high photo counts
 *
 * Examples (template.max = 0.40, square canvas):
 *   20 photos → 0.40   (unchanged)
 *   30 photos → 0.27
 *   36 photos → 0.22
 */
export function effectiveAreaFractionMax(
  heroAreaFraction: HeroAreaRange,
  canvasAR: number,
  totalPhotos?: number
): number {
  const arScale = Math.max(0.5, Math.min(1.0, 1.0 / canvasAR));
  const countScale = totalPhotos != null ? photoCountScale(totalPhotos) : 1.0;
  return heroAreaFraction.max * arScale * countScale;
}

// ============================================================================
// Lookup
// ============================================================================

/**
 * Find candidate templates for given hero count and hero aspect ratios.
 *
 * Filters by:
 * 1. heroCount must match
 * 2. Every hero AR must fall within the template's heroAR range
 *
 * The engine is expected to enumerate canvas ARs within each
 * returned template's canvasAR range.
 */
export function findCandidateTemplates(
  heroCount: number,
  heroARs: number[],
): HeroTemplate[] {
  return HERO_TEMPLATES.filter((t) => {
    if (t.heroCount !== heroCount) return false;
    // Every hero AR must fit within this template's affinity range
    return heroARs.every((ar) => ar >= t.heroAR.min && ar <= t.heroAR.max);
  });
}

// ============================================================================
// Topology Functions
// ============================================================================

/**
 * A topology region specification returned by template topology functions.
 * Describes one content region's constraints and position.
 */
export interface TopologyRegionSpec {
  constraint: 'height' | 'width';
  /** Hard dimension: the fixed dimension for packing (height or width depending on constraint) */
  hardDimension: number;
  /** Soft dimension: the target for the other dimension (packer searches for best row count) */
  softDimension: number;
  /** Region offset in normalized canvas space */
  offset: { x: number; y: number };
}

/**
 * Result of a topology function: hero cell placement + content region specs.
 * The engine uses this to build PackableRegions and pack content photos.
 */
export interface TopologyResult {
  heroCell: { x: number; y: number; width: number; height: number };
  heroCell2?: { x: number; y: number; width: number; height: number };
  regions: TopologyRegionSpec[];
}

/**
 * Corner-anchor topology: hero in one corner, content beside + below.
 * 
 * Canvas: width = canvasAR, height = 1.0 (normalized)
 * Hero sized so heroArea / canvasArea = areaFrac
 *   hHero = sqrt(areaFrac * canvasAR / heroAR)
 *   wHero = heroAR * hHero
 * 
 * Two content regions:
 *   beside: height-constrained at hHero, target width = canvasW - wHero - gaps
 *   below:  width-constrained (set after packing beside), target height = 1.0 - hHero - gaps
 */
export function cornerAnchorTopology(
  heroAR: number,
  areaFrac: number,
  canvasAR: number,
  gap: number
): TopologyResult {
  // Hero dimensions from area fraction
  let hHero = Math.sqrt(areaFrac * canvasAR / heroAR);
  hHero = Math.max(0.1, Math.min(0.95, hHero));
  const wHero = heroAR * hHero;

  const targetBesideWidth = canvasAR - wHero - 3 * gap;
  const targetBelowHeight = 1.0 - hHero - 3 * gap;

  return {
    heroCell: { x: gap, y: gap, width: wHero, height: hHero },
    regions: [
      {
        // Beside hero: height-constrained at hHero
        constraint: 'height',
        hardDimension: hHero,
        softDimension: Math.max(0.01, targetBesideWidth),
        offset: { x: gap + wHero + gap, y: gap },
      },
      {
        // Below hero row: width-constrained (hardDimension set by engine after packing beside)
        constraint: 'width',
        hardDimension: 0,
        softDimension: Math.max(0.01, targetBelowHeight),
        offset: { x: gap, y: gap + hHero + gap },
      },
    ],
  };
}

/**
 * Diagonal-corners topology: two heroes in opposite corners, three content regions.
 *
 * Canvas: width = canvasAR, height = 1.0 (normalized)
 * Each hero targets half the area fraction.
 *
 * Canonical layout (Hero1=TL, Hero2=BR):
 *   Region 0 (beside H1): height-constrained at hH1
 *   Region 1 (middle band): width-constrained (hardDim set by engine)
 *   Region 2 (beside H2): height-constrained at hH2
 *
 * Hero2 position is approximate; the engine adjusts after packing.
 */
export function diagonalCornersTopology(
  hero1AR: number,
  hero2AR: number,
  areaFrac: number,
  canvasAR: number,
  gap: number
): TopologyResult {
  const halfFrac = areaFrac / 2;

  // Hero 1 (top-left)
  let hH1 = Math.sqrt(halfFrac * canvasAR / hero1AR);
  hH1 = Math.max(0.1, Math.min(0.45, hH1));
  const wH1 = hero1AR * hH1;

  // Hero 2 (bottom-right)
  let hH2 = Math.sqrt(halfFrac * canvasAR / hero2AR);
  hH2 = Math.max(0.1, Math.min(0.45, hH2));
  const wH2 = hero2AR * hH2;

  const targetBesideH1Width = canvasAR - wH1 - 3 * gap;
  const targetMiddleHeight = Math.max(0.01, 1.0 - hH1 - hH2 - 4 * gap);
  const targetBesideH2Width = canvasAR - wH2 - 3 * gap;

  return {
    heroCell: { x: gap, y: gap, width: wH1, height: hH1 },
    // Approximate position; engine adjusts y after packing middle band
    heroCell2: { x: canvasAR - gap - wH2, y: 1.0 - gap - hH2, width: wH2, height: hH2 },
    regions: [
      {
        // Region 0: beside Hero 1, height-constrained
        constraint: 'height',
        hardDimension: hH1,
        softDimension: Math.max(0.01, targetBesideH1Width),
        offset: { x: gap + wH1 + gap, y: gap },
      },
      {
        // Region 1: middle band, width-constrained (hardDimension set by engine)
        constraint: 'width',
        hardDimension: 0,
        softDimension: targetMiddleHeight,
        offset: { x: gap, y: gap + hH1 + gap },
      },
      {
        // Region 2: beside Hero 2, height-constrained at hH2 (matches Region 0 pattern)
        constraint: 'height',
        hardDimension: hH2,
        softDimension: Math.max(0.01, targetBesideH2Width),
        offset: { x: gap, y: 0 }, // y set by engine after packing middle
      },
    ],
  };
}

/**
 * Hero-column topology: portrait hero spanning full canvas height, content beside it.
 *
 * Canvas: width = canvasAR, height = 1.0 (normalized)
 * Hero height = 1.0 - 2*gap (full height). Hero width = heroAR * heroHeight.
 * One content region beside hero, width-constrained.
 */
export function heroColumnTopology(
  heroAR: number,
  _areaFrac: number,
  canvasAR: number,
  gap: number
): TopologyResult {
  const hHero = 1.0 - 2 * gap;
  const wHero = heroAR * hHero;

  const contentWidth = canvasAR - wHero - 3 * gap;

  return {
    heroCell: { x: gap, y: gap, width: wHero, height: hHero },
    regions: [
      {
        constraint: 'width',
        hardDimension: Math.max(0.01, contentWidth),
        softDimension: hHero,
        offset: { x: gap + wHero + gap, y: gap },
      },
    ],
  };
}

/**
 * Hero-row topology: landscape hero spanning full canvas width, content below it.
 *
 * Canvas: width = canvasAR, height = 1.0 (normalized)
 * Hero width = canvasAR - 2*gap (full width). Hero height = heroWidth / heroAR.
 * One content region below hero, width-constrained.
 */
export function heroRowTopology(
  heroAR: number,
  _areaFrac: number,
  canvasAR: number,
  gap: number
): TopologyResult {
  const wHero = canvasAR - 2 * gap;
  const hHero = wHero / heroAR;

  const contentHeight = 1.0 - hHero - 3 * gap;

  return {
    heroCell: { x: gap, y: gap, width: wHero, height: hHero },
    regions: [
      {
        constraint: 'width',
        hardDimension: wHero,
        softDimension: Math.max(0.01, contentHeight),
        offset: { x: gap, y: gap + hHero + gap },
      },
    ],
  };
}

/**
 * Look up the topology function for a template ID and compute the layout.
 * Returns null for templates not yet implemented.
 */
export function getTemplateTopology(
  templateId: string,
  heroAR: number,
  areaFrac: number,
  canvasAR: number,
  gap: number,
  hero2AR?: number
): TopologyResult | null {
  switch (templateId) {
    case 'corner-anchor':
      return cornerAnchorTopology(heroAR, areaFrac, canvasAR, gap);
    case 'hero-column':
      return heroColumnTopology(heroAR, areaFrac, canvasAR, gap);
    case 'hero-row':
      return heroRowTopology(heroAR, areaFrac, canvasAR, gap);
    case 'diagonal-corners':
      if (hero2AR == null) return null;
      return diagonalCornersTopology(heroAR, hero2AR, areaFrac, canvasAR, gap);
    default:
      return null;
  }
}
