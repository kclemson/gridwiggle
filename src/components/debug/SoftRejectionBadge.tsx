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
  return (
    <div className="mt-3 p-4 bg-amber-500/20 border-2 border-amber-500 rounded-lg">
      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-lg">
        <AlertTriangle className="h-5 w-5" />
        SOFT REJECTION: {reason.replace(/_/g, ' ')}
      </div>
      <div className="mt-2 text-sm text-amber-600/80 dark:text-amber-400/80 font-mono">
        {Object.entries(details).map(([k, v]) => (
          <div key={k}>
            {k}: {typeof v === 'number' ? v.toFixed(3) : typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </div>
        ))}
      </div>
    </div>
  );
}
