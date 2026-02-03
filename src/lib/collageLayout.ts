import { PhotoItem, CollageLayout, CollageCell, CollageSettings } from '@/types/collage';
import { getActiveCrop } from '@/lib/imageUtils';

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
    const crop = getActiveCrop(photo);
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
  
  // Penalize rows with very few or very many photos
  const rowSizes = partition.map(r => r.length);
  const minRowSize = Math.min(...rowSizes);
  const maxRowSize = Math.max(...rowSizes);
  const rowBalancePenalty = 
    (minRowSize === 1 && partition.length > 1 ? 0.3 : 0) + // Heavily penalize single-photo rows
    (maxRowSize > 6 ? 0.1 * (maxRowSize - 6) : 0);         // Penalize very long rows
  
  // Combined score (lower = better)
  // Area uniformity is primary concern
  const totalScore = 
    areaCV * 1.0 +           // Primary: uniform cell sizes
    heightCV * 0.3 +         // Secondary: uniform row heights
    aspectDiff * 0.2 +       // Light: target aspect ratio
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
  const idealPhotosPerRow = isLandscape ? 4 : 3;
  const idealRows = Math.ceil(n / idealPhotosPerRow);
  
  // Explore row counts in a neighborhood around ideal
  const minRows = Math.max(1, idealRows - 1);
  const maxRows = Math.min(n, idealRows + 2, isLandscape ? 6 : 8);
  
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
        const score = scorePartition(partition, targetAspect);
        if (score.totalScore < bestScore.totalScore) {
          bestScore = score;
        }
      }
    } else {
      // For large sets, use sampling + heuristic approach
      const sampledPartitions = samplePartitions(dims, numRows, 100);
      for (const partition of sampledPartitions) {
        const score = scorePartition(partition, targetAspect);
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
// Layout Calculation
// ============================================================================

function calculateLayout(
  rows: PhotoDimension[][],
  settings: CollageSettings,
  baseWidth: number = 1200
): CollageLayout {
  const gap = settings.gapSize;
  const cells: CollageCell[] = [];
  
  // Calculate row heights based on weighted aspect ratios
  const rowData = rows.map((row) => {
    const aspectSum = getRowAspectSum(row);
    const availableWidth = baseWidth - gap * (row.length - 1);
    const height = availableWidth / aspectSum;
    return { row, aspectSum, height, availableWidth };
  });
  
  // Calculate positions
  let y = 0;
  for (const { row, aspectSum, height, availableWidth } of rowData) {
    let x = 0;
    
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
  
  const totalHeight = y - gap;
  
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
    const crop = getActiveCrop(photo);
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
