import { PhotoItem, CollageLayout, CollageCell, CollageSettings } from '@/types/collage';
import { getDisplayCrop } from '@/lib/cropUtils';

// ============================================================================
// Types
// ============================================================================

interface PhotoDimension {
  id: string;
  width: number;
  height: number;
  aspectRatio: number;
  weight: number; // For future "hero" photos support
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
  
  /** Target aspect ratio for scoring (optional, inferred from width/targetHeight) */
  targetAspect?: number;
  
  /** Whether this is a landscape-oriented region */
  isLandscape?: boolean;
}

export interface LayoutOptions {
  /** Weight multiplier per photo ID (default: 1). Higher = larger in layout */
  photoWeights?: Record<string, number>;
}

interface PartitionScore {
  partition: PhotoDimension[][];
  areaCV: number;       // Coefficient of variation of cell areas (lower = more uniform)
  heightCV: number;     // CV of row heights
  aspectDiff: number;   // How far from target aspect ratio
  totalScore: number;   // Combined weighted score (lower = better)
}

// ============================================================================
// Dimension Extraction
// ============================================================================

function getPhotoDimensions(photos: PhotoItem[], weights: Record<string, number>): PhotoDimension[] {
  return photos.map((photo) => {
    const crop = getDisplayCrop(photo);
    const width = crop ? crop.width : photo.originalWidth;
    const height = crop ? crop.height : photo.originalHeight;
    return {
      id: photo.id,
      width,
      height,
      aspectRatio: width / height,
      weight: weights[photo.id] ?? 1,
    };
  });
}

// ============================================================================
// Statistical Helpers
// ============================================================================

/** Coefficient of variation: stddev / mean (0 = perfectly uniform) */
function coefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance) / mean;
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
  targetAspect: number,
  isLandscape: boolean,
  baseWidth: number = 1200
): PartitionScore {
  if (partition.length === 0) {
    return { partition, areaCV: Infinity, heightCV: Infinity, aspectDiff: Infinity, totalScore: Infinity };
  }
  
  // Calculate metrics
  const areas = calculateCellAreas(partition, baseWidth);
  const heights = calculateRowHeights(partition, baseWidth);
  const totalHeight = heights.reduce((a, b) => a + b, 0);
  const resultAspect = baseWidth / totalHeight;
  
  const areaCV = coefficientOfVariation(areas);
  const heightCV = coefficientOfVariation(heights);
  const aspectDiff = Math.abs(resultAspect - targetAspect) / targetAspect;
  
  // Hard penalty: wrong orientation direction
  const wrongDirection = isLandscape 
    ? resultAspect < 1.0   // Landscape should be > 1 (wider than tall)
    : resultAspect > 1.0;  // Portrait should be < 1 (taller than wide)
  const directionPenalty = wrongDirection ? 10.0 : 0;
  
  // Penalize rows with very few or very many photos
  const rowSizes = partition.map(r => r.length);
  const minRowSize = Math.min(...rowSizes);
  const maxRowSize = Math.max(...rowSizes);
  const rowBalancePenalty = 
    (minRowSize === 1 && partition.length > 1 ? 0.3 : 0) + // Heavily penalize single-photo rows
    (maxRowSize > 6 ? 0.1 * (maxRowSize - 6) : 0);         // Penalize very long rows
  
  // Combined score (lower = better)
  // Uniformity is primary, orientation direction is hard gate
  const totalScore = 
    aspectDiff * 0.5 +       // Relaxed: allow aspect flexibility
    directionPenalty +       // HARD: correct orientation direction
    areaCV * 1.0 +           // PRIMARY: uniform cell sizes
    heightCV * 0.2 +         // Light: uniform row heights
    rowBalancePenalty;       // Penalties for extreme rows
  
  return { partition, areaCV, heightCV, aspectDiff, totalScore };
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
  targetAspect: number,
  isLandscape: boolean
): PhotoDimension[][] {
  const n = dims.length;
  
  if (n <= 1) return [dims];
  
  // Determine ideal photos-per-row based on orientation
  // More per row for landscape = wider layout
  const idealPhotosPerRow = isLandscape ? 5 : 3;
  const idealRows = Math.ceil(n / idealPhotosPerRow);
  
  // For landscape, explore toward fewer rows; for portrait, toward more rows
  const minRows = isLandscape 
    ? Math.max(1, idealRows - 2) 
    : Math.max(1, idealRows - 1);
  const maxRows = isLandscape 
    ? Math.min(n, idealRows + 1, 6) 
    : Math.min(n, idealRows + 3, 10);
  
  let bestScore: PartitionScore = {
    partition: [dims],
    areaCV: Infinity,
    heightCV: Infinity,
    aspectDiff: Infinity,
    totalScore: Infinity
  };
  
  for (let numRows = minRows; numRows <= maxRows; numRows++) {
    const partitionCount = countPartitions(n, numRows);
    
    // For small partition counts, enumerate all
      if (partitionCount <= 500) {
        for (const partition of generatePartitions(dims, numRows)) {
          const score = scorePartition(partition, targetAspect, isLandscape);
          if (score.totalScore < bestScore.totalScore) {
            bestScore = score;
          }
        }
      } else {
        // For large sets, use sampling + heuristic approach
        const sampledPartitions = samplePartitions(dims, numRows, 100);
        for (const partition of sampledPartitions) {
          const score = scorePartition(partition, targetAspect, isLandscape);
          if (score.totalScore < bestScore.totalScore) {
            bestScore = score;
          }
        }
      }
  }
  
  return bestScore.partition;
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
    targetAspect,
    isLandscape = true 
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
  
  // Use existing row-split logic
  const effectiveTargetAspect = targetAspect ?? (targetHeight ? width / targetHeight : (isLandscape ? 1.5 : 0.75));
  const partition = findBestRowSplit(dims, effectiveTargetAspect, isLandscape);
  
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
  
  const weights = options?.photoWeights ?? {};
  
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
  const isLandscape = settings.orientation === 'landscape';
  
  // Target aspect ratio based on orientation
  const targetAspect = isLandscape ? 1.5 : 0.75;
  
  const rows = findBestRowSplit(dims, targetAspect, isLandscape);
  const layout = calculateLayout(rows, settings);
  
  return layout;
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
