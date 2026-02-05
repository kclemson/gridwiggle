import { CollageLayout } from '@/types/collage';
import { SyntheticPhoto } from '@/test/layout/types';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';

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
 * Visualize a layout using CSS absolute positioning.
 * Each cell shows a colored rectangle with aspect ratio label.
 */
export function LayoutVisualization({ layout, photos }: LayoutVisualizationProps) {
  return (
    <div
      className="relative mx-auto border border-border rounded-lg overflow-hidden bg-muted/30"
      style={{
        aspectRatio: `${layout.width} / ${layout.height}`,
        maxHeight: '50vh',
        maxWidth: '100%',
      }}
    >
      {layout.cells.map((cell, index) => {
        const photo = photos.find(p => p.id === cell.photoId);
        const isHero = photo?.priority === 1;
        
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
              isHero && "ring-2 ring-amber-400 z-10"
            )}
            style={{
              left: `${(cell.x / layout.width) * 100}%`,
              top: `${(cell.y / layout.height) * 100}%`,
              width: `${(cell.width / layout.width) * 100}%`,
              height: `${(cell.height / layout.height) * 100}%`,
              backgroundColor: getPastelColor(index),
            }}
          >
            <span className="flex items-center gap-1 px-1 py-0.5 bg-background/70 rounded text-foreground text-[10px]">
              {isHero && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
              {photo?.aspectRatio.toFixed(2)} · {areaPercent}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
