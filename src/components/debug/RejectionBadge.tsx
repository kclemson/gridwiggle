/**
 * RejectionBadge Component
 * 
 * Displays rejection reason and detailed metrics for failed layouts.
 * Used in LayoutTest to visualize why a layout was rejected.
 */

import { AlertTriangle } from 'lucide-react';

interface RejectionBadgeProps {
  reason: string;
  details: Record<string, unknown>;
}

export function RejectionBadge({ reason, details }: RejectionBadgeProps) {
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
    <div className="mt-3 p-4 bg-destructive/20 border-2 border-destructive rounded-lg">
      <div className="flex items-center gap-2 text-destructive font-bold text-lg">
        <AlertTriangle className="h-5 w-5" />
        REJECTED: {reason.replace(/_/g, ' ')}
      </div>
      <div className="mt-2 text-sm text-destructive/80 font-mono">
        {displayEntries.map(([k, v]) => {
          // Special handling for belowRowCount - append constraints inline
          if (k === 'belowRowCount' && belowConstraints) {
            const { maxRowsByMinAR, minRowsByMaxAR, minRowsByCellSize, targetWidth } = belowConstraints;
            return (
              <div key={k}>
                {k}: {String(v)}
                <span className="text-destructive/60 ml-2">
                  [h≤{maxRowsByMinAR} w≥{minRowsByMaxAR} c≥{minRowsByCellSize} tw:{targetWidth.toFixed(2)}]
                </span>
              </div>
            );
          }
          
          // Default: simple string display
          return (
            <div key={k}>
              {k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
