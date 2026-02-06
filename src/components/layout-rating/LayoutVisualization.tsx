import { CollageLayout } from '@/types/collage';
import { SyntheticPhoto } from '@/test/layout/types';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';
import { useMemo } from 'react';

interface LayoutVisualizationProps {
  layout: CollageLayout;
  photos: SyntheticPhoto[];
}

/**
 * Generate a pastel color based on index for visual variety.
 */
function getPastelColor(index: number): string {
  const hues = [
    210, // blue
    340, // pink
    160, // green
    45,  // orange
    280, // purple
    180, // cyan
    20,  // coral
    120, // lime
    300, // magenta
    60,  // yellow
  ];
  
  const hue = hues[index % hues.length];
  // Pastel: high lightness, moderate saturation
  return `hsl(${hue}, 60%, 75%)`;
}

/**
 * Generate alphabetic label: 0=A, 25=Z, 26=AA, 27=AB, etc.
 */
function getPhotoLabel(index: number): string {
  if (index < 26) {
    return String.fromCharCode(65 + index); // A-Z
  }
  // For 26+, use AA, AB, AC...
  const first = Math.floor(index / 26) - 1;
  const second = index % 26;
  return String.fromCharCode(65 + first) + String.fromCharCode(65 + second);
}

/**
 * Visualize a layout using CSS absolute positioning.
 * Each cell shows a colored rectangle with letter label, aspect ratio, and area%.
 */
export function LayoutVisualization({ layout, photos }: LayoutVisualizationProps) {
  // Sort cells by reading order (top to bottom, left to right) for labeling
  const sortedCells = useMemo(() => {
    return [...layout.cells].sort((a, b) => {
      // First by Y (top to bottom), then by X (left to right)
      const yDiff = a.y - b.y;
      if (Math.abs(yDiff) > 1) return yDiff; // Use small threshold for float comparison
      return a.x - b.x;
    });
  }, [layout.cells]);

  // Create a map from photoId to label index
  const labelMap = useMemo(() => {
    const map = new Map<string, number>();
    sortedCells.forEach((cell, index) => {
      map.set(cell.photoId, index);
    });
    return map;
  }, [sortedCells]);

  return (
    <div
      className="relative mx-auto border border-border overflow-hidden bg-muted/30"
      style={{
        aspectRatio: `${layout.width} / ${layout.height}`,
        maxHeight: '50vh',
        maxWidth: '100%',
      }}
    >
      {layout.cells.map((cell) => {
        const photo = photos.find(p => p.id === cell.photoId);
        const isHero = photo?.priority === 1;
        const labelIndex = labelMap.get(cell.photoId) ?? 0;
        
        // Calculate area percentage
        const totalArea = layout.width * layout.height;
        const cellArea = cell.width * cell.height;
        const areaPercent = Math.round((cellArea / totalArea) * 100);
        
        return (
          <div
            key={cell.photoId}
            className={cn(
              "absolute flex items-center justify-center text-xs font-mono",
              "border border-border/40 transition-all",
              isHero && "ring-2 ring-inset ring-amber-400 z-10"
            )}
            style={{
              left: `${(cell.x / layout.width) * 100}%`,
              top: `${(cell.y / layout.height) * 100}%`,
              width: `${(cell.width / layout.width) * 100}%`,
              height: `${(cell.height / layout.height) * 100}%`,
              backgroundColor: getPastelColor(labelIndex),
            }}
          >
            <span className="flex flex-col items-center gap-0.5 px-1 py-0.5 bg-background/70 rounded text-foreground">
              <span className="flex items-center gap-1 font-bold text-sm">
                {isHero && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                {getPhotoLabel(labelIndex)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {photo?.aspectRatio.toFixed(2)} {areaPercent}%
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
