/**
 * SoftRejectionBadge Component
 * 
 * Displays soft rejection reason and metrics for layouts that are geometrically valid
 * but fall outside aesthetic bounds (e.g., canvas AR too tall/wide).
 * Dev-only component - not shown in production.
 */

import { AlertTriangle } from 'lucide-react';

interface SoftRejectionBadgeProps {
  reason: string;
  details: Record<string, unknown>;
}

export function SoftRejectionBadge({ reason, details }: SoftRejectionBadgeProps) {
  // Extract belowConstraints for inline display (same as RejectionBadge)
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
    <div className="mt-3 p-4 bg-amber-500/20 border-2 border-amber-500 rounded-lg">
      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-lg">
        <AlertTriangle className="h-5 w-5" />
        SOFT REJECTION: {reason.replace(/_/g, ' ')}
      </div>
      <div className="mt-2 text-sm text-amber-600/80 dark:text-amber-400/80 font-mono">
        {displayEntries.map(([k, v]) => {
          // Special handling for belowRowCount - append constraints inline
          if (k === 'belowRowCount' && belowConstraints) {
            const { maxRowsByMinAR, minRowsByMaxAR, minRowsByCellSize, targetWidth } = belowConstraints;
            return (
              <div key={k}>
                {k}: {String(v)}
                <span className="text-amber-600/60 dark:text-amber-400/60 ml-2">
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
