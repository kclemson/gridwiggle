/**
 * LayoutInfoPanel Component
 * 
 * Displays layout information and metrics for layouts that are geometrically valid
 * but fall outside aesthetic bounds (e.g., canvas AR too tall/wide).
 * Dev-only component - not shown in production.
 */

import { Info } from 'lucide-react';

interface LayoutInfoPanelProps {
  reason: string;
  details: Record<string, unknown>;
}

export function LayoutInfoPanel({ reason, details }: LayoutInfoPanelProps) {
  // Extract belowConstraints for inline display
  const belowConstraints = details.belowConstraints as {
    maxRowsByMinAR: number;
    minRowsByMaxAR: number;
    minRowsByCellSize: number;
    targetWidth: number;
  } | undefined;
  
  // Filter out belowConstraints from main display
  const displayEntries = Object.entries(details).filter(
    ([k]) => k !== 'belowConstraints'
  );
  
  return (
    <div className="mt-3 p-3 bg-muted/50 border border-border rounded-lg">
      <div className="flex items-center gap-1.5 text-muted-foreground text-sm font-medium mb-2">
        <Info className="h-4 w-4" />
        Layout Info
      </div>
      <div className="text-xs text-muted-foreground/80 font-mono space-y-0.5">
        <div>reason: {reason.replace(/_/g, ' ')}</div>
        {displayEntries.map(([k, v]) => {
          // Special handling for belowRowCount - append constraints inline
          if (k === 'belowRowCount' && belowConstraints) {
            const { maxRowsByMinAR, minRowsByMaxAR, minRowsByCellSize, targetWidth } = belowConstraints;
            return (
              <div key={k}>
                {k}: {String(v)}
                <span className="text-muted-foreground/60 ml-2">
                  [h≤{maxRowsByMinAR} w≥{minRowsByMaxAR} c≥{minRowsByCellSize} tw:{targetWidth.toFixed(2)}]
                </span>
              </div>
            );
          }
          
          // Default: simple string display
          return (
            <div key={k}>
              {k}: {typeof v === 'number' ? v.toFixed(3) : typeof v === 'object' ? JSON.stringify(v) : String(v)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
