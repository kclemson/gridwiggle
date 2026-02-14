/**
 * V4 Layout Engine (shared core)
 * 
 * Single source of truth for the layout algorithm.
 * Used by both the Web Worker (background thread) and the sync fallback (main thread).
 * 
 * Uses v4/index.ts's soft-penalty scoring (canonical) with the worker's
 * no-null safety net (stacked-strip fallback when zero candidates survive).
 */

import { CollageLayout, CollageCell } from '@/types/collage';
import { PhotoDimension, NormalizedCell, V3Tuning, DEFAULT_V3_TUNING, PackableRegion } from '@/lib/v3/types';
import { packToFillHeight, packToFillWidth, packToFillHeightAtTargetWidth, packToFillWidthAtTargetHeight } from '@/lib/v3/normalized-pack';
import { shuffleArray, deriveRegionCounts, deriveRegionCountsThreeWay, deriveTargetRowCount, mean, sampleCanvasARValues, sampleAreaFractions, coefficientOfVariation } from '@/lib/v3/utils';
import { devLogger, RejectedLayoutGeometry } from '@/lib/devLogger';
import { findCandidateTemplates, getTemplateTopology, effectiveAreaFractionMax, photoCountScale } from '@/lib/v3/hero-constraints';

// Virtual canvas base unit for final pixel values
const VIRTUAL_CANVAS_BASE = 1000;

// ============================================================================
// Types
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
  penalties?: { ar: number; coverage: number; prominence: number };
}

interface LayoutCandidate {
  regions: PackableRegion[];
  heroCell: NormalizedCell;
  heroCell2?: NormalizedCell;
  canvasWidth: number;
  canvasHeight: number;
  prominenceRatio: number;
  score: number;
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  meta: LayoutCandidateMeta;
}

export interface EngineResult {
  layout: CollageLayout;
  softRejection?: { reason: string; details: Record<string, unknown> };
  layoutMeta?: Record<string, unknown>;
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

const AR_COHERENCE_THRESHOLD = 0.25;
const HERO_COVERAGE_CEILING = 0.50;

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
// Candidate Generation (template-driven, single hero)
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
  
  const templates = findCandidateTemplates(1, [heroAR]);
  const triedConfigs = new Set<string>();
  
  for (const template of templates) {
    const minAR = Math.max(template.canvasAR.min, tuning.canvas_minAR);
    const maxAR = Math.min(template.canvasAR.max, tuning.canvas_maxAR);
    if (minAR > maxAR) continue;
    
    const canvasARSamples = sampleCanvasARValues(minAR, maxAR, 6, randomize);
    const { heroAreaFraction } = template;
    
    for (const targetCanvasAR of canvasARSamples) {
      const totalPhotos = contentPhotos.length + 1;
      const maxFrac = effectiveAreaFractionMax(heroAreaFraction, targetCanvasAR, totalPhotos);
      const areaSamples = sampleAreaFractions(heroAreaFraction.min, maxFrac, 3);
      
      for (const areaFrac of areaSamples) {
        const topology = getTemplateTopology(template.id, heroAR, areaFrac, targetCanvasAR, normalizedGap);
        if (!topology) continue;
        
        const { heroCell: topologyHero } = topology;
        const wHero = topologyHero.width;
        const hHero = topologyHero.height;
        
        const isSingleRegion = topology.regions.length === 1;
        
        let besideCount: number;
        let belowCount: number;
        if (isSingleRegion) {
          besideCount = ordered.length;
          belowCount = 0;
        } else {
          const derived = deriveRegionCounts(heroAR, targetCanvasAR, areaFrac, ordered.length);
          besideCount = derived.besideCount;
          belowCount = derived.belowCount;
        }
        
        const besidePhotos = ordered.slice(0, besideCount);
        const belowPhotos = ordered.slice(besideCount);
        
        const besideMeanAR = besidePhotos.length > 0 ? mean(besidePhotos.map(p => p.aspectRatio)) : 1;
        const belowMeanAR = belowPhotos.length > 0 ? mean(belowPhotos.map(p => p.aspectRatio)) : 1;
        
        const region0Spec = topology.regions[0];
        const region1Spec = topology.regions[1];
        const targetBesideWidth = region0Spec?.softDimension ?? 0;
        const targetBelowHeight = region1Spec?.softDimension ?? 0;
        
        const baseBesideRows = besideCount > 0
          ? deriveTargetRowCount(
              besideCount, besideMeanAR,
              region0Spec.constraint === 'width' ? region0Spec.hardDimension : Math.max(0.01, targetBesideWidth),
              region0Spec.constraint === 'width' ? Math.max(0.01, targetBesideWidth) : hHero
            )
          : 0;
        const baseBelowRows = !isSingleRegion && belowCount > 0
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
        
        if (isSingleRegion) {
          // Single-region path
          regions[0] = packRegion(regions[0], normalizedGap, tuning, randomize);
          if (!regions[0].result) continue;
          
          const regionResult = regions[0].result;
          let canvasWidth: number, canvasHeight: number;
          let besideWidth = 0, belowHeight = 0;
          
          if (region0Spec.constraint === 'width') {
            const contentHeight = regionResult.height;
            if (template.id === 'hero-column') {
              const totalHeight = Math.max(hHero, contentHeight);
              canvasWidth = wHero + normalizedGap + region0Spec.hardDimension + 2 * normalizedGap;
              canvasHeight = totalHeight + 2 * normalizedGap;
              besideWidth = region0Spec.hardDimension;
            } else {
              canvasWidth = wHero + 2 * normalizedGap;
              canvasHeight = hHero + normalizedGap + contentHeight + 2 * normalizedGap;
              belowHeight = contentHeight;
            }
          } else {
            const contentWidth = regionResult.width;
            canvasWidth = wHero + normalizedGap + contentWidth + 2 * normalizedGap;
            canvasHeight = hHero + 2 * normalizedGap;
            besideWidth = contentWidth;
          }
          
          const canvasAR = canvasWidth / canvasHeight;
          const heroArea = wHero * hHero;
          const canvasArea = canvasWidth * canvasHeight;
          const heroCoverage = heroArea / canvasArea;
          
          // Soft penalty for canvas AR outside bounds (instead of hard reject)
          let arBoundsPenalty = 0;
          if (canvasAR < tuning.canvas_minAR) {
            const overshoot = (tuning.canvas_minAR - canvasAR) / tuning.canvas_minAR;
            arBoundsPenalty = Math.min(0.5, overshoot * 2.0);
          } else if (canvasAR > tuning.canvas_maxAR) {
            const overshoot = (canvasAR - tuning.canvas_maxAR) / tuning.canvas_maxAR;
            arBoundsPenalty = Math.min(0.5, overshoot * 2.0);
          }
          if (arBoundsPenalty > 0) {
            devLogger.warn('v4-penalty', 'Canvas AR bounds penalty', {
              template: template.id, canvasAR: +canvasAR.toFixed(3),
              min: tuning.canvas_minAR, max: tuning.canvas_maxAR,
              penalty: +arBoundsPenalty.toFixed(3),
            });
          }
          
          const arDeviation = Math.abs(canvasAR - targetCanvasAR) / targetCanvasAR;
          const arPenalty = arDeviation > AR_COHERENCE_THRESHOLD
            ? Math.min(0.3, (arDeviation - AR_COHERENCE_THRESHOLD) * 1.2) : 0;
          const coveragePenalty = heroCoverage > HERO_COVERAGE_CEILING
            ? Math.min(0.3, (heroCoverage - HERO_COVERAGE_CEILING) * 1.5) : 0;
          
          const allContentAreas = regions[0].result.cells.map(c => c.width * c.height);
          const maxContentArea = Math.max(...allContentAreas, 0);
          const prominenceRatio = maxContentArea > 0 ? heroArea / maxContentArea : Infinity;
          const countScale1 = photoCountScale(contentPhotos.length + 1);
          const effectiveMinProminence1 = tuning.hero_minProminence * countScale1;
          const prominencePenalty = prominenceRatio < effectiveMinProminence1
            ? Math.min(0.3, (effectiveMinProminence1 - prominenceRatio) * 1.0) : 0;
          
          const contentCV = coefficientOfVariation(allContentAreas);
          const CV_THRESHOLD = 0.35;
          const contentUniformityPenalty = contentCV > CV_THRESHOLD
            ? Math.min(0.25, (contentCV - CV_THRESHOLD) * 0.5)
            : 0;
          
          const allAreas = [heroArea, ...allContentAreas];
          const balanceResult = scoreCellBalance(allAreas, allAreas.length, tuning);
          const rawScore = balanceResult.score;
          const score = Math.max(0.05, rawScore - arPenalty - coveragePenalty - prominencePenalty - contentUniformityPenalty - arBoundsPenalty);
          
          const corner = randomize
            ? corners[Math.floor(Math.random() * 4)]
            : 'top-left';
          
          const heroCell: NormalizedCell = {
            photoId: heroPhoto.id,
            x: topologyHero.x, y: topologyHero.y,
            width: wHero, height: hHero,
          };
          
          const penalties = { ar: arPenalty, coverage: coveragePenalty, prominence: prominencePenalty };
          
          candidates.push({
            regions, heroCell,
            canvasWidth, canvasHeight,
            prominenceRatio, score, corner,
            meta: {
              template: template.id, targetCanvasAR, areaFrac, arDeviation, heroCoverage,
              regionSizes: [besideCount],
              regionTargetRows: [baseBesideRows],
              regionActualRows: regions.map(r => r.result?.rowCount ?? 0),
              besideWidth, belowHeight,
              candidateCount: 0, penalties,
            },
          });
          continue;
        }
        
        // --- Two-region path (corner-anchor etc.) ---
        
        regions[0] = packRegion(regions[0], normalizedGap, tuning, randomize);
        if (besideCount > 0 && !regions[0].result) continue;
        
        const besideWidth = regions[0].result?.width ?? 0;
        const heroRowWidth = wHero + (besideCount > 0 ? normalizedGap + besideWidth : 0);
        regions[1] = { ...regions[1], targetDimension: heroRowWidth };
        
        regions[1] = packRegion(regions[1], normalizedGap, tuning, randomize);
        if (belowCount > 0 && !regions[1].result) continue;
        
        const belowHeight = regions[1].result?.height ?? 0;
        const totalHeight = hHero + (belowCount > 0 ? normalizedGap + belowHeight : 0);
        const canvasWidth = heroRowWidth + 2 * normalizedGap;
        const canvasHeight = totalHeight + 2 * normalizedGap;
        const canvasAR = canvasWidth / canvasHeight;
        
        const heroArea = wHero * hHero;
        const canvasArea = canvasWidth * canvasHeight;
        const heroCoverage = heroArea / canvasArea;
        
        // Soft penalty for canvas AR outside bounds (instead of hard reject)
        let arBoundsPenalty = 0;
        if (canvasAR < tuning.canvas_minAR) {
          const overshoot = (tuning.canvas_minAR - canvasAR) / tuning.canvas_minAR;
          arBoundsPenalty = Math.min(0.5, overshoot * 2.0);
        } else if (canvasAR > tuning.canvas_maxAR) {
          const overshoot = (canvasAR - tuning.canvas_maxAR) / tuning.canvas_maxAR;
          arBoundsPenalty = Math.min(0.5, overshoot * 2.0);
        }
        if (arBoundsPenalty > 0) {
          devLogger.warn('v4-penalty', 'Canvas AR bounds penalty', {
            template: template.id, canvasAR: +canvasAR.toFixed(3),
            min: tuning.canvas_minAR, max: tuning.canvas_maxAR,
            penalty: +arBoundsPenalty.toFixed(3),
          });
        }
        
        const arDeviation = Math.abs(canvasAR - targetCanvasAR) / targetCanvasAR;
        
        const arPenalty = arDeviation > AR_COHERENCE_THRESHOLD
          ? Math.min(0.3, (arDeviation - AR_COHERENCE_THRESHOLD) * 1.2)
          : 0;
        if (arPenalty > 0) {
          devLogger.warn('v4-penalty', 'AR coherence penalty', {
            template: template.id, targetAR: +targetCanvasAR.toFixed(3),
            actualAR: +canvasAR.toFixed(3), deviation: +(arDeviation * 100).toFixed(1),
            penalty: +arPenalty.toFixed(3),
          });
        }
        
        const coveragePenalty = heroCoverage > HERO_COVERAGE_CEILING
          ? Math.min(0.3, (heroCoverage - HERO_COVERAGE_CEILING) * 1.5)
          : 0;
        if (coveragePenalty > 0) {
          devLogger.warn('v4-penalty', 'Hero coverage penalty', {
            template: template.id, heroCoverage: +(heroCoverage * 100).toFixed(1),
            ceiling: +(HERO_COVERAGE_CEILING * 100).toFixed(0),
            penalty: +coveragePenalty.toFixed(3),
          });
        }
        
        const allContentAreas: number[] = [];
        for (const region of regions) {
          if (region.result) {
            for (const cell of region.result.cells) {
              allContentAreas.push(cell.width * cell.height);
            }
          }
        }
        
        const heroAreaVal = wHero * hHero;
        const maxContentArea = Math.max(...allContentAreas, 0);
        const prominenceRatio = maxContentArea > 0 ? heroAreaVal / maxContentArea : Infinity;
        
        const countScale2 = photoCountScale(contentPhotos.length + 1);
        const effectiveMinProminence2 = tuning.hero_minProminence * countScale2;
        const prominencePenalty = prominenceRatio < effectiveMinProminence2
          ? Math.min(0.3, (effectiveMinProminence2 - prominenceRatio) * 1.0)
          : 0;
        if (prominencePenalty > 0) {
          devLogger.warn('v4-penalty', 'Prominence penalty', {
            template: template.id, prominenceRatio: +prominenceRatio.toFixed(3),
            threshold: tuning.hero_minProminence,
            penalty: +prominencePenalty.toFixed(3),
          });
        }
        
        const contentCV = coefficientOfVariation(allContentAreas);
        const CV_THRESHOLD = 0.35;
        const contentUniformityPenalty = contentCV > CV_THRESHOLD
          ? Math.min(0.25, (contentCV - CV_THRESHOLD) * 0.5)
          : 0;
        
        const allAreas = [heroAreaVal, ...allContentAreas];
        const balanceResult = scoreCellBalance(allAreas, allAreas.length, tuning);
        const presenceScore = besideCount > 0 ? 1.0 : 0.4;
        const rawScore = (balanceResult.score * 0.7) + (presenceScore * 0.3);
        const score = Math.max(0.05, rawScore - arPenalty - coveragePenalty - prominencePenalty - contentUniformityPenalty - arBoundsPenalty);
        
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
        
        const penalties = { ar: arPenalty, coverage: coveragePenalty, prominence: prominencePenalty };
        
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
            candidateCount: 0,
            penalties,
          },
        });
      }
    }
  }
  
  for (const c of candidates) {
    c.meta.candidateCount = candidates.length;
  }
  
  devLogger.log('layout', `V4 generated ${candidates.length} candidates (template-driven)`, {
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
// Dual Hero Candidate Generation (diagonal-corners)
// ============================================================================

function generateDualHeroCandidates(
  hero1: PhotoDimension,
  hero2: PhotoDimension,
  contentPhotos: PhotoDimension[],
  normalizedGap: number,
  tuning: V3Tuning,
  randomize: boolean
): LayoutCandidate[] {
  const candidates: LayoutCandidate[] = [];
  
  const ordered = randomize
    ? shuffleArray(contentPhotos)
    : [...contentPhotos].sort((a, b) => a.aspectRatio - b.aspectRatio);
  
  const templates = findCandidateTemplates(2, [hero1.aspectRatio, hero2.aspectRatio]);
  const triedConfigs = new Set<string>();
  
  const diagonalCorners: Array<'top-left' | 'top-right'> = ['top-left', 'top-right'];
  
  for (const template of templates) {
    if (template.id !== 'diagonal-corners') continue;
    
    const minAR = Math.max(template.canvasAR.min, tuning.canvas_minAR);
    const maxAR = Math.min(template.canvasAR.max, tuning.canvas_maxAR);
    if (minAR > maxAR) continue;
    
    const canvasARSamples = sampleCanvasARValues(minAR, maxAR, 6, randomize);
    const { heroAreaFraction } = template;
    
    for (const targetCanvasAR of canvasARSamples) {
      const contentPerHero = Math.ceil(contentPhotos.length / 2) + 1;
      const maxFrac = effectiveAreaFractionMax(heroAreaFraction, targetCanvasAR, contentPerHero);
      const areaSamples = sampleAreaFractions(heroAreaFraction.min, maxFrac, 3);
      
      for (const areaFrac of areaSamples) {
        const topology = getTemplateTopology(
          template.id, hero1.aspectRatio, areaFrac, targetCanvasAR, normalizedGap, hero2.aspectRatio
        );
        if (!topology || !topology.heroCell2) continue;
        
        const { heroCell: tH1, heroCell2: tH2 } = topology;
        const wH1 = tH1.width, hH1 = tH1.height;
        const wH2 = tH2.width, hH2 = tH2.height;
        
        const [r0Count, r1Count, r2Count] = deriveRegionCountsThreeWay(
          hero1.aspectRatio, hero2.aspectRatio, targetCanvasAR, areaFrac, ordered.length
        );
        
        const configKey = `diag-${r0Count}-${r1Count}-${areaFrac.toFixed(3)}-${targetCanvasAR.toFixed(3)}`;
        if (triedConfigs.has(configKey)) continue;
        triedConfigs.add(configKey);
        
        const r0Photos = ordered.slice(0, r0Count);
        const r1Photos = ordered.slice(r0Count, r0Count + r1Count);
        const r2Photos = ordered.slice(r0Count + r1Count);
        
        const r0MeanAR = r0Photos.length > 0 ? mean(r0Photos.map(p => p.aspectRatio)) : 1;
        const r1MeanAR = r1Photos.length > 0 ? mean(r1Photos.map(p => p.aspectRatio)) : 1;
        const r2MeanAR = r2Photos.length > 0 ? mean(r2Photos.map(p => p.aspectRatio)) : 1;
        
        // Region 0: beside Hero 1
        const r0TargetRows = r0Count > 0
          ? deriveTargetRowCount(r0Count, r0MeanAR, Math.max(0.01, topology.regions[0].softDimension), hH1)
          : 0;
        let region0: PackableRegion = {
          constraint: 'height', targetDimension: hH1,
          targetSoftDimension: topology.regions[0].softDimension > 0.01 ? topology.regions[0].softDimension : undefined,
          photos: r0Photos, targetRowCount: r0TargetRows,
          offset: topology.regions[0].offset, result: null,
        };
        region0 = packRegion(region0, normalizedGap, tuning, randomize);
        if (r0Count > 0 && !region0.result) continue;
        
        const besideWidth0 = region0.result?.width ?? 0;
        const heroRow1Width = wH1 + (r0Count > 0 ? normalizedGap + besideWidth0 : 0);
        
        // Region 1: middle band
        const r1TargetRows = r1Count > 0
          ? deriveTargetRowCount(r1Count, r1MeanAR, heroRow1Width, heroRow1Width / r1MeanAR)
          : 0;
        let region1: PackableRegion = {
          constraint: 'width', targetDimension: heroRow1Width,
          photos: r1Photos, targetRowCount: r1TargetRows,
          offset: topology.regions[1].offset, result: null,
        };
        
        // Region 2: beside Hero 2
        const r2TargetBesideWidth = topology.regions[2].softDimension;
        const r2TargetRows = r2Count > 0
          ? deriveTargetRowCount(r2Count, r2MeanAR, Math.max(0.01, r2TargetBesideWidth), hH2)
          : 0;
        let region2: PackableRegion = {
          constraint: 'height', targetDimension: hH2,
          targetSoftDimension: r2TargetBesideWidth > 0.01 ? r2TargetBesideWidth : undefined,
          photos: r2Photos, targetRowCount: r2TargetRows,
          offset: topology.regions[2].offset, result: null,
        };
        region2 = packRegion(region2, normalizedGap, tuning, randomize);
        if (r2Count > 0 && !region2.result) continue;
        
        // --- Uniform row scaling ---
        const besideWidth2 = region2.result?.width ?? 0;
        const heroRow2NaturalWidth = wH2 + (r2Count > 0 ? normalizedGap + besideWidth2 : 0);
        const canonicalRowWidth = Math.max(heroRow1Width, heroRow2NaturalWidth);
        
        const scaleRow1 = heroRow1Width > 0 ? canonicalRowWidth / heroRow1Width : 1;
        const scaleRow2 = heroRow2NaturalWidth > 0 ? canonicalRowWidth / heroRow2NaturalWidth : 1;
        
        if (scaleRow1 > 1.30 || scaleRow2 > 1.30) continue;
        
        const scaledHH1 = hH1 * scaleRow1;
        const scaledWH1 = wH1 * scaleRow1;
        if (scaleRow1 > 1.001 && region0.result) {
          region0 = {
            ...region0,
            offset: { x: normalizedGap + scaledWH1 + normalizedGap, y: normalizedGap },
            result: {
              ...region0.result,
              cells: region0.result.cells.map(c => ({
                ...c,
                x: c.x * scaleRow1, y: c.y * scaleRow1,
                width: c.width * scaleRow1, height: c.height * scaleRow1,
              })),
              width: region0.result.width * scaleRow1,
              height: region0.result.height * scaleRow1,
              rowCount: region0.result.rowCount,
            },
          };
        }
        
        const scaledHH2 = hH2 * scaleRow2;
        const scaledWH2 = wH2 * scaleRow2;
        if (scaleRow2 > 1.001 && region2.result) {
          region2 = {
            ...region2,
            result: {
              ...region2.result,
              cells: region2.result.cells.map(c => ({
                ...c,
                x: c.x * scaleRow2, y: c.y * scaleRow2,
                width: c.width * scaleRow2, height: c.height * scaleRow2,
              })),
              width: region2.result.width * scaleRow2,
              height: region2.result.height * scaleRow2,
              rowCount: region2.result.rowCount,
            },
          };
        }
        
        // Region 1 (middle band) packs at canonicalRowWidth
        region1 = {
          ...region1,
          targetDimension: canonicalRowWidth,
          offset: { x: normalizedGap, y: normalizedGap + scaledHH1 + normalizedGap },
        };
        region1 = packRegion(region1, normalizedGap, tuning, randomize);
        if (r1Count > 0 && !region1.result) continue;
        
        const middleHeight = region1.result?.height ?? 0;
        
        const r2OffsetY = tH1.y + scaledHH1 + normalizedGap + middleHeight + (r1Count > 0 ? normalizedGap : 0);
        region2 = { ...region2, offset: { x: normalizedGap, y: r2OffsetY } };
        
        const canvasWidth = canonicalRowWidth + 2 * normalizedGap;
        const totalHeight = scaledHH1
          + (r1Count > 0 ? normalizedGap + middleHeight : 0)
          + normalizedGap + scaledHH2;
        const canvasHeight = totalHeight + 2 * normalizedGap;
        const canvasAR = canvasWidth / canvasHeight;
        
        const hero2X = normalizedGap + canonicalRowWidth - scaledWH2;
        const hero2Y = r2OffsetY;
        
        const hero1Area = scaledWH1 * scaledHH1;
        const hero2Area = scaledWH2 * scaledHH2;
        const canvasArea = canvasWidth * canvasHeight;
        const combinedCoverage = (hero1Area + hero2Area) / canvasArea;
        
        // Soft penalty for canvas AR outside bounds (instead of hard reject)
        let arBoundsPenalty = 0;
        if (canvasAR < tuning.canvas_minAR) {
          const overshoot = (tuning.canvas_minAR - canvasAR) / tuning.canvas_minAR;
          arBoundsPenalty = Math.min(0.5, overshoot * 2.0);
        } else if (canvasAR > tuning.canvas_maxAR) {
          const overshoot = (canvasAR - tuning.canvas_maxAR) / tuning.canvas_maxAR;
          arBoundsPenalty = Math.min(0.5, overshoot * 2.0);
        }
        
        const arDeviation = Math.abs(canvasAR - targetCanvasAR) / targetCanvasAR;
        // Soft penalties (not hard rejects) for dual-hero
        const arPenalty = arDeviation > AR_COHERENCE_THRESHOLD
          ? Math.min(0.3, (arDeviation - AR_COHERENCE_THRESHOLD) * 1.2)
          : 0;
        
        const coveragePenalty = combinedCoverage > HERO_COVERAGE_CEILING
          ? Math.min(0.3, (combinedCoverage - HERO_COVERAGE_CEILING) * 1.5)
          : 0;
        
        // Prominence: each hero checked individually (soft penalty)
        const allContentAreas: number[] = [];
        for (const r of [region0, region1, region2]) {
          if (r.result) {
            for (const cell of r.result.cells) allContentAreas.push(cell.width * cell.height);
          }
        }
        const maxContentArea = Math.max(...allContentAreas, 0);
        const prom1 = maxContentArea > 0 ? hero1Area / maxContentArea : Infinity;
        const prom2 = maxContentArea > 0 ? hero2Area / maxContentArea : Infinity;
        const minProm = Math.min(prom1, prom2);
        const contentPerHero = Math.ceil(contentPhotos.length / 2) + 1;
        const countScaleDual = photoCountScale(contentPerHero);
        const effectiveMinPromDual = tuning.hero_minProminence * countScaleDual;
        const prominencePenalty = minProm < effectiveMinPromDual
          ? Math.min(0.3, (effectiveMinPromDual - minProm) * 1.0)
          : 0;
        
        const contentCV = coefficientOfVariation(allContentAreas);
        const CV_THRESHOLD = 0.35;
        const contentUniformityPenalty = contentCV > CV_THRESHOLD
          ? Math.min(0.25, (contentCV - CV_THRESHOLD) * 0.5)
          : 0;
        
        // Score with unified scoreCellBalance
        const allAreas = [hero1Area, hero2Area, ...allContentAreas];
        const balanceResult = scoreCellBalance(allAreas, allAreas.length, tuning);
        const presenceScore = (r0Count > 0 ? 0.33 : 0) + (r1Count > 0 ? 0.34 : 0) + (r2Count > 0 ? 0.33 : 0);
        const rawScore = (balanceResult.score * 0.7) + (presenceScore * 0.3);
        const score = Math.max(0.05, rawScore - arPenalty - coveragePenalty - prominencePenalty - contentUniformityPenalty - arBoundsPenalty);
        
        const corner = randomize
          ? diagonalCorners[Math.floor(Math.random() * 2)]
          : 'top-left';
        
        const heroCell1: NormalizedCell = {
          photoId: hero1.id, x: tH1.x, y: tH1.y, width: scaledWH1, height: scaledHH1,
        };
        const heroCell2: NormalizedCell = {
          photoId: hero2.id, x: hero2X, y: hero2Y, width: scaledWH2, height: scaledHH2,
        };
        
        const regions = [region0, region1, region2];
        
        candidates.push({
          regions,
          heroCell: heroCell1,
          heroCell2: heroCell2,
          canvasWidth, canvasHeight,
          prominenceRatio: Math.min(prom1, prom2),
          score, corner,
          meta: {
            template: 'diagonal-corners',
            targetCanvasAR, areaFrac, arDeviation,
            heroCoverage: combinedCoverage,
            regionSizes: [r0Count, r1Count, r2Count],
            regionTargetRows: [r0TargetRows, r1TargetRows, r2TargetRows],
            regionActualRows: regions.map(r => r.result?.rowCount ?? 0),
            besideWidth: besideWidth0,
            belowHeight: middleHeight,
            candidateCount: 0,
            penalties: { ar: arPenalty, coverage: coveragePenalty, prominence: prominencePenalty },
          },
        });
      }
    }
  }
  
  for (const c of candidates) c.meta.candidateCount = candidates.length;
  
  devLogger.log('layout', `V4 dual-hero generated ${candidates.length} candidates`, {
    hero1AR: hero1.aspectRatio.toFixed(2),
    hero2AR: hero2.aspectRatio.toFixed(2),
    contentCount: contentPhotos.length,
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
  
  const heroPos = transform(heroCell.x, heroCell.y, heroCell.width, heroCell.height);
  cells.push({
    photoId: heroCell.photoId,
    x: Math.round(heroPos.x * VIRTUAL_CANVAS_BASE),
    y: Math.round(heroPos.y * VIRTUAL_CANVAS_BASE),
    width: Math.round(heroCell.width * VIRTUAL_CANVAS_BASE),
    height: Math.round(heroCell.height * VIRTUAL_CANVAS_BASE),
  });
  
  if (candidate.heroCell2) {
    const hero2 = candidate.heroCell2;
    const hero2Pos = transform(hero2.x, hero2.y, hero2.width, hero2.height);
    cells.push({
      photoId: hero2.photoId,
      x: Math.round(hero2Pos.x * VIRTUAL_CANVAS_BASE),
      y: Math.round(hero2Pos.y * VIRTUAL_CANVAS_BASE),
      width: Math.round(hero2.width * VIRTUAL_CANVAS_BASE),
      height: Math.round(hero2.height * VIRTUAL_CANVAS_BASE),
    });
  }
  
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
// Main Orchestrator
// ============================================================================

/**
 * Generate a layout from photo dimensions.
 * This is the single source of truth for the V4 algorithm.
 * 
 * Always returns a layout (never null). If no valid candidates are found,
 * returns a stacked-strip fallback with a softRejection indicator.
 */
export function generateLayoutFromDimensions(
  dimensions: PhotoDimension[],
  normalizedGap: number,
  tuningOverrides: Partial<V3Tuning>,
  randomize: boolean
): EngineResult {
  if (dimensions.length < 2) {
    return { 
      layout: { width: 1000, height: 1000, cells: [] }, 
      softRejection: { reason: 'insufficient_photos', details: { photoCount: dimensions.length } },
    };
  }
  
  const tuning: V3Tuning = { ...DEFAULT_V3_TUNING, ...tuningOverrides };
  
  devLogger.log('layout', 'Starting V4 layout generation', {
    photoCount: dimensions.length,
    randomize,
    tuning: {
      canvas_minAR: tuning.canvas_minAR,
      canvas_maxAR: tuning.canvas_maxAR,
      hero_minProminence: tuning.hero_minProminence,
    },
  });
  
  // Detect heroes (weight > 1), sorted by weight descending
  const heroes = dimensions.filter(d => d.weight > 1).sort((a, b) => b.weight - a.weight);
  const heroPhoto = heroes.length > 0 ? heroes[0] : dimensions.reduce((h, d) => d.weight > h.weight ? d : h);
  
  const isDualHero = heroes.length >= 2 && dimensions.length >= 8;
  const hero2Photo = isDualHero ? heroes[1] : null;
  const contentPhotos = dimensions.filter(d => d.id !== heroPhoto.id && d.id !== hero2Photo?.id);
  
  devLogger.log('layout', 'Photo analysis', {
    heroId: heroPhoto.id,
    heroAR: heroPhoto.aspectRatio.toFixed(2),
    hero2Id: hero2Photo?.id ?? null,
    hero2AR: hero2Photo?.aspectRatio.toFixed(2) ?? null,
    contentCount: contentPhotos.length,
    avgContentAR: (contentPhotos.reduce((s, d) => s + d.aspectRatio, 0) / contentPhotos.length).toFixed(2),
  });
  
  let candidates: LayoutCandidate[];
  let layoutPath: 'single-hero' | 'dual-hero' | 'dual-hero-fallback-single' = 'single-hero';
  
  if (isDualHero && hero2Photo) {
    layoutPath = 'dual-hero';
    candidates = generateDualHeroCandidates(heroPhoto, hero2Photo, contentPhotos, normalizedGap, tuning, randomize);
    
    // Fall back to single hero if dual candidates are absent or all near floor score
    const bestDualScore = candidates.length > 0
      ? Math.max(...candidates.map(c => c.score))
      : 0;
    if (bestDualScore <= 0.10) {
      const allContent = dimensions.filter(d => d.id !== heroPhoto.id);
      const singleCandidates = generateCandidates(heroPhoto, allContent, normalizedGap, tuning, randomize);
      if (singleCandidates.length > 0) {
        const bestSingle = Math.max(...singleCandidates.map(c => c.score));
        if (bestSingle > bestDualScore) {
          candidates = singleCandidates;
          layoutPath = 'dual-hero-fallback-single';
          devLogger.log('layout', 'Single-hero beats dual-hero', {
            bestDual: bestDualScore.toFixed(3),
            bestSingle: bestSingle.toFixed(3),
          });
        }
      }
    }
  } else {
    candidates = generateCandidates(heroPhoto, contentPhotos, normalizedGap, tuning, randomize);
  }
  
  // No-null safety net: stacked-strip fallback
  if (candidates.length === 0) {
    devLogger.warn('layout', 'V4: No valid candidates found, using stacked-strip fallback');
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
  
  const selected = selectCandidate(candidates, randomize)!;
  
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
  
  const layoutMeta: Record<string, unknown> = {
    template: selected.meta.template,
    targetCanvasAR: selected.meta.targetCanvasAR,
    actualCanvasAR: +(selected.canvasWidth / selected.canvasHeight).toFixed(3),
    arDeviation: selected.meta.arDeviation,
    areaFrac: selected.meta.areaFrac,
    heroCoverage: selected.meta.heroCoverage,
    heroAR: heroPhoto.aspectRatio,
    prominenceRatio: selected.prominenceRatio,
    score: selected.score,
    corner: selected.corner,
    candidateCount: selected.meta.candidateCount,
    regionSizes: selected.meta.regionSizes,
    regionTargetRows: selected.meta.regionTargetRows,
    regionActualRows: selected.meta.regionActualRows,
    besideWidth: selected.meta.besideWidth,
    belowHeight: selected.meta.belowHeight,
    path: layoutPath,
    photoCount: dimensions.length,
    contentCount: contentPhotos.length,
    heroCount: hero2Photo ? 2 : 1,
    ...(hero2Photo ? { hero2AR: hero2Photo.aspectRatio } : {}),
    photoCountScaleFactor: photoCountScale(dimensions.length),
  };
  
  return {
    layout: convertToLayout(selected, normalizedGap),
    layoutMeta,
  };
}
