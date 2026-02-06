import { PhotoItem, CollageLayout, CollageCell, CollageSettings, LayoutTuning } from '@/types/collage';
import { getDisplayCrop } from '@/lib/cropUtils';
import { generateHeroLayout } from '@/lib/heroLayout';
import { DEFAULT_TUNING } from '@/types/collage';
import {
  PhotoDimension,
  shuffleArray,
  getPhotoDimensions,
  coefficientOfVariation,
} from '@/lib/layoutMath';

// ============================================================================
// Configuration Scoring Types (Unified for all layout types)
// ============================================================================

/**
 * Score breakdown for a layout configuration.
 * Used for both content-only and hero layouts.
 */
export interface ConfigurationScore {
  directionPenalty: number;  // Shape compliance (10.0 weight)
  areaCV: number;            // Cell size uniformity
  heightCV: number;          // Row height uniformity
  rowBalancePenalty: number; // Sparse/overfull rows
  scalePenalty: number;      // For hero: deviation from 1.0
  totalScore: number;        // Combined (lower = better)
}

/**
 * Options for scoring a layout configuration.
 */
export interface ScoreConfigurationOptions {
  shape: CollageSettings['shape'];
  hasHero: boolean;
  scaleFactor?: number;      // Only for hero layouts
  minPhotosPerRow?: number;
}

// ============================================================================
// Dynamic minPhotosPerRow Range
// ============================================================================

/**
 * Calculate the valid minPhotosPerRow range based on photo count and orientation.
 * 
 * Uses √n as the anchor point:
 * - minPhotosPerRow ≈ √n produces roughly equal rows and columns (square-ish)
 * - Below √n → more rows → portrait
 * - Above √n → fewer rows → landscape
 * 
 * Returns floats for gradient scoring (the math handles floats gracefully).
 */
function getMinPhotosPerRowRange(
  n: number,
  shape: CollageSettings['shape']
): [number, number] {
  const sqrtN = Math.sqrt(n);
  
  switch (shape) {
    case 'portrait':
      // Below √n = more rows = tall
      // Lower upper bound to reduce sparse penalty for 2-3 photo rows
      return [2, sqrtN * 0.7];
      
    case 'square':
      // Around √n = balanced
      return [Math.max(2, sqrtN - 1), sqrtN + 1];
      
    case 'landscape':
      // Above √n = fewer rows = wide
      // Cap at sqrtN * 1.5 to avoid overly dense rows
      return [sqrtN, sqrtN * 1.5];
      
    case 'auto':
    default:
      // Full range for maximum variety
      return [2, Math.max(sqrtN + 2, n / 3)];
  }
}

/**
 * Calculate maximum photos per row based on photo count and shape.
 * This is an ACTUAL CONSTRAINT, not just a scoring hint.
 * 
 * Uses √n as anchor:
 * - Portrait: narrow rows → many rows → tall
 * - Landscape: wide rows → few rows → wide
 */
function getMaxPhotosPerRow(
  n: number,
  shape: CollageSettings['shape']
): number {
  const sqrtN = Math.sqrt(n);
  
  switch (shape) {
    case 'portrait':
      // Narrow rows for tall layouts
      return Math.max(4, Math.floor(sqrtN * 0.7));
      
    case 'square':
      // Balanced
      return Math.max(5, Math.round(sqrtN));
      
    case 'landscape':
      // Wide rows for landscape layouts
      return Math.max(8, Math.ceil(sqrtN * 1.3));
      
    case 'auto':
    default:
      // Balanced default
      return Math.max(6, Math.round(sqrtN));
  }
}

/**
 * Get target aspect ratio bounds for each shape.
 * Used to clamp row count search range via R = √(S / A) formula.
 */
export function getAspectBounds(
  shape: CollageSettings['shape']
): [number, number] {
  switch (shape) {
    case 'portrait':
      return [0.5, 0.8];    // Tall: 1:2 to 4:5
    case 'square':
      return [0.95, 1.05];  // Strict 1:1 (±5%)
    case 'landscape':
      return [1.25, 2.0];   // Wide: 5:4 to 2:1
    case 'auto':
    default:
      return [0.67, 1.5];   // Balanced variety (2:3 to 3:2)
  }
}

/**
 * Check if a canvas aspect ratio is acceptable for a given shape.
 * Used for hard rejection of hero layout candidates.
 * 
 * Hero layouts have structural constraints (hero spans 2-3 rows),
 * so we relax the strict bounds by a tolerance factor.
 * 
 * @param canvasAspect - The width/height ratio of the layout
 * @param shape - The user's shape preference
 * @param tolerance - Relaxation factor (default 0.2 = 20% beyond strict bounds)
 * @returns true if aspect is acceptable for the shape
 */
export function isAspectAcceptable(
  canvasAspect: number,
  shape: CollageSettings['shape'],
  tolerance: number = 0.2
): boolean {
  if (shape === 'auto') return true; // Auto accepts anything
  
  const [minAspect, maxAspect] = getAspectBounds(shape);
  // Relax bounds for hero layouts (they have structural constraints)
  const relaxedMin = minAspect * (1 - tolerance);
  const relaxedMax = maxAspect * (1 + tolerance);
  return canvasAspect >= relaxedMin && canvasAspect <= relaxedMax;
}

export interface RegionPackResult {
  /** Cells positioned within the region */
  cells: CollageCell[];
  
  /** The height the packing achieved */
  achievedHeight: number;
  
  /** The row partition used */
  partition: PhotoDimension[][];
  
  /** If targetHeight was provided: whether achieved is within tolerance */
  valid: boolean;
  
  /** Absolute difference from target height (0 if no target) */
  heightError: number;
}

export interface RegionPackOptions {
  /** Region width (required) */
  width: number;
  
  /** Gap between photos */
  gap: number;
  
  /** Target height to validate against (optional) */
  targetHeight?: number;
  
  /** Tolerance for height matching (default: 2px) */
  tolerance?: number;
  
  /** Offset for cell positions (default: 0, 0) */
  offsetX?: number;
  offsetY?: number;
  
  /** Shape preference for scoring (default: 'auto') */
  shape?: CollageSettings['shape'];
  
   /** Minimum photos per row for scoring (default: 2) */
   minPhotosPerRow?: number;
  
  /** 
   * Height budget constraint (soft ceiling for total packed height).
   * When provided, partitions exceeding this height incur a quadratic penalty.
   * Used by hero layouts to ensure content rows respect the overall target shape.
   */
  maxHeight?: number;
}

export interface LayoutOptions {
  /** Weight multiplier per photo ID (default: 1). Higher = larger in layout */
  photoWeights?: Record<string, number>;
  /** When true, shuffle photo order and pick from top-N layouts for variety */
  randomize?: boolean;
  /** Layout tuning parameters (for real-time experimentation) */
  tuning: LayoutTuning;
}

// ============================================================================
// Partition Types
// ============================================================================

interface PartitionScore {
  partition: PhotoDimension[][];
  areaCV: number;       // Coefficient of variation of cell areas (lower = more uniform)
  heightCV: number;     // CV of row heights
  directionPenalty: number;   // Penalty for wrong orientation direction based on shape
  totalScore: number;   // Combined weighted score (lower = better)
}

// ============================================================================
// Unified Configuration Scoring
// ============================================================================

/**
 * Calculate direction penalty based on shape preference.
 * This is the single source of truth for shape-based scoring.
 * Used by both content-only layouts (via scorePartition) and hero layouts.
 * 
 * @param resultAspect - The actual width/height ratio of the layout
 * @param shape - The user's shape preference
 * @returns Penalty value (0 = perfect, higher = worse)
 */
export function calculateDirectionPenalty(
  resultAspect: number,
  shape: CollageSettings['shape']
): number {
  if (shape === 'portrait' && resultAspect >= 1.0) {
    // User wants portrait but result is landscape/square
    return 10.0 * (resultAspect - 0.9);
  } else if (shape === 'landscape' && resultAspect <= 1.0) {
    // User wants landscape but result is portrait/square
    return 10.0 * (1.1 - resultAspect);
  } else if (shape === 'square') {
    // Penalize deviation from 1.0 aspect ratio
    return 10.0 * Math.abs(resultAspect - 1.0);
  }
  // shape === 'auto' --> no bias
  return 0;
}

/**
 * Calculate row-based metrics from layout cells.
 * Works for both content-only and hero layouts since it derives
 * row information from cell positions rather than partition arrays.
 */
function calculateRowMetrics(
  cells: CollageCell[],
  canvasWidth: number,
  minPhotosPerRow: number,
  shape: CollageSettings['shape']
): { areaCV: number; heightCV: number; rowBalancePenalty: number } {
  if (cells.length === 0) {
    return { areaCV: 0, heightCV: 0, rowBalancePenalty: 0 };
  }

  // Group cells by y-position to identify rows (with tolerance for rounding)
  const rowMap = new Map<number, CollageCell[]>();
  for (const cell of cells) {
    // Round to nearest 5px to group cells in the same visual row
    const key = Math.round(cell.y / 5) * 5;
    if (!rowMap.has(key)) rowMap.set(key, []);
    rowMap.get(key)!.push(cell);
  }
  
  const rows = Array.from(rowMap.values());
  
  // Calculate areas and heights
  const areas = cells.map(c => c.width * c.height);
  const heights = rows.map(row => Math.max(...row.map(c => c.height)));
  
  const areaCV = coefficientOfVariation(areas);
  const heightCV = coefficientOfVariation(heights);
  
  // Row balance penalty
  const rowSizes = rows.map(r => r.length);
  const minRowSize = Math.min(...rowSizes);
  const maxRowSize = Math.max(...rowSizes);
  
  const sparsePenalty = minRowSize < minPhotosPerRow 
    ? 5.0 * (minPhotosPerRow - minRowSize) 
    : 0;
  
  const maxPhotosPerRow = getMaxPhotosPerRow(cells.length, shape);
  const overMaxPenalty = maxRowSize > maxPhotosPerRow
    ? 3.0 * (maxRowSize - maxPhotosPerRow)
    : 0;
  
  return { areaCV, heightCV, rowBalancePenalty: sparsePenalty + overMaxPenalty };
}

/**
 * Score a layout configuration.
 * 
 * This is the UNIFIED scoring function used by both content-only and hero layouts.
 * It provides a consistent way to evaluate how well a layout meets constraints.
 * 
 * @param layout - The layout to score
 * @param options - Scoring options (shape, hasHero, scaleFactor)
 * @returns Detailed score breakdown with totalScore (lower = better)
 */
export function scoreConfiguration(
  layout: CollageLayout,
  options: ScoreConfigurationOptions
): ConfigurationScore {
  const { shape, hasHero, scaleFactor = 1.0, minPhotosPerRow = 2 } = options;
  
  const resultAspect = layout.width / layout.height;
  const directionPenalty = calculateDirectionPenalty(resultAspect, shape);
  
  // Scale penalty for hero layouts (deviation from 1.0)
  const scalePenalty = hasHero 
    ? 2.0 * Math.abs(scaleFactor - 1.0) 
    : 0;
  
  // Calculate row-based metrics from layout cells
  const { areaCV, heightCV, rowBalancePenalty } = calculateRowMetrics(
    layout.cells, 
    layout.width,
    minPhotosPerRow,
    shape
  );
  
  const totalScore = 
    directionPenalty +       // Shape enforcement (primary)
    scalePenalty +           // Hero scale deviation
    areaCV * 1.0 +           // Uniform cell sizes
    heightCV * 0.2 +         // Uniform row heights
    rowBalancePenalty;       // Sparse/overfull row penalties
  
  return { directionPenalty, areaCV, heightCV, rowBalancePenalty, scalePenalty, totalScore };
}

// ============================================================================
// Row Aspect & Area Calculations
// ============================================================================

/** Sum of weighted aspect ratios for a row */
function getRowAspectSum(dims: PhotoDimension[]): number {
  return dims.reduce((sum, d) => sum + d.aspectRatio * d.weight, 0);
}

/** Calculate cell areas for a partition at a reference width */
function calculateCellAreas(partition: PhotoDimension[][], baseWidth: number): number[] {
  const areas: number[] = [];
  
  for (const row of partition) {
    const aspectSum = getRowAspectSum(row);
    const rowHeight = baseWidth / aspectSum;
    
    for (const photo of row) {
      const cellWidth = (photo.aspectRatio * photo.weight / aspectSum) * baseWidth;
      areas.push(cellWidth * rowHeight);
    }
  }
  
  return areas;
}

/** Calculate row heights for a partition */
function calculateRowHeights(partition: PhotoDimension[][], baseWidth: number): number[] {
  return partition.map(row => {
    const aspectSum = getRowAspectSum(row);
    return baseWidth / aspectSum;
  });
}

// ============================================================================
// Partition Scoring
// ============================================================================

function scorePartition(
  partition: PhotoDimension[][],
  shape: CollageSettings['shape'],
  baseWidth: number = 1200,
  minPhotosPerRow: number = 2
): PartitionScore {
  if (partition.length === 0) {
    return { partition, areaCV: Infinity, heightCV: Infinity, directionPenalty: Infinity, totalScore: Infinity };
  }
  
  // Calculate metrics
  const areas = calculateCellAreas(partition, baseWidth);
  const heights = calculateRowHeights(partition, baseWidth);
  const totalHeight = heights.reduce((a, b) => a + b, 0);
  const resultAspect = baseWidth / totalHeight;
  
  const areaCV = coefficientOfVariation(areas);
  const heightCV = coefficientOfVariation(heights);
  
  // Use shared direction penalty calculation
  const directionPenalty = calculateDirectionPenalty(resultAspect, shape);
  
  // Penalize rows with very few or very many photos
  const rowSizes = partition.map(r => r.length);
  const minRowSize = Math.min(...rowSizes);
  const maxRowSize = Math.max(...rowSizes);
  
  // Enhanced: penalize rows below minPhotosPerRow threshold
  const sparsePenalty = minRowSize < minPhotosPerRow 
    ? 5.0 * (minPhotosPerRow - minRowSize) 
    : 0;
  
  // Calculate shape-aware max for penalty
  const totalPhotos = partition.flat().length;
  const maxPhotosPerRow = getMaxPhotosPerRow(totalPhotos, shape);
  
  // Strong penalty for exceeding shape-based max (was weak 0.1 for >6)
  const overMaxPenalty = maxRowSize > maxPhotosPerRow
    ? 3.0 * (maxRowSize - maxPhotosPerRow)
    : 0;
  
  const rowBalancePenalty = sparsePenalty + overMaxPenalty;
  
  // Combined score (lower = better)
  // Shape enforcement is primary, uniformity is secondary
  const totalScore = 
    directionPenalty +       // Shape enforcement (based on user selection)
    areaCV * 1.0 +           // PRIMARY: uniform cell sizes
    heightCV * 0.2 +         // Light: uniform row heights
    rowBalancePenalty;       // Penalties for extreme rows
  
  return { partition, areaCV, heightCV, directionPenalty, totalScore };
}

// ============================================================================
// Partition Generation
// ============================================================================

/** Generate all partitions of arr into exactly numRows non-empty rows */
function* generatePartitions(
  arr: PhotoDimension[],
  numRows: number
): Generator<PhotoDimension[][]> {
  if (numRows === 1) {
    yield [arr];
    return;
  }
  
  if (arr.length < numRows) return; // Not enough photos
  
  // Try each possible first row length
  for (let firstRowLen = 1; firstRowLen <= arr.length - (numRows - 1); firstRowLen++) {
    const firstRow = arr.slice(0, firstRowLen);
    const remaining = arr.slice(firstRowLen);
    
    for (const restPartition of generatePartitions(remaining, numRows - 1)) {
      yield [firstRow, ...restPartition];
    }
  }
}

/** Count partitions to avoid expensive enumeration for large sets */
function countPartitions(n: number, k: number): number {
  // C(n-1, k-1) = ways to place k-1 dividers in n-1 gaps
  if (k > n || k <= 0) return 0;
  if (k === 1) return 1;
  if (k === n) return 1;
  
  // Compute binomial coefficient C(n-1, k-1)
  let result = 1;
  for (let i = 0; i < k - 1; i++) {
    result = result * (n - 1 - i) / (i + 1);
  }
  return Math.round(result);
}

// ============================================================================
// Best Row Split Selection
// ============================================================================

function findBestRowSplit(
  dims: PhotoDimension[],
  shape: CollageSettings['shape'],
  randomize: boolean = false,
  minPhotosPerRow: number = 2,
  width: number = 1200,
  gap: number = 4,
  maxHeight?: number
): PhotoDimension[][] {
  // Shuffle photo order when randomizing for variety
  const workingDims = randomize ? shuffleArray(dims) : dims;
  const n = workingDims.length;
  
  if (n <= 1) return [workingDims];
  
  // === Mathematical aspect ratio guardrail ===
  // Calculate sum of aspect ratios
  const S = workingDims.reduce((sum, d) => sum + d.aspectRatio, 0);
  
  // Get target aspect bounds for this shape
  const [minAspect, maxAspect] = getAspectBounds(shape);
  
  // Derive row bounds from R = √(S / A)
  const minRowsFromAspect = Math.ceil(Math.sqrt(S / maxAspect));
  const maxRowsFromAspect = Math.floor(Math.sqrt(S / minAspect));
  
  // === Existing density-based constraints ===
  const maxPhotosPerRow = getMaxPhotosPerRow(n, shape);
  const minRowsFromMax = Math.ceil(n / maxPhotosPerRow);
  const minRowsFromDensity = Math.max(1, Math.floor(n / 8));
  
  // Combine all constraints (aspect + density)
  const minRows = Math.max(minRowsFromAspect, minRowsFromMax, minRowsFromDensity, 2);
  const maxRows = Math.min(maxRowsFromAspect, n, Math.ceil(n / minPhotosPerRow) + 2);
  
  // Edge case: if constraints conflict, favor aspect ratio bounds
  const effectiveMaxRows = Math.max(minRows, maxRows);
  
  // Collect top scores for randomization
  const topScores: PartitionScore[] = [];
  const TOP_N = 5;
  
  for (let numRows = minRows; numRows <= effectiveMaxRows; numRows++) {
    const partitionCount = countPartitions(n, numRows);
    
    // For small partition counts, enumerate all
    if (partitionCount <= 500) {
      for (const partition of generatePartitions(workingDims, numRows)) {
        const score = scorePartition(partition, shape, width, minPhotosPerRow);
        
        // Apply height budget penalty if maxHeight is specified
        if (maxHeight !== undefined) {
          const partitionHeight = calculatePackedHeight(partition, width, gap);
          if (partitionHeight > maxHeight) {
            const overage = (partitionHeight - maxHeight) / maxHeight;
            // Quadratic penalty: increasingly bad as we exceed budget
            score.totalScore += 5.0 * overage * overage;
          }
        }
        
        insertIntoTopN(topScores, score, TOP_N);
      }
    } else {
      // For large sets, use sampling + heuristic approach
      const sampledPartitions = samplePartitions(workingDims, numRows, 100);
      for (const partition of sampledPartitions) {
        const score = scorePartition(partition, shape, width, minPhotosPerRow);
        
        // Apply height budget penalty if maxHeight is specified
        if (maxHeight !== undefined) {
          const partitionHeight = calculatePackedHeight(partition, width, gap);
          if (partitionHeight > maxHeight) {
            const overage = (partitionHeight - maxHeight) / maxHeight;
            score.totalScore += 5.0 * overage * overage;
          }
        }
        
        insertIntoTopN(topScores, score, TOP_N);
      }
    }
  }
  
  if (topScores.length === 0) {
    return [workingDims];
  }
  
  // When randomizing, pick randomly from top N; otherwise pick the best
  if (randomize && topScores.length > 1) {
    const randomIndex = Math.floor(Math.random() * topScores.length);
    return topScores[randomIndex].partition;
  }
  
  return topScores[0].partition;
}

/** Insert score into top-N array, keeping it sorted (best first) */
function insertIntoTopN(
  topScores: PartitionScore[],
  score: PartitionScore,
  maxSize: number
): void {
  // Find insertion position
  let insertIdx = topScores.length;
  for (let i = 0; i < topScores.length; i++) {
    if (score.totalScore < topScores[i].totalScore) {
      insertIdx = i;
      break;
    }
  }
  
  // Only insert if within top N
  if (insertIdx < maxSize) {
    topScores.splice(insertIdx, 0, score);
    // Trim to max size
    if (topScores.length > maxSize) {
      topScores.pop();
    }
  }
}

/** Sample partitions using a balanced heuristic for large sets */
function samplePartitions(
  dims: PhotoDimension[],
  numRows: number,
  sampleCount: number
): PhotoDimension[][][] {
  const n = dims.length;
  const partitions: PhotoDimension[][][] = [];
  
  // Strategy 1: Even splits
  const evenSize = Math.floor(n / numRows);
  const remainder = n % numRows;
  const evenPartition: PhotoDimension[][] = [];
  let idx = 0;
  for (let r = 0; r < numRows; r++) {
    const rowSize = evenSize + (r < remainder ? 1 : 0);
    evenPartition.push(dims.slice(idx, idx + rowSize));
    idx += rowSize;
  }
  partitions.push(evenPartition);
  
  // Strategy 2: Variations around even splits
  for (let sample = 0; sample < sampleCount - 1; sample++) {
    const partition: PhotoDimension[][] = [];
    let remaining = [...dims];
    
    for (let r = 0; r < numRows - 1; r++) {
      const avgRemaining = remaining.length / (numRows - r);
      // Random variation: ±1 around average
      const variation = Math.floor(Math.random() * 3) - 1;
      const rowSize = Math.max(1, Math.min(
        remaining.length - (numRows - r - 1),
        Math.round(avgRemaining + variation)
      ));
      
      partition.push(remaining.slice(0, rowSize));
      remaining = remaining.slice(rowSize);
    }
    partition.push(remaining);
    partitions.push(partition);
  }
  
  return partitions;
}

// ============================================================================
// Layout Calculation Helpers
// ============================================================================

/** Calculate the total height a partition would achieve at a given width */
function calculatePackedHeight(
  partition: PhotoDimension[][],
  width: number,
  gap: number
): number {
  if (partition.length === 0) return 0;
  
  const heights = partition.map(row => {
    const aspectSum = getRowAspectSum(row);
    const availableWidth = width - gap * (row.length - 1);
    return availableWidth / aspectSum;
  });
  return heights.reduce((sum, h) => sum + h, 0) + gap * (partition.length - 1);
}

/** Calculate layout cells with offset positioning for sub-regions */
function calculateLayoutWithOffset(
  rows: PhotoDimension[][],
  width: number,
  gap: number,
  offsetX: number,
  offsetY: number
): CollageCell[] {
  const cells: CollageCell[] = [];
  
  let y = offsetY;
  for (const row of rows) {
    const aspectSum = getRowAspectSum(row);
    const availableWidth = width - gap * (row.length - 1);
    const height = availableWidth / aspectSum;
    
    let x = offsetX;
    for (const photo of row) {
      const photoWidth = (photo.aspectRatio * photo.weight / aspectSum) * availableWidth;
      
      cells.push({
        photoId: photo.id,
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(photoWidth),
        height: Math.round(height),
      });
      
      x += photoWidth + gap;
    }
    
    y += height + gap;
  }
  
  return cells;
}

// ============================================================================
// Region Packing (Reusable Primitive)
// ============================================================================

/**
 * Pack photos into a rectangular region using row-based layout.
 * This is the core primitive for both standard layouts and future hero layouts.
 */
export function packPhotosIntoRegion(
  dims: PhotoDimension[],
  options: RegionPackOptions
): RegionPackResult {
  const { 
    width, 
    gap, 
    targetHeight, 
    tolerance = 2,
    offsetX = 0,
    offsetY = 0,
    shape,
    minPhotosPerRow = 2,
    maxHeight
  } = options;
  
  // Handle empty case
  if (dims.length === 0) {
    return { cells: [], achievedHeight: 0, partition: [], valid: true, heightError: 0 };
  }
  
  // Handle single photo case
  if (dims.length === 1) {
    const d = dims[0];
    const cellHeight = width / d.aspectRatio;
    const cells: CollageCell[] = [{
      photoId: d.id,
      x: Math.round(offsetX),
      y: Math.round(offsetY),
      width: Math.round(width),
      height: Math.round(cellHeight),
    }];
    const heightError = targetHeight ? Math.abs(cellHeight - targetHeight) : 0;
    return { 
      cells, 
      achievedHeight: cellHeight, 
      partition: [[d]], 
      valid: !targetHeight || heightError <= tolerance,
      heightError 
    };
  }
  
  // Use existing row-split logic (no randomization for region packing)
  // Pass shape directly to let it drive the scoring
  // Pass width, gap, maxHeight for height budget constraint
  const partition = findBestRowSplit(dims, shape ?? 'auto', false, minPhotosPerRow, width, gap, maxHeight);
  
  // Calculate layout with offsets
  const cells = calculateLayoutWithOffset(partition, width, gap, offsetX, offsetY);
  const achievedHeight = calculatePackedHeight(partition, width, gap);
  
  const heightError = targetHeight ? Math.abs(achievedHeight - targetHeight) : 0;
  const valid = !targetHeight || heightError <= tolerance;
  
  return { cells, achievedHeight, partition, valid, heightError };
}

// ============================================================================
// Layout Calculation (Uses Shared Helpers)
// ============================================================================

function calculateLayout(
  rows: PhotoDimension[][],
  settings: CollageSettings,
  baseWidth: number = 1200
): CollageLayout {
  const cells = calculateLayoutWithOffset(rows, baseWidth, settings.gapSize, 0, 0);
  const totalHeight = calculatePackedHeight(rows, baseWidth, settings.gapSize);
  
  return {
    width: baseWidth,
    height: totalHeight,
    cells,
  };
}

// ============================================================================
// Public API
// ============================================================================

export function generateCollageLayout(
  photos: PhotoItem[],
  settings: CollageSettings,
  options?: LayoutOptions
): CollageLayout {
  if (photos.length === 0) {
    return { width: 1200, height: 800, cells: [] };
  }
  
  // Derive weights from priority if not explicitly provided
  const weights = options?.photoWeights ?? deriveWeightsFromPriority(photos);
  
  if (photos.length === 1) {
    const photo = photos[0];
    const crop = getDisplayCrop(photo);
    const w = crop ? crop.width : photo.originalWidth;
    const h = crop ? crop.height : photo.originalHeight;
    const scale = 1200 / w;
    
    return {
      width: 1200,
      height: h * scale,
      cells: [{
        photoId: photo.id,
        x: 0,
        y: 0,
        width: 1200,
        height: h * scale,
      }],
    };
  }
  
  const dims = getPhotoDimensions(photos, weights);
  
  // Calculate dynamic minPhotosPerRow range based on photo count and orientation
  const n = photos.length;
  const [minRange, maxRange] = getMinPhotosPerRowRange(n, settings.shape);
  
  // Pick from range: random for variety, or midpoint as sensible default
  let effectiveMinPhotosPerRow: number;
  if (options?.randomize) {
    // Random float in [minRange, maxRange]
    effectiveMinPhotosPerRow = minRange + Math.random() * (maxRange - minRange);
  } else {
    // Use midpoint of range as sensible default
    effectiveMinPhotosPerRow = (minRange + maxRange) / 2;
  }
  
  // Build tuning with effective value
  const layoutTuning: LayoutTuning = {
    ...(options?.tuning ?? DEFAULT_TUNING),
    minPhotosPerRow: effectiveMinPhotosPerRow,
  };
  
  // Pass settings through - shape is now driven by settings.orientation
  return generateHeroLayout(
    photos,
    settings,
    weights,
    options?.randomize ?? false,
    layoutTuning
  );
}

/** Swap two photos in the layout (positions swap, layout geometry unchanged) */
export function swapPhotosInLayout(
  layout: CollageLayout,
  photoId1: string,
  photoId2: string
): CollageLayout {
  const cells = layout.cells.map((cell) => {
    if (cell.photoId === photoId1) {
      return { ...cell, photoId: photoId2 };
    }
    if (cell.photoId === photoId2) {
      return { ...cell, photoId: photoId1 };
    }
    return cell;
  });
  
  return { ...layout, cells };
}

/**
 * Swap two photos and reflow affected rows so each maintains correct aspect ratios.
 * Row heights adjust to fit new photo combinations; rows below cascade vertically.
 */
export function reflowAfterSwap(
  layout: CollageLayout,
  photos: PhotoItem[],
  photoId1: string,
  photoId2: string,
  gap: number
): CollageLayout {
  // 1. Swap photoIds in cells
  let cells = layout.cells.map(cell => {
    if (cell.photoId === photoId1) return { ...cell, photoId: photoId2 };
    if (cell.photoId === photoId2) return { ...cell, photoId: photoId1 };
    return { ...cell };
  });

  // 2. Group cells into rows by y position
  const rowMap = new Map<number, CollageCell[]>();
  for (const cell of cells) {
    const existing = rowMap.get(cell.y) || [];
    existing.push(cell);
    rowMap.set(cell.y, existing);
  }

  // 3. Sort rows by y, recalculate heights and widths for each row
  const sortedYs = [...rowMap.keys()].sort((a, b) => a - b);
  const rowData: { originalY: number; cells: CollageCell[]; newHeight: number }[] = [];

  for (const y of sortedYs) {
    const rowCells = rowMap.get(y)!.sort((a, b) => a.x - b.x);
    
    // Calculate aspect ratio for each photo in this row
    const aspects = rowCells.map(cell => {
      const photo = photos.find(p => p.id === cell.photoId);
      if (!photo) {
        // Fallback: use cell's current aspect if photo not found
        return cell.width / cell.height;
      }
      const crop = getDisplayCrop(photo);
      return crop 
        ? crop.width / crop.height 
        : photo.originalWidth / photo.originalHeight;
    });
    
    const aspectSum = aspects.reduce((sum, a) => sum + a, 0);
    const availableWidth = layout.width - gap * (rowCells.length - 1);
    const newHeight = availableWidth / aspectSum;

    // Recalculate cell widths within this row
    let x = 0;
    for (let i = 0; i < rowCells.length; i++) {
      const newWidth = (aspects[i] / aspectSum) * availableWidth;
      rowCells[i].x = Math.round(x);
      rowCells[i].width = Math.round(newWidth);
      rowCells[i].height = Math.round(newHeight);
      x += newWidth + gap;
    }

    rowData.push({ originalY: y, cells: rowCells, newHeight });
  }

  // 4. Cascade y positions from top to bottom
  let currentY = 0;
  for (const row of rowData) {
    for (const cell of row.cells) {
      cell.y = Math.round(currentY);
    }
    currentY += row.newHeight + gap;
  }

  // 5. Flatten cells and compute new total height
  const newCells = rowData.flatMap(r => r.cells);
  const newHeight = currentY - gap; // Remove trailing gap

  return {
    width: layout.width,
    height: Math.round(newHeight),
    cells: newCells,
  };
}

/**
 * Derive weights from PhotoItem.priority when photoWeights is not explicitly provided.
 * Priority 1 (hero) → weight 2.0, others → weight 1.0
 */
function deriveWeightsFromPriority(photos: PhotoItem[]): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const photo of photos) {
    weights[photo.id] = photo.priority === 1 ? 2.0 : 1.0;
  }
  return weights;
}
