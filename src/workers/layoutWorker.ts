/**
 * Layout Worker
 * 
 * Runs V4 layout generation off the main thread so the UI stays responsive
 * and spinners can animate during computation.
 * 
 * V4 is a simplified orchestrator that calls proven V3 math functions.
 * Uses generic PackableRegion abstraction for future multi-region support.
 */

import { PhotoDimension, V3Tuning, DEFAULT_V3_TUNING, NormalizedCell, PackableRegion } from '@/lib/v3/types';
import { CollageLayout, CollageCell } from '@/types/collage';
import { packToFillHeight, packToFillWidth, packToFillHeightAtTargetWidth, packToFillWidthAtTargetHeight } from '@/lib/v3/normalized-pack';
import { shuffleArray, deriveRegionCounts, deriveTargetRowCount, mean, sampleCanvasARValues, sampleAreaFractions } from '@/lib/v3/utils';
import { devLogger, LogEntry, RejectedLayoutGeometry } from '@/lib/devLogger';
import { findCandidateTemplates, getTemplateTopology, effectiveAreaFractionMax } from '@/lib/v3/hero-constraints';

// Virtual canvas base unit - normalized dimensions are scaled to this
const VIRTUAL_CANVAS_BASE = 1000;

// ============================================================================
// Worker-local log collection (redirects devLogger to worker-local array)
// ============================================================================

const isDev = import.meta.env.DEV;
let workerLogs: LogEntry[] = [];

// Redirect all devLogger calls to worker-local array
devLogger.setCollector((entry) => {
  workerLogs.push(entry);
});

// ============================================================================
// Message Types
// ============================================================================

export interface LayoutRequest {
  type: 'generate';
  requestId: string;
  dimensions: PhotoDimension[];
  normalizedGap: number;
  tuning: Partial<V3Tuning>;
  randomize: boolean;
}

export interface LayoutResponse {
  type: 'result';
  requestId: string;
  layout: CollageLayout;
  durationMs: number;
  logs?: LogEntry[];
  softRejection?: {
    reason: string;
    details: Record<string, unknown>;
  };
  layoutMeta?: Record<string, unknown>;
}

// ============================================================================
// V4 Layout Candidate (region-generic)
// ============================================================================

interface LayoutCandidateMeta {
  template: string;
  targetCanvasAR: number;
  areaFrac: number;
  arDeviation: number;
  heroCoverage: number;
  regionSizes: number[];
  regionTargetRows: number[];
  regionActualRows: number[];
  besideWidth: number;
  belowHeight: number;
  candidateCount: number;
}

interface LayoutCandidate {
  regions: PackableRegion[];
  heroCell: NormalizedCell;
  canvasWidth: number;
  canvasHeight: number;
  prominenceRatio: number;
  score: number;
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  meta: LayoutCandidateMeta;
}

// ============================================================================
// Tier Coherence Scoring (F-ratio)
// ============================================================================

function tierCoherenceScore(areas: number[], tierCount: number = 3): number {
  if (areas.length < tierCount * 2) {
    return 0.5;
  }
  
  const sorted = [...areas].sort((a, b) => b - a);
  const grandMean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  
  const tierSize = Math.ceil(sorted.length / tierCount);
  const tiers: number[][] = [];
  for (let i = 0; i < tierCount; i++) {
    tiers.push(sorted.slice(i * tierSize, (i + 1) * tierSize));
  }
  
  const tierMeans = tiers.map(tier => 
    tier.reduce((a, b) => a + b, 0) / tier.length
  );
  
  const betweenVar = tierMeans.reduce((sum, mean) => 
    sum + Math.pow(mean - grandMean, 2), 0
  ) / tierCount;
  
  let withinVarSum = 0;
  for (let i = 0; i < tierCount; i++) {
    const tierMean = tierMeans[i];
    const tierVar = tiers[i].reduce((sum, area) => 
      sum + Math.pow(area - tierMean, 2), 0
    ) / tiers[i].length;
    withinVarSum += tierVar;
  }
  const withinVar = withinVarSum / tierCount;
  
  const fRatio = withinVar > 0.0001 ? betweenVar / withinVar : 0;
  
  return Math.min(1.0, fRatio / 5);
}

// ============================================================================
// Weighted Random Selection
// ============================================================================

function weightedRandomSelect<T extends { score: number }>(candidates: T[]): T {
  if (candidates.length === 1) return candidates[0];
  
  const scores = candidates.map(c => c.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore || 1;
  
  const weights = scores.map(s => {
    const normalized = (s - minScore) / range;
    return Math.pow(normalized, 2) + 0.1;
  });
  
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let cumulative = 0;
  const cumulativeWeights = weights.map(w => {
    cumulative += w / totalWeight;
    return cumulative;
  });
  
  const r = Math.random();
  const selectedIndex = cumulativeWeights.findIndex(cp => r <= cp);
  return candidates[selectedIndex >= 0 ? selectedIndex : candidates.length - 1];
}

// AR coherence threshold: reject candidates where actual AR deviates > 25% from target
const AR_COHERENCE_THRESHOLD = 0.25;

// Hero coverage ceiling: reject candidates where hero > 50% of canvas area
const HERO_COVERAGE_CEILING = 0.50;

// ============================================================================
// Region Packing
// ============================================================================

/**
 * Pack a single region according to its constraint type.
 * Returns the packed result or null if packing failed.
 */
function packRegion(
  region: PackableRegion,
  normalizedGap: number,
  tuning: V3Tuning,
  randomize: boolean
): PackableRegion {
  if (region.photos.length === 0) {
    return { ...region, result: { cells: [], width: 0, height: 0, rowCount: 0 } };
  }
  
  let result;
  if (region.targetSoftDimension != null) {
    result = region.constraint === 'height'
      ? packToFillHeightAtTargetWidth(region.photos, region.targetDimension, normalizedGap, region.targetSoftDimension, tuning, randomize)
      : packToFillWidthAtTargetHeight(region.photos, region.targetDimension, normalizedGap, region.targetSoftDimension, tuning, randomize);
  } else {
    result = region.constraint === 'height'
      ? packToFillHeight(region.photos, region.targetDimension, normalizedGap, region.targetRowCount, tuning, randomize)
      : packToFillWidth(region.photos, region.targetDimension, normalizedGap, region.targetRowCount, tuning, randomize);
  }
  
  return { ...region, result: result.cells.length > 0 ? result : null };
}

// ============================================================================
// Rejection Geometry Builder
// ============================================================================

function buildRejectionGeometry(
  heroCell: { x: number; y: number; width: number; height: number },
  regions: PackableRegion[],
  canvasWidth: number,
  canvasHeight: number
): RejectedLayoutGeometry | undefined {
  const cells: RejectedLayoutGeometry['cells'] = [];

  cells.push({
    photoId: 'hero',
    x: heroCell.x,
    y: heroCell.y,
    width: heroCell.width,
    height: heroCell.height,
  });

  for (const region of regions) {
    if (!region.result) continue;
    for (const cell of region.result.cells) {
      cells.push({
        photoId: cell.photoId,
        x: region.offset.x + cell.x,
        y: region.offset.y + cell.y,
        width: cell.width,
        height: cell.height,
      });
    }
  }

  return cells.length > 1 ? { cells, canvasWidth, canvasHeight } : undefined;
}

// ============================================================================
// Candidate Generation (template-driven)
// ============================================================================

function generateCandidates(
  heroPhoto: PhotoDimension,
  contentPhotos: PhotoDimension[],
  normalizedGap: number,
  tuning: V3Tuning,
  randomize: boolean
): LayoutCandidate[] {
  const heroAR = heroPhoto.aspectRatio;
  const candidates: LayoutCandidate[] = [];
  
  const ordered = randomize 
    ? shuffleArray(contentPhotos)
    : [...contentPhotos].sort((a, b) => a.aspectRatio - b.aspectRatio);
  
  const corners: Array<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'> = 
    ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  
  // Find matching templates for this hero
  const templates = findCandidateTemplates(1, [heroAR]);
  
  // Track unique configurations to avoid duplicate packing work
  const triedConfigs = new Set<string>();
  
  for (const template of templates) {
    // Intersect template canvasAR range with tuning range
    const minAR = Math.max(template.canvasAR.min, tuning.canvas_minAR);
    const maxAR = Math.min(template.canvasAR.max, tuning.canvas_maxAR);
    if (minAR > maxAR) continue;
    
    const canvasARSamples = sampleCanvasARValues(minAR, maxAR, 6, randomize);
    const { heroAreaFraction } = template;
    
    for (const targetCanvasAR of canvasARSamples) {
      const maxFrac = effectiveAreaFractionMax(heroAreaFraction, targetCanvasAR);
      const areaSamples = sampleAreaFractions(
        heroAreaFraction.min, maxFrac, 3
      );
      
      for (const areaFrac of areaSamples) {
        // Get topology for this template + parameters
        const topology = getTemplateTopology(template.id, heroAR, areaFrac, targetCanvasAR, normalizedGap);
        if (!topology) continue;
        
        const { heroCell: topologyHero } = topology;
        const wHero = topologyHero.width;
        const hHero = topologyHero.height;
        
        const { besideCount } = deriveRegionCounts(heroAR, targetCanvasAR, areaFrac, ordered.length);
        const belowCount = ordered.length - besideCount;
        
        const besidePhotos = ordered.slice(0, besideCount);
        const belowPhotos = ordered.slice(besideCount);
        
        const besideMeanAR = besidePhotos.length > 0 ? mean(besidePhotos.map(p => p.aspectRatio)) : 1;
        const belowMeanAR = belowPhotos.length > 0 ? mean(belowPhotos.map(p => p.aspectRatio)) : 1;
        
        const targetBesideWidth = topology.regions[0]?.softDimension ?? 0;
        const targetBelowHeight = topology.regions[1]?.softDimension ?? 0;
        
        const baseBesideRows = besideCount > 0
          ? deriveTargetRowCount(besideCount, besideMeanAR, Math.max(0.01, targetBesideWidth), hHero)
          : 0;
        const baseBelowRows = belowCount > 0
          ? deriveTargetRowCount(belowCount, belowMeanAR, targetCanvasAR, Math.max(0.01, targetBelowHeight))
          : 0;
        
        const configKey = `${template.id}-${besideCount}-${areaFrac.toFixed(3)}-${targetCanvasAR.toFixed(3)}`;
        if (triedConfigs.has(configKey)) continue;
        triedConfigs.add(configKey);
        
        // Build regions from topology
        const regions: PackableRegion[] = topology.regions.map((spec, i) => ({
          constraint: spec.constraint,
          targetDimension: spec.hardDimension,
          targetSoftDimension: spec.softDimension > 0.01 ? spec.softDimension : undefined,
          photos: i === 0 ? besidePhotos : belowPhotos,
          targetRowCount: i === 0 ? baseBesideRows : baseBelowRows,
          offset: spec.offset,
          result: null,
        }));
        
        // Pack region 0 (beside hero)
        regions[0] = packRegion(regions[0], normalizedGap, tuning, randomize);
        if (besideCount > 0 && !regions[0].result) {
          devLogger.warn('v4-reject', 'Region pack failed (beside)', {
            template: template.id, areaFrac, targetCanvasAR, besideCount,
          });
          continue;
        }
        
        // Compute hero row width and set region 1's hard dimension
        const besideWidth = regions[0].result?.width ?? 0;
        const heroRowWidth = wHero + (besideCount > 0 ? normalizedGap + besideWidth : 0);
        regions[1] = { ...regions[1], targetDimension: heroRowWidth };
        
        // Pack region 1 (below hero row)
        regions[1] = packRegion(regions[1], normalizedGap, tuning, randomize);
        if (belowCount > 0 && !regions[1].result) {
          devLogger.warn('v4-reject', 'Region pack failed (below)', {
            template: template.id, areaFrac, targetCanvasAR, belowCount,
          });
          continue;
        }
        
        // Compute canvas dimensions (canvas is discovered from packing, not pre-defined)
        const belowHeight = regions[1].result?.height ?? 0;
        const totalHeight = hHero + (belowCount > 0 ? normalizedGap + belowHeight : 0);
        const canvasWidth = heroRowWidth + 2 * normalizedGap;
        const canvasHeight = totalHeight + 2 * normalizedGap;
        const canvasAR = canvasWidth / canvasHeight;
        
        // Compute hero coverage
        const heroArea = wHero * hHero;
        const canvasArea = canvasWidth * canvasHeight;
        const heroCoverage = heroArea / canvasArea;
        
        if (canvasAR < tuning.canvas_minAR || canvasAR > tuning.canvas_maxAR) {
          const geometry = buildRejectionGeometry(topologyHero, regions, canvasWidth, canvasHeight);
          devLogger.warn('v4-reject', 'Canvas AR out of bounds', {
            template: template.id, canvasAR: +canvasAR.toFixed(3),
            min: tuning.canvas_minAR, max: tuning.canvas_maxAR,
          }, geometry);
          continue;
        }
        
        const arDeviation = Math.abs(canvasAR - targetCanvasAR) / targetCanvasAR;
        if (arDeviation > AR_COHERENCE_THRESHOLD) {
          const geometry = buildRejectionGeometry(topologyHero, regions, canvasWidth, canvasHeight);
          devLogger.warn('v4-reject', 'AR coherence exceeded', {
            template: template.id, targetAR: +targetCanvasAR.toFixed(3),
            actualAR: +canvasAR.toFixed(3), deviation: +(arDeviation * 100).toFixed(1),
          }, geometry);
          continue;
        }
        
        if (heroCoverage > HERO_COVERAGE_CEILING) {
          const geometry = buildRejectionGeometry(topologyHero, regions, canvasWidth, canvasHeight);
          devLogger.warn('v4-reject', 'Hero coverage exceeded ceiling', {
            template: template.id, heroCoverage: +(heroCoverage * 100).toFixed(1),
            ceiling: +(HERO_COVERAGE_CEILING * 100).toFixed(0),
          }, geometry);
          continue;
        }
        
        const allContentAreas: number[] = [];
        for (const region of regions) {
          if (region.result) {
            for (const cell of region.result.cells) {
              allContentAreas.push(cell.width * cell.height);
            }
          }
        }
        
        const maxContentArea = Math.max(...allContentAreas, 0);
        const prominenceRatio = maxContentArea > 0 ? heroArea / maxContentArea : Infinity;
        
        if (prominenceRatio < tuning.hero_minProminence) {
          const geometry = buildRejectionGeometry(topologyHero, regions, canvasWidth, canvasHeight);
          devLogger.warn('v4-reject', 'Prominence too low', {
            template: template.id, prominenceRatio: +prominenceRatio.toFixed(2),
            min: tuning.hero_minProminence,
          }, geometry);
          continue;
        }
        
        const coherenceScore = tierCoherenceScore(allContentAreas);
        const presenceScore = besideCount > 0 ? 1.0 : 0.4;
        const score = (coherenceScore * 0.7) + (presenceScore * 0.3);
        
        const corner = randomize 
          ? corners[Math.floor(Math.random() * 4)]
          : 'top-left';
        
        const heroCell: NormalizedCell = {
          photoId: heroPhoto.id,
          x: topologyHero.x,
          y: topologyHero.y,
          width: wHero,
          height: hHero,
        };
        
        candidates.push({
          regions,
          heroCell,
          canvasWidth,
          canvasHeight,
          prominenceRatio,
          score,
          corner,
          meta: {
            template: template.id,
            targetCanvasAR,
            areaFrac,
            arDeviation,
            heroCoverage,
            regionSizes: regions.map(r => r.photos.length),
            regionTargetRows: [baseBesideRows, baseBelowRows],
            regionActualRows: regions.map(r => r.result?.rowCount ?? 0),
            besideWidth,
            belowHeight,
            candidateCount: 0, // filled after all candidates generated
          },
        });
      }
    }
  }
  
  // Backfill candidateCount
  for (const c of candidates) {
    c.meta.candidateCount = candidates.length;
  }
  
  return candidates;
}

// ============================================================================
// Convert Candidate to Layout (region-generic)
// ============================================================================

function convertToLayout(candidate: LayoutCandidate, normalizedGap: number): CollageLayout {
  const cells: CollageCell[] = [];
  const { corner, canvasWidth, canvasHeight, heroCell } = candidate;
  
  const transform = (x: number, y: number, w: number, h: number): { x: number; y: number } => {
    switch (corner) {
      case 'top-left':
        return { x, y };
      case 'top-right':
        return { x: canvasWidth - x - w, y };
      case 'bottom-left':
        return { x, y: canvasHeight - y - h };
      case 'bottom-right':
        return { x: canvasWidth - x - w, y: canvasHeight - y - h };
    }
  };
  
  // Add hero cell
  const heroPos = transform(heroCell.x, heroCell.y, heroCell.width, heroCell.height);
  cells.push({
    photoId: heroCell.photoId,
    x: Math.round(heroPos.x * VIRTUAL_CANVAS_BASE),
    y: Math.round(heroPos.y * VIRTUAL_CANVAS_BASE),
    width: Math.round(heroCell.width * VIRTUAL_CANVAS_BASE),
    height: Math.round(heroCell.height * VIRTUAL_CANVAS_BASE),
  });
  
  // Add all region cells (generic loop - works for 2, 3, or N regions)
  for (const region of candidate.regions) {
    if (!region.result) continue;
    for (const cell of region.result.cells) {
      const pos = transform(
        region.offset.x + cell.x,
        region.offset.y + cell.y,
        cell.width,
        cell.height
      );
      cells.push({
        photoId: cell.photoId,
        x: Math.round(pos.x * VIRTUAL_CANVAS_BASE),
        y: Math.round(pos.y * VIRTUAL_CANVAS_BASE),
        width: Math.round(cell.width * VIRTUAL_CANVAS_BASE),
        height: Math.round(cell.height * VIRTUAL_CANVAS_BASE),
      });
    }
  }
  
  return {
    width: Math.round(canvasWidth * VIRTUAL_CANVAS_BASE),
    height: Math.round(canvasHeight * VIRTUAL_CANVAS_BASE),
    cells,
  };
}

// ============================================================================
// Layout Generation Result
// ============================================================================

interface GenerationResult {
  layout: CollageLayout | null;
  softRejection?: { reason: string; details: Record<string, unknown> };
  layoutMeta?: Record<string, unknown>;
}

// ============================================================================
// V4 Layout Generation
// ============================================================================

function generateLayout(
  dimensions: PhotoDimension[],
  normalizedGap: number,
  tuningOverrides: Partial<V3Tuning>,
  randomize: boolean
): GenerationResult {
  workerLogs = [];
  
  if (dimensions.length < 2) {
    return { 
      layout: { width: 1000, height: 1000, cells: [] }, 
      softRejection: { reason: 'insufficient_photos', details: { photoCount: dimensions.length } },
    };
  }
  
  const tuning: V3Tuning = { ...DEFAULT_V3_TUNING, ...tuningOverrides };
  
  devLogger.log('v4', 'Starting V4 layout generation (worker)', {
    photoCount: dimensions.length,
    randomize,
    tuning: {
      canvas_minAR: tuning.canvas_minAR,
      canvas_maxAR: tuning.canvas_maxAR,
      hero_minProminence: tuning.hero_minProminence,
    },
  });
  
  // Find hero (highest weight)
  const heroPhoto = dimensions.reduce((h, d) => d.weight > h.weight ? d : h);
  const contentPhotos = dimensions.filter(d => d.id !== heroPhoto.id);
  
  devLogger.log('v4', 'Photo analysis', {
    heroId: heroPhoto.id,
    heroAR: heroPhoto.aspectRatio.toFixed(2),
    contentCount: contentPhotos.length,
  });
  
  // Generate all valid candidates
  const candidates = generateCandidates(heroPhoto, contentPhotos, normalizedGap, tuning, randomize);
  
  devLogger.log('v4', `Generated ${candidates.length} candidates`, {
    arRange: candidates.length > 0 
      ? `${Math.min(...candidates.map(c => c.canvasWidth / c.canvasHeight)).toFixed(2)} - ${Math.max(...candidates.map(c => c.canvasWidth / c.canvasHeight)).toFixed(2)}`
      : 'none',
  });
  
  if (candidates.length === 0) {
    devLogger.warn('v4', 'No valid candidates found, using fallback');
    const fallbackLayout: CollageLayout = {
      width: 1000,
      height: 1000,
      cells: dimensions.map((d, i) => ({
        photoId: d.id,
        x: 0,
        y: i * (1000 / dimensions.length),
        width: 1000,
        height: 1000 / dimensions.length,
      })),
    };
    return { 
      layout: fallbackLayout, 
      softRejection: { reason: 'no_valid_candidates', details: { photoCount: dimensions.length } },
    };
  }
  
  // Select best/random candidate
  const selected = randomize 
    ? weightedRandomSelect(candidates)
    : candidates.reduce((best, c) => c.score > best.score ? c : best);
  
  const totalContentCells = selected.regions.reduce((sum, r) => sum + (r.result?.cells.length ?? 0), 0);
  
  devLogger.log('v4', 'Selected candidate', {
    regionCount: selected.regions.length,
    regionSizes: selected.regions.map(r => r.photos.length),
    regionRows: selected.regions.map(r => r.targetRowCount),
    contentCells: totalContentCells,
    corner: selected.corner,
    canvasAR: (selected.canvasWidth / selected.canvasHeight).toFixed(2),
    score: selected.score.toFixed(3),
  });
  
  const heroAR = dimensions.reduce((h, d) => d.weight > h.weight ? d : h).aspectRatio;
  
  return {
    layout: convertToLayout(selected, normalizedGap),
    layoutMeta: {
      template: selected.meta.template,
      targetCanvasAR: selected.meta.targetCanvasAR,
      actualCanvasAR: +(selected.canvasWidth / selected.canvasHeight).toFixed(3),
      arDeviation: selected.meta.arDeviation,
      areaFrac: selected.meta.areaFrac,
      heroCoverage: selected.meta.heroCoverage,
      heroAR,
      prominenceRatio: selected.prominenceRatio,
      score: selected.score,
      corner: selected.corner,
      candidateCount: selected.meta.candidateCount,
      regionSizes: selected.meta.regionSizes,
      regionTargetRows: selected.meta.regionTargetRows,
      regionActualRows: selected.meta.regionActualRows,
      besideWidth: selected.meta.besideWidth,
      belowHeight: selected.meta.belowHeight,
    },
  };
}

// ============================================================================
// Message Handler
// ============================================================================

self.onmessage = (e: MessageEvent<LayoutRequest>) => {
  const { type, requestId, dimensions, normalizedGap, tuning, randomize } = e.data;
  
  if (type !== 'generate') {
    return;
  }
  
  const startTime = performance.now();
  
  try {
    const result = generateLayout(dimensions, normalizedGap, tuning, randomize);
    const durationMs = performance.now() - startTime;
    
    const response: LayoutResponse = {
      type: 'result',
      requestId,
      layout: result.layout!,
      durationMs,
      logs: isDev ? workerLogs : undefined,
      softRejection: result.softRejection,
      layoutMeta: result.layoutMeta,
    };
    
    self.postMessage(response);
  } catch (error) {
    console.error('Layout worker error:', error);
    const durationMs = performance.now() - startTime;
    const response: LayoutResponse = {
      type: 'result',
      requestId,
      layout: { width: 1000, height: 1000, cells: [] },
      durationMs,
      logs: isDev ? workerLogs : undefined,
      softRejection: {
        reason: 'worker_error',
        details: { 
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
    };
    self.postMessage(response);
  }
};
