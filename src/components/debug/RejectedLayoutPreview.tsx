/**
 * Rejected Layout Preview
 * 
 * Mini CSS visualization for rejected layouts in hover popovers.
 * Shows colored rectangles with photo IDs at ~200px scale.
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { RejectedLayoutGeometry } from '@/lib/devLogger';

const PREVIEW_WIDTH = 200;

/**
 * Generate a pastel color based on index for visual variety.
 */
function getPastelColor(index: number): string {
  const hues = [210, 340, 160, 45, 280, 180, 20, 120, 300, 60];
  const hue = hues[index % hues.length];
  return `hsl(${hue}, 60%, 75%)`;
}

/**
 * Generate alphabetic label: 0=A, 25=Z, 26=AA, etc.
 */
function getPhotoLabel(index: number): string {
  if (index < 26) return String.fromCharCode(65 + index);
  const first = Math.floor(index / 26) - 1;
  const second = index % 26;
  return String.fromCharCode(65 + first) + String.fromCharCode(65 + second);
}

interface RejectedLayoutPreviewProps extends RejectedLayoutGeometry {}

export function RejectedLayoutPreview({ 
  cells, 
  canvasWidth, 
  canvasHeight 
}: RejectedLayoutPreviewProps) {
  // Sort cells by reading order for consistent labeling
  const sortedCells = useMemo(() => {
    return [...cells].sort((a, b) => {
      const yDiff = a.y - b.y;
      if (Math.abs(yDiff) > 0.01) return yDiff;
      return a.x - b.x;
    });
  }, [cells]);

  // Create label map
  const labelMap = useMemo(() => {
    const map = new Map<string, number>();
    sortedCells.forEach((cell, index) => {
      map.set(cell.photoId, index);
    });
    return map;
  }, [sortedCells]);

  // Calculate preview dimensions maintaining aspect ratio
  const aspectRatio = canvasWidth / canvasHeight;
  const previewHeight = PREVIEW_WIDTH / aspectRatio;

  return (
    <div
      className={cn(
        "relative bg-muted/30 ring-2 ring-red-500 rounded overflow-hidden"
      )}
      style={{
        width: PREVIEW_WIDTH,
        height: previewHeight,
      }}
    >
      {cells.map((cell) => {
        const labelIndex = labelMap.get(cell.photoId) ?? 0;
        const isHero = cell.photoId.includes('hero') || labelIndex === 0;
        
        return (
          <div
            key={cell.photoId}
            className={cn(
              "absolute flex items-center justify-center text-[10px] font-mono",
              "border border-border/40",
              isHero && "ring-1 ring-inset ring-amber-400"
            )}
            style={{
              left: `${(cell.x / canvasWidth) * 100}%`,
              top: `${(cell.y / canvasHeight) * 100}%`,
              width: `${(cell.width / canvasWidth) * 100}%`,
              height: `${(cell.height / canvasHeight) * 100}%`,
              backgroundColor: getPastelColor(labelIndex),
            }}
          >
            <span className="bg-background/70 px-0.5 rounded font-bold">
              {getPhotoLabel(labelIndex)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
