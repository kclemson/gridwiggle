/**
 * Hero Fraction Rating Generator
 * 
 * Generates randomized hero-on-canvas configurations for visual rating.
 * Pure geometry — no layout engine dependency.
 */

// ─── Types ───────────────────────────────────────────────────────────

export type SingleHeroTemplate = 
  | 'corner-anchor'
  | 'top-band'
  | 'bottom-band'
  | 'left-band'
  | 'right-band';

export type DualHeroTemplate =
  | 'diagonal-corners'
  | 'top-bottom'
  | 'side-by-side';

export type HeroTemplate = SingleHeroTemplate | DualHeroTemplate;

export interface HeroRect {
  /** x position as fraction of canvas width (0-1) */
  x: number;
  /** y position as fraction of canvas height (0-1) */
  y: number;
  /** width as fraction of canvas width (0-1) */
  w: number;
  /** height as fraction of canvas height (0-1) */
  h: number;
}

export interface HeroPlacementConfig {
  canvasAR: number;
  heroCount: 1 | 2;
  heroARs: number[];
  heroAreaFraction: number;
  template: HeroTemplate;
}

export interface HeroPlacementResult extends HeroPlacementConfig {
  heroRects: HeroRect[];
  /** Actual total hero area fraction after clamping */
  actualAreaFraction: number;
}

export const HERO_FRACTION_TAGS = [
  'hero-too-large',
  'hero-too-small',
  'bad-placement',
  'bad-shape',
] as const;

export type HeroFractionTag = typeof HERO_FRACTION_TAGS[number];

export interface HeroFractionRatingData {
  canvasAR: number;
  heroCount: number;
  heroARs: number[];
  heroAreaFraction: number;
  actualAreaFraction: number;
  template: string;
  rating: 'good' | 'bad' | 'skip';
  tags: string[];
  ratedAt: string;
}

// ─── Constants ───────────────────────────────────────────────────────

const SINGLE_TEMPLATES: SingleHeroTemplate[] = [
  'corner-anchor', 'top-band', 'bottom-band', 'left-band', 'right-band',
];

const DUAL_TEMPLATES: DualHeroTemplate[] = [
  'diagonal-corners', 'top-bottom', 'side-by-side',
];

const MAX_DIM_FRACTION = 0.85; // Hero can't exceed 85% of canvas in either dimension

const AR_BUCKETS = [
  { min: 0.5, max: 0.8 },   // Portrait
  { min: 0.8, max: 1.2 },   // Near-square
  { min: 1.2, max: 2.25 },  // Landscape
];

// ─── Hero Sizing ─────────────────────────────────────────────────────

/**
 * Compute hero width/height as fractions of canvas dimensions,
 * given target area fraction F and hero aspect ratio r.
 * 
 * heroArea = F * canvasArea
 * heroW = sqrt(heroArea * r)  (in canvas-normalized units)
 * heroH = sqrt(heroArea / r)
 * 
 * Then clamp to MAX_DIM_FRACTION and adjust the other dim to maintain AR.
 */
function computeHeroDims(
  areaFraction: number,
  heroAR: number,
  canvasAR: number,
): { w: number; h: number; actualFraction: number } {
  // Work in normalized canvas where width=1, height=1
  // Canvas area in these units = 1
  // Hero area target = areaFraction * 1 = areaFraction
  
  // But hero AR is in real pixels. If canvas is W×H:
  //   heroW_real / heroH_real = heroAR
  //   heroW_frac = heroW_real / W, heroH_frac = heroH_real / H
  //   heroW_frac * heroH_frac = areaFraction (fraction of canvas area)
  //   (heroW_frac * W) / (heroH_frac * H) = heroAR
  //   heroW_frac / heroH_frac = heroAR / canvasAR
  
  const adjustedAR = heroAR / canvasAR;
  
  // heroW_frac * heroH_frac = areaFraction
  // heroW_frac = adjustedAR * heroH_frac
  // adjustedAR * heroH_frac^2 = areaFraction
  let h = Math.sqrt(areaFraction / adjustedAR);
  let w = adjustedAR * h;
  
  // Clamp
  if (w > MAX_DIM_FRACTION) {
    w = MAX_DIM_FRACTION;
    h = w / adjustedAR;
  }
  if (h > MAX_DIM_FRACTION) {
    h = MAX_DIM_FRACTION;
    w = adjustedAR * h;
  }
  
  const actualFraction = w * h;
  return { w, h, actualFraction };
}

// ─── Template Placement ──────────────────────────────────────────────

function placeSingleHero(
  template: SingleHeroTemplate,
  w: number,
  h: number,
): HeroRect {
  switch (template) {
    case 'corner-anchor': {
      const corners = [
        { x: 0, y: 0 },
        { x: 1 - w, y: 0 },
        { x: 0, y: 1 - h },
        { x: 1 - w, y: 1 - h },
      ];
      const corner = corners[Math.floor(Math.random() * corners.length)];
      return { x: corner.x, y: corner.y, w, h };
    }
    case 'top-band':
      return { x: (1 - w) / 2, y: 0, w, h };
    case 'bottom-band':
      return { x: (1 - w) / 2, y: 1 - h, w, h };
    case 'left-band':
      return { x: 0, y: (1 - h) / 2, w, h };
    case 'right-band':
      return { x: 1 - w, y: (1 - h) / 2, w, h };
  }
}

function placeDualHeroes(
  template: DualHeroTemplate,
  dims: Array<{ w: number; h: number }>,
): HeroRect[] {
  const [d1, d2] = dims;
  
  switch (template) {
    case 'diagonal-corners': {
      const mirrored = Math.random() > 0.5;
      if (mirrored) {
        return [
          { x: 1 - d1.w, y: 0, w: d1.w, h: d1.h },
          { x: 0, y: 1 - d2.h, w: d2.w, h: d2.h },
        ];
      }
      return [
        { x: 0, y: 0, w: d1.w, h: d1.h },
        { x: 1 - d2.w, y: 1 - d2.h, w: d2.w, h: d2.h },
      ];
    }
    case 'top-bottom': {
      return [
        { x: (1 - d1.w) / 2, y: 0, w: d1.w, h: d1.h },
        { x: (1 - d2.w) / 2, y: 1 - d2.h, w: d2.w, h: d2.h },
      ];
    }
    case 'side-by-side': {
      return [
        { x: 0, y: (1 - d1.h) / 2, w: d1.w, h: d1.h },
        { x: 1 - d2.w, y: (1 - d2.h) / 2, w: d2.w, h: d2.h },
      ];
    }
  }
}

// ─── Dual Overlap Fix ────────────────────────────────────────────────

const MAX_SUM = 0.95; // leave a small gap between heroes

function rectsOverlap(a: HeroRect, b: HeroRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function fixDualOverlap(
  template: DualHeroTemplate,
  rects: HeroRect[],
): HeroRect[] {
  const [r1, r2] = rects;

  switch (template) {
    case 'side-by-side': {
      const totalW = r1.w + r2.w;
      if (totalW > MAX_SUM) {
        const scale = MAX_SUM / totalW;
        r1.w *= scale; r1.h *= scale;
        r2.w *= scale; r2.h *= scale;
        // re-position: hero1 left-aligned, hero2 right-aligned, re-center vertically
        r1.y = (1 - r1.h) / 2;
        r2.x = 1 - r2.w;
        r2.y = (1 - r2.h) / 2;
      }
      break;
    }
    case 'top-bottom': {
      const totalH = r1.h + r2.h;
      if (totalH > MAX_SUM) {
        const scale = MAX_SUM / totalH;
        r1.w *= scale; r1.h *= scale;
        r2.w *= scale; r2.h *= scale;
        // re-position: hero1 top, hero2 bottom, re-center horizontally
        r1.x = (1 - r1.w) / 2;
        r2.x = (1 - r2.w) / 2;
        r2.y = 1 - r2.h;
      }
      break;
    }
    case 'diagonal-corners': {
      // Iteratively scale down until no overlap
      let scale = 1;
      const maxIter = 20;
      for (let i = 0; i < maxIter && rectsOverlap(
        { x: r1.x, y: r1.y, w: r1.w * scale, h: r1.h * scale },
        { x: r2.x + r2.w * (1 - scale), y: r2.y + r2.h * (1 - scale), w: r2.w * scale, h: r2.h * scale },
      ); i++) {
        scale *= 0.9;
      }
      if (scale < 1) {
        r1.w *= scale; r1.h *= scale;
        r2.w *= scale; r2.h *= scale;
        // Reanchor to corners
        r2.x = 1 - r2.w;
        r2.y = 1 - r2.h;
        // If mirrored (r1 was top-right), fix r1 too
        if (r1.x > 0.1) r1.x = 1 - r1.w;
        if (r1.y > 0.1) r1.y = 1 - r1.h;
      }
      break;
    }
  }

  return [r1, r2];
}

// ─── Public API ──────────────────────────────────────────────────────

export function generateHeroPlacement(config: HeroPlacementConfig): HeroPlacementResult {
  if (config.heroCount === 1) {
    const { w, h, actualFraction } = computeHeroDims(
      config.heroAreaFraction,
      config.heroARs[0],
      config.canvasAR,
    );
    const rect = placeSingleHero(config.template as SingleHeroTemplate, w, h);
    return { ...config, heroRects: [rect], actualAreaFraction: actualFraction };
  }
  
  // Dual: split area fraction evenly between heroes
  const perHeroFraction = config.heroAreaFraction / 2;
  const dims = config.heroARs.map(ar => {
    const { w, h } = computeHeroDims(perHeroFraction, ar, config.canvasAR);
    return { w, h };
  });
  
  let rects = placeDualHeroes(config.template as DualHeroTemplate, dims);
  rects = fixDualOverlap(config.template as DualHeroTemplate, rects);
  const actualFraction = rects.reduce((sum, r) => sum + r.w * r.h, 0);
  
  return { ...config, heroRects: rects, actualAreaFraction: actualFraction };
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Round to 2 decimal places */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function generateHeroFractionBatch(_count: number = 40): HeroPlacementResult[] {
  const results: HeroPlacementResult[] = [];

  // ── Single heroes: 3 per cell × 9 cells = 27, + 1 wild-card = 28 ──
  for (const canvasBucket of AR_BUCKETS) {
    for (const heroBucket of AR_BUCKETS) {
      for (let t = 0; t < 3; t++) {
        const config: HeroPlacementConfig = {
          canvasAR: r2(randomInRange(canvasBucket.min, canvasBucket.max)),
          heroCount: 1,
          heroARs: [r2(randomInRange(heroBucket.min, heroBucket.max))],
          heroAreaFraction: r2(randomInRange(0.15, 0.60)),
          template: randomChoice(SINGLE_TEMPLATES),
        };
        results.push(generateHeroPlacement(config));
      }
    }
  }
  // 1 wild-card single
  results.push(generateHeroPlacement({
    canvasAR: r2(randomInRange(0.5, 2.25)),
    heroCount: 1,
    heroARs: [r2(randomInRange(0.5, 2.0))],
    heroAreaFraction: r2(randomInRange(0.15, 0.60)),
    template: randomChoice(SINGLE_TEMPLATES),
  }));

  // ── Dual heroes: 1 per cell × 9 cells = 9, + 3 wild-cards = 12 ──
  for (const canvasBucket of AR_BUCKETS) {
    for (const hero1Bucket of AR_BUCKETS) {
      const config: HeroPlacementConfig = {
        canvasAR: r2(randomInRange(canvasBucket.min, canvasBucket.max)),
        heroCount: 2,
        heroARs: [
          r2(randomInRange(hero1Bucket.min, hero1Bucket.max)),
          r2(randomInRange(0.5, 2.0)), // hero 2 fully random
        ],
        heroAreaFraction: r2(randomInRange(0.15, 0.60)),
        template: randomChoice(DUAL_TEMPLATES),
      };
      results.push(generateHeroPlacement(config));
    }
  }
  // 3 wild-card duals
  for (let i = 0; i < 3; i++) {
    results.push(generateHeroPlacement({
      canvasAR: r2(randomInRange(0.5, 2.25)),
      heroCount: 2,
      heroARs: [r2(randomInRange(0.5, 2.0)), r2(randomInRange(0.5, 2.0))],
      heroAreaFraction: r2(randomInRange(0.15, 0.60)),
      template: randomChoice(DUAL_TEMPLATES),
    }));
  }

  // Shuffle so bucket structure isn't visible during rating
  for (let i = results.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [results[i], results[j]] = [results[j], results[i]];
  }

  return results;
}
