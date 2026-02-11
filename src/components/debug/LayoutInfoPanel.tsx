/**
 * LayoutInfoPanel Component
 * 
 * Displays V4 layout metadata showing the math inputs that produced
 * the current collage layout. Dev-only component.
 */

import { Info } from 'lucide-react';

interface LayoutInfoPanelProps {
  /** V4 layout metadata */
  meta?: Record<string, unknown>;
  /** Legacy soft rejection (fallback display) */
  reason?: string;
  details?: Record<string, unknown>;
}

export function LayoutInfoPanel({ meta, reason, details }: LayoutInfoPanelProps) {
  // V4 metadata display
  if (meta) {
    const {
      template, targetCanvasAR, actualCanvasAR, arDeviation,
      areaFrac, heroCoverage, heroAR, prominenceRatio, score, corner,
      candidateCount, regionSizes, regionTargetRows, regionActualRows,
      besideWidth, belowHeight,
    } = meta as {
      template: string; targetCanvasAR: number; actualCanvasAR: number;
      arDeviation: number; areaFrac: number; heroCoverage: number;
      heroAR: number; prominenceRatio: number; score: number; corner: string;
      candidateCount: number; regionSizes: number[];
      regionTargetRows: number[]; regionActualRows: number[];
      besideWidth: number; belowHeight: number;
    };

    return (
      <div className="mt-3 p-3 bg-muted/50 border border-border rounded-lg">
        <div className="flex items-center gap-1.5 text-muted-foreground text-sm font-medium mb-2">
          <Info className="h-4 w-4" />
          Layout Info
        </div>
        <div className="text-xs text-muted-foreground/80 font-mono space-y-0.5">
          <div>template: {template} ({corner})</div>
          {heroCoverage != null && (
            <div className="text-primary font-semibold">
              hero coverage: {(heroCoverage * 100).toFixed(1)}% of canvas
            </div>
          )}
          <div>
            target AR: {targetCanvasAR.toFixed(2)} → actual: {actualCanvasAR.toFixed(2)}
            <span className="text-muted-foreground/60 ml-1">
              (dev: {(arDeviation * 100).toFixed(1)}%)
            </span>
          </div>
          <div>
            area fraction: {areaFrac.toFixed(3)}
            <span className="text-muted-foreground/50 ml-1">
              [target hero % for photo split planning]
            </span>
          </div>
          <div>
            hero AR: {heroAR.toFixed(2)} | prominence: {prominenceRatio.toFixed(2)}x
            <span className="text-muted-foreground/50 ml-1">
              [hero is {prominenceRatio.toFixed(1)}x the largest content photo]
            </span>
          </div>
          <div>
            score: {score.toFixed(3)} | candidates: {candidateCount}
          </div>
          {regionSizes?.[0] > 0 && (
            <div>
              region 0 (beside): {regionSizes[0]} photos, {regionActualRows[0]} rows
              <span className="text-muted-foreground/60 ml-1">
                (target: {regionTargetRows[0]}), w={besideWidth.toFixed(2)}
              </span>
            </div>
          )}
          {regionSizes?.[1] > 0 && (
            <div>
              region 1 (below): {regionSizes[1]} photos, {regionActualRows[1]} rows
              <span className="text-muted-foreground/60 ml-1">
                (target: {regionTargetRows[1]}), h={belowHeight.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Legacy soft rejection display
  if (reason && details) {
    return (
      <div className="mt-3 p-3 bg-muted/50 border border-border rounded-lg">
        <div className="flex items-center gap-1.5 text-muted-foreground text-sm font-medium mb-2">
          <Info className="h-4 w-4" />
          Layout Info
        </div>
        <div className="text-xs text-muted-foreground/80 font-mono space-y-0.5">
          <div>reason: {reason.replace(/_/g, ' ')}</div>
          {Object.entries(details).map(([k, v]) => (
            <div key={k}>
              {k}: {typeof v === 'number' ? v.toFixed(3) : typeof v === 'object' ? JSON.stringify(v) : String(v)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
