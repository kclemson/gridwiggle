/**
 * RejectionBadge Component
 * 
 * Displays rejection reason and detailed metrics for failed layouts.
 * Used in V3Test to visualize why a layout was rejected.
 */

import { AlertTriangle } from 'lucide-react';

interface RejectionBadgeProps {
  reason: string;
  details: Record<string, unknown>;
}

export function RejectionBadge({ reason, details }: RejectionBadgeProps) {
  return (
    <div className="mt-3 p-4 bg-destructive/20 border-2 border-destructive rounded-lg">
      <div className="flex items-center gap-2 text-destructive font-bold text-lg">
        <AlertTriangle className="h-5 w-5" />
        REJECTED: {reason.replace(/_/g, ' ')}
      </div>
      <div className="mt-2 text-sm text-destructive/80 font-mono">
        {Object.entries(details).map(([k, v]) => (
          <div key={k}>{k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
        ))}
      </div>
    </div>
  );
}
