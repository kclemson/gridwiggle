/**
 * Layout Worker
 * 
 * Runs V4 layout generation off the main thread so the UI stays responsive
 * and spinners can animate during computation.
 * 
 * V4 is a simplified orchestrator that calls proven V3 math functions.
 */

import { PhotoDimension, V3Tuning, DEFAULT_V3_TUNING, NormalizedCell } from '@/lib/v3/types';
import { CollageLayout, CollageCell } from '@/types/collage';
import { packToFillHeight, packToFillWidth } from '@/lib/v3/normalized-pack';
import { shuffleArray, deriveRegionCounts, sampleCanvasARValues, sampleAreaFractions } from '@/lib/v3/utils';
import { devLogger, LogEntry } from '@/lib/devLogger';

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
}

// ============================================================================
// V4 Layout Candidate
// ============================================================================

interface LayoutCandidate {
  besideCount: number;
  besideRowCount: number;
  belowRowCount: number;
  besideCells: NormalizedCell[];
  belowCells: NormalizedCell[];
  heroCell: NormalizedCell;
  canvasWidth: number;
  canvasHeight: number;
  prominenceRatio: number;
  score: number;
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
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

// Corner-anchor template parameters (will move to registry later)
const CORNER_ANCHOR_TEMPLATE = {
  areaFraction: { min: 0.15, max: 0.60, squareMax: 0.35 },
};

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
  
  // Sample canvas AR values from tuning range
  const canvasARSamples = sampleCanvasARValues(tuning.canvas_minAR, tuning.canvas_maxAR, 6, randomize);
  const { areaFraction } = CORNER_ANCHOR_TEMPLATE;
  
  // Track unique splits to avoid duplicate packing work
  const triedSplits = new Set<string>();
  
  for (const targetCanvasAR of canvasARSamples) {
    const areaSamples = sampleAreaFractions(
      areaFraction.min, areaFraction.max, areaFraction.squareMax, targetCanvasAR, 3
    );
    
    for (const areaFrac of areaSamples) {
      const { besideCount } = deriveRegionCounts(heroAR, targetCanvasAR, areaFrac, ordered.length);
      
      const beside = ordered.slice(0, besideCount);
      const below = ordered.slice(besideCount);
      
      const maxBesideRows = Math.max(1, Math.ceil(besideCount / 2));
      const minBesideRows = besideCount > 0 ? 1 : 0;
      
      for (let besideRowCount = minBesideRows; besideRowCount <= maxBesideRows; besideRowCount++) {
        const splitKey = `${besideCount}-${besideRowCount}`;
        if (triedSplits.has(splitKey)) continue;
        triedSplits.add(splitKey);
        
        const besideResult = besideCount > 0 
          ? packToFillHeight(beside, 1.0, normalizedGap, besideRowCount, tuning, randomize)
          : { cells: [], width: 0, height: 1.0, rowCount: 0 };
        
        if (besideCount > 0 && besideResult.cells.length === 0) continue;
        
        const heroRowWidth = heroAR + (besideCount > 0 ? normalizedGap + besideResult.width : 0);
        
        const maxBelowRows = below.length > 0 
          ? Math.max(1, Math.ceil(below.length / 2))
          : 0;
        
        const belowRowCounts = below.length > 0
          ? (randomize 
              ? [1 + Math.floor(Math.random() * maxBelowRows)]
              : Array.from({ length: maxBelowRows }, (_, i) => i + 1))
          : [0];
        
        for (const belowRowCount of belowRowCounts) {
          const belowResult = below.length > 0 && belowRowCount > 0
            ? packToFillWidth(below, heroRowWidth, normalizedGap, belowRowCount, tuning, randomize)
            : { cells: [], width: heroRowWidth, height: 0, rowCount: 0 };
          
          if (below.length > 0 && belowResult.cells.length === 0) continue;
          
          const totalHeight = 1.0 + (below.length > 0 ? normalizedGap + belowResult.height : 0);
          const canvasWidth = heroRowWidth + 2 * normalizedGap;
          const canvasHeight = totalHeight + 2 * normalizedGap;
          const canvasAR = canvasWidth / canvasHeight;
          
          if (canvasAR < tuning.canvas_minAR || canvasAR > tuning.canvas_maxAR) continue;
          
          const besideAreas = besideResult.cells.map(c => c.width * c.height);
          const heroArea = heroAR * 1.0;
          const maxBesideArea = Math.max(...besideAreas, 0);
          const prominenceRatio = maxBesideArea > 0 ? heroArea / maxBesideArea : Infinity;
          
          if (prominenceRatio < tuning.hero_minProminence) continue;
          
          const allAreas = [...besideAreas, ...belowResult.cells.map(c => c.width * c.height)];
          const coherenceScore = tierCoherenceScore(allAreas);
          const presenceScore = besideCount > 0 ? 1.0 : 0.4;
          const score = (coherenceScore * 0.7) + (presenceScore * 0.3);
          
          const corner = randomize 
            ? corners[Math.floor(Math.random() * 4)]
            : 'top-left';
          
          const heroCell: NormalizedCell = {
            photoId: heroPhoto.id,
            x: normalizedGap,
            y: normalizedGap,
            width: heroAR,
            height: 1.0,
          };
          
          candidates.push({
            besideCount,
            besideRowCount,
            belowRowCount,
            besideCells: besideResult.cells,
            belowCells: belowResult.cells,
            heroCell,
            canvasWidth,
            canvasHeight,
            prominenceRatio,
            score,
            corner,
          });
        }
      }
    }
  }
  
  return candidates;
}

// ============================================================================
// Convert Candidate to Layout
// ============================================================================

function convertToLayout(candidate: LayoutCandidate, normalizedGap: number): CollageLayout {
  const cells: CollageCell[] = [];
  const { corner, canvasWidth, canvasHeight, heroCell, besideCells, belowCells } = candidate;
  
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
  
  const heroPos = transform(heroCell.x, heroCell.y, heroCell.width, heroCell.height);
  cells.push({
    photoId: heroCell.photoId,
    x: Math.round(heroPos.x * VIRTUAL_CANVAS_BASE),
    y: Math.round(heroPos.y * VIRTUAL_CANVAS_BASE),
    width: Math.round(heroCell.width * VIRTUAL_CANVAS_BASE),
    height: Math.round(heroCell.height * VIRTUAL_CANVAS_BASE),
  });
  
  const besideOffsetX = normalizedGap + candidate.heroCell.width + normalizedGap;
  for (const cell of besideCells) {
    const pos = transform(besideOffsetX + cell.x, normalizedGap + cell.y, cell.width, cell.height);
    cells.push({
      photoId: cell.photoId,
      x: Math.round(pos.x * VIRTUAL_CANVAS_BASE),
      y: Math.round(pos.y * VIRTUAL_CANVAS_BASE),
      width: Math.round(cell.width * VIRTUAL_CANVAS_BASE),
      height: Math.round(cell.height * VIRTUAL_CANVAS_BASE),
    });
  }
  
  const belowOffsetY = normalizedGap + 1.0 + normalizedGap;
  for (const cell of belowCells) {
    const pos = transform(normalizedGap + cell.x, belowOffsetY + cell.y, cell.width, cell.height);
    cells.push({
      photoId: cell.photoId,
      x: Math.round(pos.x * VIRTUAL_CANVAS_BASE),
      y: Math.round(pos.y * VIRTUAL_CANVAS_BASE),
      width: Math.round(cell.width * VIRTUAL_CANVAS_BASE),
      height: Math.round(cell.height * VIRTUAL_CANVAS_BASE),
    });
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
    // Fallback: simple 2-row layout
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
  
  devLogger.log('v4', 'Selected candidate', {
    besideCount: selected.besideCount,
    belowCount: selected.belowCells.length,
    corner: selected.corner,
    canvasAR: (selected.canvasWidth / selected.canvasHeight).toFixed(2),
    score: selected.score.toFixed(3),
  });
  
  return {
    layout: convertToLayout(selected, normalizedGap),
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
    // generateLayout clears workerLogs at start
    const result = generateLayout(dimensions, normalizedGap, tuning, randomize);
    const durationMs = performance.now() - startTime;
    
    // Layout is now always non-null (soft rejections instead of hard)
    const response: LayoutResponse = {
      type: 'result',
      requestId,
      layout: result.layout!,
      durationMs,
      logs: isDev ? workerLogs : undefined,
      softRejection: result.softRejection,
    };
    
    self.postMessage(response);
  } catch (error) {
    // For true errors (crashes), create a minimal empty layout
    // This should be extremely rare - log for debugging
    console.error('Layout worker error:', error);
    const durationMs = performance.now() - startTime;
    const response: LayoutResponse = {
      type: 'result',
      requestId,
      layout: { width: 1000, height: 1000, cells: [] },  // Empty fallback layout
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
