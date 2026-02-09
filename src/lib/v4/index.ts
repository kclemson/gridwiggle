/**
 * V4 Layout Orchestrator
 * 
 * Simplified orchestrator that calls proven math functions.
 * No arbitrary caps, simple constraints, maximum variety.
 */

import { PhotoItem, CollageSettings, CollageLayout, CollageCell } from '@/types/collage';
import { getDisplayCrop } from '@/lib/cropUtils';
import { PhotoDimension, NormalizedCell, V3Tuning, DEFAULT_V3_TUNING } from '@/lib/v3/types';
import { packToFillHeight, packToFillWidth } from '@/lib/v3/normalized-pack';
import { distributeByARBudget, shuffleArray } from '@/lib/v3/utils';
import { devLogger } from '@/lib/devLogger';

// Virtual canvas base unit for final pixel values
const VIRTUAL_CANVAS_BASE = 1000;

// ============================================================================
// Candidate Interface
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

/**
 * Score a set of cell areas for visual balance.
 * 
 * This is a GENERAL-PURPOSE function that works on ANY set of cells.
 * It has no knowledge of hero/beside/below - just evaluates the geometry.
 * 
 * Two components:
 * 1. COHERENCE (F-ratio): Do cells cluster into distinct size tiers?
 * 2. SPREAD PENALTY: Is the largest/smallest ratio reasonable?
 * 
 * @param areas - All cell areas to evaluate
 * @param photoCount - Total photos for adaptive spread limit
 * @param tuning - V3Tuning for baseSpreadLimit
 * @param tierCount - Number of tiers to detect (default 3)
 */
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
  
  // === Component 1: Tier Coherence (F-ratio) ===
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
  
  // === Component 2: Spread Penalty ===
  // Adaptive limit: scales with sqrt(photoCount / 10)
  // 10 photos → 15:1, 40 photos → 30:1, 90 photos → 45:1
  const adaptiveLimit = tuning.tier_baseSpreadLimit * Math.sqrt(photoCount / 10);
  const spreadRatio = smallest > 0 ? largest / smallest : Infinity;
  
  // Penalty ramps up when spreadRatio exceeds adaptiveLimit
  // At 2x the limit, penalty = 0.3 (significant but not fatal)
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
// Candidate Generation
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
  
  // Order content: shuffle for variety OR sort for determinism
  const ordered = randomize 
    ? shuffleArray(contentPhotos)
    : [...contentPhotos].sort((a, b) => a.aspectRatio - b.aspectRatio);
  
  // Corners for variety
  const corners: Array<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'> = 
    ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  
  // Key change: NO CAP on besideCount
  for (let besideCount = 0; besideCount <= ordered.length; besideCount++) {
    const beside = ordered.slice(0, besideCount);
    const below = ordered.slice(besideCount);
    
    // Simple row count range for beside: 1 to ceil(besideCount/2)
    const maxBesideRows = Math.max(1, Math.ceil(besideCount / 2));
    const minBesideRows = besideCount > 0 ? 1 : 0;
    
    for (let besideRowCount = minBesideRows; besideRowCount <= maxBesideRows; besideRowCount++) {
      // Pack beside (if any)
      const besideResult = besideCount > 0 
        ? packToFillHeight(beside, 1.0, normalizedGap, besideRowCount, tuning, randomize)
        : { cells: [], width: 0, height: 1.0, rowCount: 0 };
      
      if (besideCount > 0 && besideResult.cells.length === 0) continue;
      
      // Hero row width
      const heroRowWidth = heroAR + (besideCount > 0 ? normalizedGap + besideResult.width : 0);
      
      // Simple row count range for below
      const maxBelowRows = below.length > 0 
        ? Math.max(1, Math.ceil(below.length / 2))
        : 0;
      
      // Iterate over below row counts for variety
      const belowRowCounts = below.length > 0
        ? (randomize 
            ? [1 + Math.floor(Math.random() * maxBelowRows)]
            : Array.from({ length: maxBelowRows }, (_, i) => i + 1))
        : [0];
      
      for (const belowRowCount of belowRowCounts) {
        // Pack below
        const belowResult = below.length > 0 && belowRowCount > 0
          ? packToFillWidth(below, heroRowWidth, normalizedGap, belowRowCount, tuning, randomize)
          : { cells: [], width: heroRowWidth, height: 0, rowCount: 0 };
        
        if (below.length > 0 && belowResult.cells.length === 0) continue;
        
        // Canvas dimensions (with border gap)
        const totalHeight = 1.0 + (below.length > 0 ? normalizedGap + belowResult.height : 0);
        const canvasWidth = heroRowWidth + 2 * normalizedGap;
        const canvasHeight = totalHeight + 2 * normalizedGap;
        const canvasAR = canvasWidth / canvasHeight;
        
        // HARD BOUNDS: Canvas AR
        if (canvasAR < tuning.canvas_minAR || canvasAR > tuning.canvas_maxAR) {
          continue;
        }
        
        // Prominence check (hero vs largest beside)
        const besideAreas = besideResult.cells.map(c => c.width * c.height);
        const heroArea = heroAR * 1.0;
        const maxBesideArea = Math.max(...besideAreas, 0);
        const prominenceRatio = maxBesideArea > 0 ? heroArea / maxBesideArea : Infinity;
        
        if (prominenceRatio < tuning.hero_minProminence) {
          continue;
        }
        
        // Score using F-ratio + spread constraint + presence bonus
        // Include hero in balance scoring - this is the key fix!
        const allAreas = [heroArea, ...besideAreas, ...belowResult.cells.map(c => c.width * c.height)];
        const balanceResult = scoreCellBalance(allAreas, allAreas.length, tuning);
        const presenceScore = besideCount > 0 ? 1.0 : 0.4;
        const score = (balanceResult.score * 0.7) + (presenceScore * 0.3);
        
        // Pick corner (random for variety, top-left for determinism)
        const corner = randomize 
          ? corners[Math.floor(Math.random() * 4)]
          : 'top-left';
        
        // Create hero cell in normalized space (positioned at corner)
        const heroCell: NormalizedCell = {
          photoId: heroPhoto.id,
          x: normalizedGap,  // Will be transformed based on corner
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
  
  devLogger.log('layout', `V4 generated ${candidates.length} candidates`, {
    photoCount: contentPhotos.length + 1,
    heroAR: heroAR.toFixed(2),
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
// Convert to Layout
// ============================================================================

function convertToLayout(candidate: LayoutCandidate, normalizedGap: number): CollageLayout {
  const cells: CollageCell[] = [];
  const { corner, canvasWidth, canvasHeight, heroCell, besideCells, belowCells } = candidate;
  
  // Helper to transform coordinates based on corner
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
  
  // Add beside cells (offset from hero)
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
  
  // Add below cells (offset from hero row)
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
// Main API
// ============================================================================

export interface GenerateLayoutV4Options {
  photoWeights?: Record<string, number>;
  tuning?: Partial<V3Tuning>;
  randomize?: boolean;
}

/**
 * Generate a collage layout using the V4 algorithm.
 * 
 * V4 is a simplified orchestrator that:
 * - Explores ALL besideCount values (no cap)
 * - Uses simple row count ranges
 * - Enforces only canvas AR + prominence
 * - Scores with F-ratio
 * 
 * @returns CollageLayout or null if generation fails
 */
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
  
  // Map slider (0-100) to normalized gap (0 to 0.04)
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
  
  // Extract dimensions with weights
  const dimensions = extractPhotoDimensions(photos, photoWeights);
  
  // Find hero (highest weight)
  const heroPhoto = dimensions.reduce((h, d) => d.weight > h.weight ? d : h);
  const contentPhotos = dimensions.filter(d => d.id !== heroPhoto.id);
  
  devLogger.log('layout', 'Photo analysis', {
    heroId: heroPhoto.id,
    heroAR: heroPhoto.aspectRatio.toFixed(2),
    contentCount: contentPhotos.length,
    avgContentAR: (contentPhotos.reduce((s, d) => s + d.aspectRatio, 0) / contentPhotos.length).toFixed(2),
  });
  
  // Generate all valid candidates
  const candidates = generateCandidates(heroPhoto, contentPhotos, normalizedGap, tuning, randomize);
  
  if (candidates.length === 0) {
    devLogger.warn('layout', 'V4: No valid candidates found');
    return null;
  }
  
  // Select best/random candidate
  const selected = selectCandidate(candidates, randomize);
  
  if (!selected) {
    return null;
  }
  
  devLogger.log('layout', 'V4 selected candidate', {
    besideCount: selected.besideCount,
    belowCount: selected.belowCells.length,
    corner: selected.corner,
    canvasAR: (selected.canvasWidth / selected.canvasHeight).toFixed(2),
    score: selected.score.toFixed(3),
  });
  
  return convertToLayout(selected, normalizedGap);
}
