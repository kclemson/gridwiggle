import { PhotoItem, CollageLayout, CollageCell, CollageSettings, CropRegion } from '@/types/collage';
import { getActiveCrop } from '@/lib/imageUtils';

interface PhotoDimension {
  id: string;
  width: number;
  height: number;
  aspectRatio: number;
}

// Get the effective dimensions after cropping
function getPhotoDimensions(photos: PhotoItem[]): PhotoDimension[] {
  return photos.map((photo) => {
    const crop = getActiveCrop(photo);
    const width = crop ? crop.width : photo.originalWidth;
    const height = crop ? crop.height : photo.originalHeight;
    return {
      id: photo.id,
      width,
      height,
      aspectRatio: width / height,
    };
  });
}

// Calculate the total aspect ratio sum for a row
function getRowAspectSum(dims: PhotoDimension[]): number {
  return dims.reduce((sum, d) => sum + d.aspectRatio, 0);
}

// Find the best way to split photos into rows for a target width/height ratio
function findBestRowSplit(
  dims: PhotoDimension[],
  targetAspect: number,
  isLandscape: boolean
): PhotoDimension[][] {
  const n = dims.length;
  
  // For small number of photos, try all possible row combinations
  if (n <= 6) {
    return findOptimalSplit(dims, targetAspect, isLandscape);
  }
  
  // For larger sets, use a greedy approach
  return greedySplit(dims, targetAspect, isLandscape);
}

function findOptimalSplit(
  dims: PhotoDimension[],
  targetAspect: number,
  isLandscape: boolean
): PhotoDimension[][] {
  const n = dims.length;
  let bestSplit: PhotoDimension[][] = [dims];
  let bestScore = Infinity;
  
  // Generate all possible row partitions
  function* partitions(arr: PhotoDimension[], maxRows: number): Generator<PhotoDimension[][]> {
    if (arr.length === 0) {
      yield [];
      return;
    }
    if (maxRows === 1) {
      yield [arr];
      return;
    }
    for (let i = 1; i <= arr.length; i++) {
      const first = arr.slice(0, i);
      for (const rest of partitions(arr.slice(i), maxRows - 1)) {
        yield [first, ...rest];
      }
    }
  }
  
  const maxRows = Math.min(n, isLandscape ? 3 : 4);
  
  for (const partition of partitions(dims, maxRows)) {
    if (partition.length === 0) continue;
    
    // Calculate the resulting aspect ratio for this partition
    const rowHeights: number[] = [];
    const baseWidth = 1000; // Reference width
    
    for (const row of partition) {
      const rowAspect = getRowAspectSum(row);
      const rowHeight = baseWidth / rowAspect;
      rowHeights.push(rowHeight);
    }
    
    const totalHeight = rowHeights.reduce((a, b) => a + b, 0);
    const resultAspect = baseWidth / totalHeight;
    
    // Score based on how close to target and row balance
    const aspectDiff = Math.abs(resultAspect - targetAspect);
    const rowBalance = Math.max(...partition.map(r => r.length)) - Math.min(...partition.map(r => r.length));
    const score = aspectDiff + rowBalance * 0.1;
    
    if (score < bestScore) {
      bestScore = score;
      bestSplit = partition;
    }
  }
  
  return bestSplit;
}

function greedySplit(
  dims: PhotoDimension[],
  targetAspect: number,
  isLandscape: boolean
): PhotoDimension[][] {
  const rows: PhotoDimension[][] = [];
  let currentRow: PhotoDimension[] = [];
  
  const targetRowAspect = isLandscape ? targetAspect * 0.4 : targetAspect * 0.8;
  
  for (const dim of dims) {
    currentRow.push(dim);
    const currentAspect = getRowAspectSum(currentRow);
    
    if (currentAspect >= targetRowAspect && rows.length < (isLandscape ? 2 : 3)) {
      rows.push(currentRow);
      currentRow = [];
    }
  }
  
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }
  
  return rows;
}

// Calculate the final layout
function calculateLayout(
  rows: PhotoDimension[][],
  settings: CollageSettings,
  baseWidth: number = 1200
): CollageLayout {
  const gap = settings.gapSize;
  const cells: CollageCell[] = [];
  
  // Calculate row heights based on aspect ratios
  const rowData = rows.map((row) => {
    const aspectSum = getRowAspectSum(row);
    const availableWidth = baseWidth - gap * (row.length - 1);
    const height = availableWidth / aspectSum;
    return { row, aspectSum, height, availableWidth };
  });
  
  // Normalize heights if needed
  const heights = rowData.map(r => r.height);
  const avgHeight = heights.reduce((a, b) => a + b, 0) / heights.length;
  
  // Calculate positions
  let y = 0;
  for (const { row, aspectSum, height, availableWidth } of rowData) {
    let x = 0;
    
    for (const photo of row) {
      const photoWidth = (photo.aspectRatio / aspectSum) * availableWidth;
      
      cells.push({
        photoId: photo.id,
        x,
        y,
        width: photoWidth,
        height,
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

export function generateCollageLayout(
  photos: PhotoItem[],
  settings: CollageSettings
): CollageLayout {
  if (photos.length === 0) {
    return { width: 1200, height: 800, cells: [] };
  }
  
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
  
  const dims = getPhotoDimensions(photos);
  const isLandscape = settings.orientation === 'landscape';
  
  // Target aspect ratio based on orientation
  // We'll let the algorithm find the exact ratio, but guide it
  const targetAspect = isLandscape ? 1.5 : 0.75;
  
  const rows = findBestRowSplit(dims, targetAspect, isLandscape);
  const layout = calculateLayout(rows, settings);
  
  return layout;
}

// Swap two photos in the layout
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
