import { HeroPlacementResult } from '@/test/layout/heroFractionGenerator';
import { Badge } from '@/components/ui/badge';

interface HeroFractionVisualizationProps {
  result: HeroPlacementResult;
}

/**
 * Renders a canvas with hero rectangles using CSS absolute positioning.
 * Hero rects shown in amber/gold, remaining space is neutral gray.
 */
export function HeroFractionVisualization({ result }: HeroFractionVisualizationProps) {
  const { canvasAR, heroRects, heroARs, heroCount, actualAreaFraction, template, scenario } = result;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Canvas */}
      <div
        className="relative border-2 border-border bg-white overflow-hidden"
        style={{
          aspectRatio: `${canvasAR}`,
          maxHeight: '55vh',
          maxWidth: '100%',
          width: canvasAR >= 1 ? '100%' : undefined,
          height: canvasAR < 1 ? '55vh' : undefined,
        }}
      >
        {/* Content zone label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-muted-foreground/40 text-sm font-mono select-none">
            content zone
          </span>
        </div>

        {/* Hero rectangles */}
        {heroRects.map((rect, i) => (
          <div
            key={i}
            className="absolute border-2 border-amber-500 bg-amber-400/30 flex items-center justify-center"
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.w * 100}%`,
              height: `${rect.h * 100}%`,
            }}
          >
            <span className="text-xs font-bold text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded select-none">
              Hero {heroCount > 1 ? i + 1 : ''}
            </span>
          </div>
        ))}
      </div>

      {/* Stats badges */}
      <div className="flex flex-wrap gap-2 justify-center">
        {scenario && (
          <Badge variant="default" className="font-mono text-xs">
            {scenario}
          </Badge>
        )}
        <Badge variant="outline" className="font-mono text-xs">
          Area: {Math.round(actualAreaFraction * 100)}%
        </Badge>
        <Badge variant="outline" className="font-mono text-xs">
          Canvas AR: {canvasAR.toFixed(2)}
        </Badge>
        {heroARs.map((ar, i) => (
          <Badge key={i} variant="outline" className="font-mono text-xs">
            Hero{heroCount > 1 ? ` ${i + 1}` : ''} AR: {ar.toFixed(2)}
          </Badge>
        ))}
        <Badge variant="secondary" className="font-mono text-xs">
          {template}
        </Badge>
      </div>
    </div>
  );
}
