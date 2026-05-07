/**
 * LayoutInfoPanel Component
 * 
 * Displays V4 layout metadata showing the math inputs that produced
 * the current collage layout. Dev-only component.
 */

import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayoutInfoPanelProps {
  /** V4 layout metadata */
  meta?: Record<string, unknown>;
  /** Legacy soft rejection (fallback display) */
  reason?: string;
  details?: Record<string, unknown>;
}

const DURATION_THRESHOLDS = { good: 50, warn: 200 };

function DurationIndicator({ ms }: { ms: number }) {
  const color = ms <= DURATION_THRESHOLDS.good
    ? 'text-green-600'
    : ms <= DURATION_THRESHOLDS.warn
      ? 'text-amber-600'
      : 'text-red-600';
  return <span className={cn('tabular-nums font-semibold', color)}>{ms.toFixed(1)}ms</span>;
}

function PerfSection({ meta }: { meta: Record<string, unknown> }) {
  const durationMs = meta.durationMs as number | undefined;
  const usedWorker = meta.usedWorker as boolean | undefined;
  const path = meta.path as string | undefined;
  const candidateCount = meta.candidateCount as number | undefined;
  const photoCount = meta.photoCount as number | undefined;
  const heroCount = meta.heroCount as number | undefined;

  if (durationMs == null && path == null) return null;

  return (
    <div className="mb-2 pb-2 border-b border-border/50">
      <div className="text-muted-foreground/60 text-[10px] uppercase tracking-wider mb-1">Performance</div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        {durationMs != null && <DurationIndicator ms={durationMs} />}
        {usedWorker != null && (
          <span className={cn('tabular-nums', usedWorker ? 'text-green-600' : 'text-amber-600')}>
            {usedWorker ? 'worker' : 'main thread'}
          </span>
        )}
        {path && (
          <span className={cn('tabular-nums', path === 'dual-hero-fallback-single' ? 'text-amber-600' : 'text-foreground/70')}>
            {path}
          </span>
        )}
        {candidateCount != null && (
          <span className="text-foreground/70 tabular-nums">{candidateCount} candidates</span>
        )}
        {photoCount != null && heroCount != null && (
          <span className="text-muted-foreground/60 tabular-nums">{photoCount} photos ({heroCount}h)</span>
        )}
      </div>
    </div>
  );
}

export function LayoutInfoPanel({ meta, reason, details }: LayoutInfoPanelProps) {
  // V4 metadata display
  if (meta && (meta as { template?: unknown }).template !== undefined) {
    const {
      template, targetCanvasAR, actualCanvasAR, arDeviation,
      areaFrac, heroCoverage, heroAR, hero2AR, prominenceRatio, score, corner,
      candidateCount, regionSizes, regionTargetRows, regionActualRows,
      besideWidth, belowHeight, penalties, photoCountScaleFactor, photoCount,
    } = meta as {
      template: string; targetCanvasAR: number; actualCanvasAR: number;
      arDeviation: number; areaFrac: number; heroCoverage: number;
      heroAR: number; hero2AR?: number; prominenceRatio: number; score: number; corner: string;
      candidateCount: number; regionSizes: number[];
      regionTargetRows: number[]; regionActualRows: number[];
      besideWidth: number; belowHeight: number;
      penalties?: { ar: number; coverage: number; prominence: number };
      photoCountScaleFactor?: number; photoCount?: number;
    };

    return (
      <div className="mt-3 p-3 bg-muted/50 border border-border rounded-lg">
        <div className="flex items-center gap-1.5 text-muted-foreground text-sm font-medium mb-2">
          <Info className="h-4 w-4" />
          Layout Info
        </div>
        <div className="text-xs text-muted-foreground/80 font-mono space-y-0.5">
          <PerfSection meta={meta} />
          <div>template: {template} ({corner})</div>
          <div className="mt-1">
            target area fraction: {areaFrac.toFixed(3)}
            <span className="text-muted-foreground/50 ml-1">
              [hero % of canvas used for photo split planning]
            </span>
          </div>
          {photoCountScaleFactor != null && (
            <div className={cn('mt-1', photoCountScaleFactor < 1.0 ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-muted-foreground/50')}>
              photo count scale: {photoCountScaleFactor.toFixed(2)} ({photoCount ?? '?'} photos)
              <div className="ml-2 text-[10px] font-normal text-muted-foreground/50">
                [1.0 = no tapering (≤20 photos); lower = hero claims less area &amp; prominence.
                {' '}Formula: clamp(20 / photoCount, 0.55, 1.0)]
              </div>
            </div>
          )}
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
