/**
 * V4 Layout Orchestrator
 * 
 * Simplified orchestrator that calls proven math functions.
 * Uses generic PackableRegion abstraction for future multi-region support.
 */

import { PhotoItem, CollageSettings, CollageLayout, CollageCell } from '@/types/collage';
import { getDisplayCrop } from '@/lib/cropUtils';
import { PhotoDimension, NormalizedCell, V3Tuning, DEFAULT_V3_TUNING, PackableRegion } from '@/lib/v3/types';
import { packToFillHeight, packToFillWidth, packToFillHeightAtTargetWidth, packToFillWidthAtTargetHeight } from '@/lib/v3/normalized-pack';
import { shuffleArray, deriveRegionCounts, deriveTargetRowCount, mean, sampleCanvasARValues, sampleAreaFractions } from '@/lib/v3/utils';
import { devLogger } from '@/lib/devLogger';

// Virtual canvas base unit for final pixel values
const VIRTUAL_CANVAS_BASE = 1000;

// ============================================================================
// Candidate Interface (region-generic)
// ============================================================================

interface LayoutCandidate {
  regions: PackableRegion[];
  heroCell: NormalizedCell;
  canvasWidth: number;
  canvasHeight: number;
  prominenceRatio: number;
  score: number;
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

// ============================================================================
// Photo Extraction
// ============================================================================

function extractPhotoDimensions(
  photos: PhotoItem[],
  weights: Record<string, number> = {}
): PhotoDimension[] {
  return photos.map(photo => {
    const crop = getDisplayCrop(photo);
    const width = crop ? crop.width : photo.originalWidth;
    const height = crop ? crop.height : photo.originalHeight;
    return {
      id: photo.id,
      aspectRatio: width / height,
      weight: weights[photo.id] ?? 1,
    };
  });
}

// ============================================================================
// Cell Balance Scoring (F-ratio + Spread Constraint)
// ============================================================================

function scoreCellBalance(
  areas: number[],
  photoCount: number,
  tuning: V3Tuning,
  tierCount: number = 3
): { score: number; coherence: number; spreadRatio: number; spreadPenalty: number } {
  if (areas.length < 2) {
    return { score: 1.0, coherence: 1.0, spreadRatio: 1, spreadPenalty: 0 };
  }
  
  const sorted = [...areas].sort((a, b) => b - a);
  const largest = sorted[0];
  const smallest = sorted[sorted.length - 1];
  
  let coherence = 0.5;
  if (areas.length >= tierCount * 2) {
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
    coherence = Math.min(1.0, fRatio / 5);
  }
  
  const adaptiveLimit = tuning.tier_baseSpreadLimit * Math.sqrt(photoCount / 10);
  const spreadRatio = smallest > 0 ? largest / smallest : Infinity;
  
  const spreadPenalty = spreadRatio <= adaptiveLimit 
    ? 0 
    : Math.min(0.4, (spreadRatio - adaptiveLimit) / adaptiveLimit * 0.3);
  
  const score = Math.max(0.1, coherence - spreadPenalty);
  
  return { score, coherence, spreadRatio, spreadPenalty };
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

// ============================================================================
// Region Packing
// ============================================================================

const CORNER_ANCHOR_TEMPLATE = {
  areaFraction: { min: 0.15, max: 0.60, squareMax: 0.35 },
};

const AR_COHERENCE_THRESHOLD = 0.4;

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
    // Dimension-aware: search row counts to minimize deviation from soft target
    result = region.constraint === 'height'
      ? packToFillHeightAtTargetWidth(region.photos, region.targetDimension, normalizedGap, region.targetSoftDimension, tuning, randomize)
      : packToFillWidthAtTargetHeight(region.photos, region.targetDimension, normalizedGap, region.targetSoftDimension, tuning, randomize);
  } else {
    // Fallback: use targetRowCount directly
    result = region.constraint === 'height'
      ? packToFillHeight(region.photos, region.targetDimension, normalizedGap, region.targetRowCount, tuning, randomize)
      : packToFillWidth(region.photos, region.targetDimension, normalizedGap, region.targetRowCount, tuning, randomize);
  }
  
  return { ...region, result: result.cells.length > 0 ? result : null };
}

// ============================================================================
// Candidate Generation (region-generic)
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
  
  const canvasARSamples = sampleCanvasARValues(tuning.canvas_minAR, tuning.canvas_maxAR, 6, randomize);
  const { areaFraction } = CORNER_ANCHOR_TEMPLATE;
  
  const triedConfigs = new Set<string>();
  
  for (const targetCanvasAR of canvasARSamples) {
    const areaSamples = sampleAreaFractions(
      areaFraction.min, areaFraction.max, areaFraction.squareMax, targetCanvasAR, 3
    );
    
    for (const areaFrac of areaSamples) {
      const { besideCount } = deriveRegionCounts(heroAR, targetCanvasAR, areaFrac, ordered.length);
      const belowCount = ordered.length - besideCount;
      
      let hHero = Math.sqrt(areaFrac * targetCanvasAR / heroAR);
      hHero = Math.max(0.1, Math.min(0.95, hHero));
      const wHero = heroAR * hHero;
      
      const targetBesideWidth = targetCanvasAR - wHero;
      const targetBelowHeight = 1.0 - hHero;
      
      const besidePhotos = ordered.slice(0, besideCount);
      const belowPhotos = ordered.slice(besideCount);
      
      const besideMeanAR = besidePhotos.length > 0 ? mean(besidePhotos.map(p => p.aspectRatio)) : 1;
      const belowMeanAR = belowPhotos.length > 0 ? mean(belowPhotos.map(p => p.aspectRatio)) : 1;
      
      const baseBesideRows = besideCount > 0
        ? deriveTargetRowCount(besideCount, besideMeanAR, Math.max(0.01, targetBesideWidth), hHero)
        : 0;
      const baseBelowRows = belowCount > 0
        ? deriveTargetRowCount(belowCount, belowMeanAR, targetCanvasAR, Math.max(0.01, targetBelowHeight))
        : 0;
      
      const configKey = `${besideCount}-${areaFrac.toFixed(3)}-${targetCanvasAR.toFixed(3)}`;
      if (triedConfigs.has(configKey)) continue;
      triedConfigs.add(configKey);
      
      // Build regions with soft targets (packer self-optimizes row counts)
      const regions: PackableRegion[] = [
        {
          constraint: 'height',
          targetDimension: 1.0,
          targetSoftDimension: targetBesideWidth > 0.01 ? targetBesideWidth : undefined,
          photos: besidePhotos,
          targetRowCount: baseBesideRows,
          offset: { x: normalizedGap + heroAR + normalizedGap, y: normalizedGap },
          result: null,
        },
        {
          constraint: 'width',
          targetDimension: 0, // filled after packing region 0
          targetSoftDimension: targetBelowHeight > 0.01 ? targetBelowHeight : undefined,
          photos: belowPhotos,
          targetRowCount: baseBelowRows,
          offset: { x: normalizedGap, y: normalizedGap + 1.0 + normalizedGap },
          result: null,
        },
      ];
      
      // Pack region 0 (beside hero) - packer finds best row count internally
      regions[0] = packRegion(regions[0], normalizedGap, tuning, randomize);
      if (besideCount > 0 && !regions[0].result) continue;
      
      // Compute hero row width and set region 1's hard dimension
      const besideWidth = regions[0].result?.width ?? 0;
      const heroRowWidth = heroAR + (besideCount > 0 ? normalizedGap + besideWidth : 0);
      regions[1] = { ...regions[1], targetDimension: heroRowWidth };
      
      // Pack region 1 (below hero row) - packer finds best row count internally
      regions[1] = packRegion(regions[1], normalizedGap, tuning, randomize);
      if (belowCount > 0 && !regions[1].result) continue;
      
      // Compute canvas dimensions
      const belowHeight = regions[1].result?.height ?? 0;
      const totalHeight = 1.0 + (belowCount > 0 ? normalizedGap + belowHeight : 0);
      const canvasWidth = heroRowWidth + 2 * normalizedGap;
      const canvasHeight = totalHeight + 2 * normalizedGap;
      const canvasAR = canvasWidth / canvasHeight;
      
      if (canvasAR < tuning.canvas_minAR || canvasAR > tuning.canvas_maxAR) continue;
      
      const arDeviation = Math.abs(canvasAR - targetCanvasAR) / targetCanvasAR;
      if (arDeviation > AR_COHERENCE_THRESHOLD) continue;
      
      const allContentAreas: number[] = [];
      for (const region of regions) {
        if (region.result) {
          for (const cell of region.result.cells) {
            allContentAreas.push(cell.width * cell.height);
          }
        }
      }
      
      const heroArea = heroAR * 1.0;
      const maxContentArea = Math.max(...allContentAreas, 0);
      const prominenceRatio = maxContentArea > 0 ? heroArea / maxContentArea : Infinity;
      
      if (prominenceRatio < tuning.hero_minProminence) continue;
      
      const allAreas = [heroArea, ...allContentAreas];
      const balanceResult = scoreCellBalance(allAreas, allAreas.length, tuning);
      const presenceScore = besideCount > 0 ? 1.0 : 0.4;
      const score = (balanceResult.score * 0.7) + (presenceScore * 0.3);
      
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
        regions,
        heroCell,
        canvasWidth,
        canvasHeight,
        prominenceRatio,
        score,
        corner,
      });
    }
  }
  
  devLogger.log('layout', `V4 generated ${candidates.length} candidates (template-sampled)`, {
    photoCount: contentPhotos.length + 1,
    heroAR: heroAR.toFixed(2),
    sampledConfigs: triedConfigs.size,
    arRange: candidates.length > 0 
      ? `${Math.min(...candidates.map(c => c.canvasWidth / c.canvasHeight)).toFixed(2)} - ${Math.max(...candidates.map(c => c.canvasWidth / c.canvasHeight)).toFixed(2)}`
      : 'none',
  });
  
  return candidates;
}

// ============================================================================
// Candidate Selection
// ============================================================================

function selectCandidate(
  candidates: LayoutCandidate[],
  randomize: boolean
): LayoutCandidate | null {
  if (candidates.length === 0) return null;
  
  return randomize 
    ? weightedRandomSelect(candidates)
    : candidates.reduce((best, c) => c.score > best.score ? c : best);
}

// ============================================================================
// Convert to Layout (region-generic)
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
  
  // Add all region cells (generic loop)
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
// Main API
// ============================================================================

export interface GenerateLayoutV4Options {
  photoWeights?: Record<string, number>;
  tuning?: Partial<V3Tuning>;
  randomize?: boolean;
}

export function generateCollageLayoutV4(
  photos: PhotoItem[],
  settings: CollageSettings,
  options: GenerateLayoutV4Options = {}
): CollageLayout | null {
  if (photos.length < 2) return null;
  
  const { 
    photoWeights = {}, 
    tuning: tuningOverrides,
    randomize = false,
  } = options;
  
  const tuning: V3Tuning = { ...DEFAULT_V3_TUNING, ...tuningOverrides };
  
  const normalizedGap = (settings.gapSize / 100) * 0.04;
  
  devLogger.log('layout', 'Starting V4 layout generation', {
    photoCount: photos.length,
    randomize,
    tuning: {
      canvas_minAR: tuning.canvas_minAR,
      canvas_maxAR: tuning.canvas_maxAR,
      hero_minProminence: tuning.hero_minProminence,
    },
  });
  
  const dimensions = extractPhotoDimensions(photos, photoWeights);
  
  const heroPhoto = dimensions.reduce((h, d) => d.weight > h.weight ? d : h);
  const contentPhotos = dimensions.filter(d => d.id !== heroPhoto.id);
  
  devLogger.log('layout', 'Photo analysis', {
    heroId: heroPhoto.id,
    heroAR: heroPhoto.aspectRatio.toFixed(2),
    contentCount: contentPhotos.length,
    avgContentAR: (contentPhotos.reduce((s, d) => s + d.aspectRatio, 0) / contentPhotos.length).toFixed(2),
  });
  
  const candidates = generateCandidates(heroPhoto, contentPhotos, normalizedGap, tuning, randomize);
  
  if (candidates.length === 0) {
    devLogger.warn('layout', 'V4: No valid candidates found');
    return null;
  }
  
  const selected = selectCandidate(candidates, randomize);
  
  if (!selected) {
    return null;
  }
  
  const totalContentCells = selected.regions.reduce((sum, r) => sum + (r.result?.cells.length ?? 0), 0);
  
  devLogger.log('layout', 'V4 selected candidate', {
    regionCount: selected.regions.length,
    regionSizes: selected.regions.map(r => r.photos.length),
    regionRows: selected.regions.map(r => r.targetRowCount),
    contentCells: totalContentCells,
    corner: selected.corner,
    canvasAR: (selected.canvasWidth / selected.canvasHeight).toFixed(2),
    score: selected.score.toFixed(3),
  });
  
  return convertToLayout(selected, normalizedGap);
}
