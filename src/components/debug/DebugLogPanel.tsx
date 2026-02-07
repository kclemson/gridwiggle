/**
 * Shared Debug Log Panel Component
 * 
 * Color-coded, monospace log display with efficiency badges.
 * Used by both V3Test and main app DebugPanel.
 */

import { ScrollArea } from '@/components/ui/scroll-area';
import { LogEntry } from '@/lib/devLogger';
import { extractReasonFrequencies } from '@/lib/v3CaptureStorage';
import { cn } from '@/lib/utils';

// Thresholds for efficiency indicators
const LOG_THRESHOLDS = { good: 30, warn: 80 };
const DURATION_THRESHOLDS = { good: 10, warn: 50 };

/**
 * Format log data: flatten nested objects, format numbers as comma-separated key:value pairs.
 */
function formatLogData(data: Record<string, unknown>): string {
  const pairs: string[] = [];
  
  function flatten(obj: Record<string, unknown>, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}_${key}` : key;
      
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        flatten(value as Record<string, unknown>, fullKey);
      } else if (Array.isArray(value)) {
        const formatted = value.map(v => 
          typeof v === 'number' ? v.toFixed(2) : String(v)
        ).join(', ');
        pairs.push(`${fullKey}:[${formatted}]`);
      } else if (typeof value === 'number') {
        const formatted = Number.isInteger(value) ? value : value.toFixed(2);
        pairs.push(`${fullKey}:${formatted}`);
      } else {
        pairs.push(`${fullKey}:${value}`);
      }
    }
  }
  
  flatten(data);
  return pairs.join(', ');
}

export function LogCountBadge({ 
  count, 
  rejectCount, 
  feasibilityCount 
}: { 
  count: number; 
  rejectCount: number;
  feasibilityCount: number;
}) {
  const color = count <= LOG_THRESHOLDS.good 
    ? 'text-green-600' 
    : count <= LOG_THRESHOLDS.warn 
      ? 'text-amber-600' 
      : 'text-red-600';
  
  return (
    <span className={cn("tabular-nums", color)}>
      {count} logs
      {(rejectCount > 0 || feasibilityCount > 0) && (
        <span className="text-muted-foreground ml-1">
          (
          {rejectCount > 0 && <span className="text-red-500">{rejectCount} rej</span>}
          {rejectCount > 0 && feasibilityCount > 0 && ', '}
          {feasibilityCount > 0 && <span className="text-amber-500">{feasibilityCount} feas</span>}
          )
        </span>
      )}
    </span>
  );
}

export function DurationBadge({ durationMs }: { durationMs: number }) {
  const color = durationMs <= DURATION_THRESHOLDS.good 
    ? 'text-green-600' 
    : durationMs <= DURATION_THRESHOLDS.warn 
      ? 'text-amber-600' 
      : 'text-red-600';
  
  return (
    <span className={cn("tabular-nums", color)}>
      {durationMs.toFixed(1)}ms
    </span>
  );
}

interface DebugLogPanelProps {
  logs: LogEntry[];
  durationMs?: number;
  className?: string;
  headerRight?: React.ReactNode;
  maxHeight?: string;
}

export function DebugLogPanel({ 
  logs, 
  durationMs, 
  className,
  headerRight,
  maxHeight = 'calc(100vh - 120px)',
}: DebugLogPanelProps) {
  const logStats = extractReasonFrequencies(logs);
  
  return (
    <div className={cn("border rounded-lg bg-card overflow-hidden", className)}>
      {/* Header */}
      <div className="p-3 border-b font-medium text-sm flex items-center justify-between">
        <span>Debug Logs</span>
        <div className="flex items-center gap-3 font-mono text-xs">
          <LogCountBadge 
            count={logs.length} 
            rejectCount={logStats.rejectCount}
            feasibilityCount={logStats.feasibilityCount}
          />
          {durationMs !== undefined && <DurationBadge durationMs={durationMs} />}
          {headerRight}
        </div>
      </div>
      
      {/* Log entries */}
      <ScrollArea style={{ maxHeight }}>
        <div className="p-3 font-mono text-xs space-y-1">
          {logs.length === 0 ? (
            <div className="text-muted-foreground">No logs yet</div>
          ) : (
            logs.map((entry, idx) => {
              const isReject = entry.level === 'warn' || entry.level === 'error' 
                || entry.category.includes('reject');
              const isFeasibility = entry.category === 'feasibility';
              
              return (
                <div key={idx} className="grid grid-cols-[260px_1fr] gap-2">
                  <div className="flex gap-1 min-w-0">
                    <span className={cn(
                      "shrink-0",
                      isReject ? "text-red-500" 
                        : isFeasibility ? "text-amber-500" 
                        : "text-blue-500"
                    )}>
                      [{entry.category}]
                    </span>
                    <span className={cn(
                      "break-words min-w-0",
                      isReject ? "text-red-400" 
                        : isFeasibility ? "text-amber-400" 
                        : "text-foreground"
                    )}>
                      {entry.label}
                    </span>
                  </div>
                  {Object.keys(entry.data).length > 0 && (
                    <span className={cn(
                      "break-all",
                      isReject ? "text-red-400/70" 
                        : isFeasibility ? "text-amber-400/70" 
                        : "text-muted-foreground"
                    )}>
                      {formatLogData(entry.data)}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
