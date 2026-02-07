/**
 * Layout Utilities
 * 
 * Algorithm-agnostic utilities for layout manipulation.
 */

import { PhotoItem, CollageLayout, CollageCell } from '@/types/collage';
import { getDisplayCrop } from '@/lib/cropUtils';

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
