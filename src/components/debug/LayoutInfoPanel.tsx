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
      areaFrac, heroCoverage, heroAR, hero2AR, prominenceRatio, score, corner,
      candidateCount, regionSizes, regionTargetRows, regionActualRows,
      besideWidth, belowHeight, penalties,
    } = meta as {
      template: string; targetCanvasAR: number; actualCanvasAR: number;
      arDeviation: number; areaFrac: number; heroCoverage: number;
      heroAR: number; hero2AR?: number; prominenceRatio: number; score: number; corner: string;
      candidateCount: number; regionSizes: number[];
      regionTargetRows: number[]; regionActualRows: number[];
      besideWidth: number; belowHeight: number;
      penalties?: { ar: number; coverage: number; prominence: number };
    };

    return (
      <div className="mt-3 p-3 bg-muted/50 border border-border rounded-lg">
        <div className="flex items-center gap-1.5 text-muted-foreground text-sm font-medium mb-2">
          <Info className="h-4 w-4" />
          Layout Info
        </div>
        <div className="text-xs text-muted-foreground/80 font-mono space-y-0.5">
          <div>template: {template} ({corner})</div>
          <div className="mt-1">
            target area fraction: {areaFrac.toFixed(3)}
            <span className="text-muted-foreground/50 ml-1">
              [hero % of canvas used for photo split planning]
            </span>
          </div>
          {heroCoverage != null && (
            <div className="text-primary font-semibold">
              actual hero coverage: {(heroCoverage * 100).toFixed(1)}% of canvas
            </div>
          )}
          <div className="mt-1">target canvas AR: {targetCanvasAR.toFixed(2)}</div>
          <div>
            actual canvas AR: {actualCanvasAR.toFixed(2)}
            <span className="text-muted-foreground/60 ml-1">
              (deviation: {(arDeviation * 100).toFixed(1)}%)
            </span>
          </div>
          <div className="mt-1">
            hero 1 AR: {heroAR.toFixed(2)} | prominence: {prominenceRatio.toFixed(2)}x
            <span className="text-muted-foreground/50 ml-1">
              [hero is {prominenceRatio.toFixed(1)}x the largest content photo]
            </span>
          </div>
          {hero2AR != null && (
            <div>
              hero 2 AR: {hero2AR.toFixed(2)}
            </div>
          )}
          <div className="mt-1">
            score: {score.toFixed(3)} | candidates: {candidateCount}
            {penalties && (penalties.ar > 0 || penalties.coverage > 0 || penalties.prominence > 0) && (
              <div className="text-orange-500 dark:text-orange-400 font-semibold">
                penalties: AR {penalties.ar.toFixed(3)} | coverage {penalties.coverage.toFixed(3)} | prominence {penalties.prominence.toFixed(3)}
              </div>
            )}
          </div>
          {regionSizes?.[0] > 0 && (
            <div className="mt-1">
              region 0 (beside {hero2AR != null ? 'H1' : 'hero'}): {regionSizes[0]} photos, w={besideWidth.toFixed(2)}
              <div className="ml-2 text-muted-foreground/60">
                target rows: {regionTargetRows[0]} | actual rows: {regionActualRows[0]}
              </div>
            </div>
          )}
          {regionSizes?.[1] > 0 && (
            <div className="mt-1">
              region 1 ({hero2AR != null ? 'middle band' : 'below'}): {regionSizes[1]} photos{hero2AR == null && `, h=${belowHeight.toFixed(2)}`}
              <div className="ml-2 text-muted-foreground/60">
                target rows: {regionTargetRows[1]} | actual rows: {regionActualRows[1]}
              </div>
            </div>
          )}
          {regionSizes?.[2] != null && regionSizes[2] > 0 && (
            <div className="mt-1">
              region 2 (beside H2): {regionSizes[2]} photos
              <div className="ml-2 text-muted-foreground/60">
                target rows: {regionTargetRows[2]} | actual rows: {regionActualRows[2]}
              </div>
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
