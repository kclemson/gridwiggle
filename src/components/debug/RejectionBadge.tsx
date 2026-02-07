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
    <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
      <div className="flex items-center gap-2 text-destructive font-medium">
        <AlertTriangle className="h-4 w-4" />
        Rejected: {reason.replace(/_/g, ' ')}
      </div>
      <div className="mt-1 text-sm text-destructive/80 font-mono">
        {Object.entries(details).map(([k, v]) => (
          <div key={k}>{k}: {JSON.stringify(v)}</div>
        ))}
      </div>
    </div>
  );
}
