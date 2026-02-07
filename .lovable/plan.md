

## Extract Shared Debug Log Component

### Design Intent
Create a shared, reusable debug log component that both V3Test and the main app can import, eliminating code duplication and ensuring consistent debugging UX.

### User Outcome
Same high-quality debug logs in the main app as V3Test - color-coded categories, flattened key:value format, efficiency badges - with a single source of truth.

---

## Components to Extract

From `src/pages/V3Test.tsx`, extract to `src/components/debug/DebugLogPanel.tsx`:

| Current Location | New Shared Component |
|-----------------|---------------------|
| `formatLogData()` function | Stays in shared component |
| `LogCountBadge` component | Exported from shared |
| `DurationBadge` component | Exported from shared |
| Log display JSX (lines 357-415) | `DebugLogPanel` component |

---

## New File Structure

```text
src/components/debug/
├── DebugLogPanel.tsx      # Main shared component
└── index.ts               # Re-exports
```

---

## DebugLogPanel Props

```typescript
interface DebugLogPanelProps {
  logs: LogEntry[];
  durationMs?: number;
  className?: string;
  
  // Optional header content (for v1/v3 toggle, etc.)
  headerRight?: React.ReactNode;
  
  // Scroll area height (V3Test uses 70vh, main app uses 100vh-120px)
  maxHeight?: string;
}
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/debug/DebugLogPanel.tsx` | **CREATE** - Extract shared component |
| `src/components/debug/index.ts` | **CREATE** - Re-exports |
| `src/pages/V3Test.tsx` | **MODIFY** - Import shared component |
| `src/components/DebugPanel.tsx` | **MODIFY** - Replace log display with shared component, remove tuning UI |
| `src/pages/Index.tsx` | **MODIFY** - Remove tuning props from DebugPanel |

---

## Technical Details

### 1. DebugLogPanel.tsx (New Shared Component)

```typescript
import { ScrollArea } from '@/components/ui/scroll-area';
import { LogEntry } from '@/lib/devLogger';
import { extractReasonFrequencies } from '@/lib/v3CaptureStorage';
import { cn } from '@/lib/utils';

// Thresholds for efficiency indicators
const LOG_THRESHOLDS = { good: 30, warn: 80 };
const DURATION_THRESHOLDS = { good: 10, warn: 50 };

// Format log data: flatten nested objects, format numbers
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
  count, rejectCount, feasibilityCount 
}: { 
  count: number; rejectCount: number; feasibilityCount: number;
}) {
  const color = count <= LOG_THRESHOLDS.good ? 'text-green-600' 
    : count <= LOG_THRESHOLDS.warn ? 'text-amber-600' 
    : 'text-red-600';
  
  return (
    <span className={cn("tabular-nums", color)}>
      {count} logs
      {(rejectCount > 0 || feasibilityCount > 0) && (
        <span className="text-muted-foreground ml-1">
          ({rejectCount > 0 && <span className="text-red-500">{rejectCount} rej</span>}
          {rejectCount > 0 && feasibilityCount > 0 && ', '}
          {feasibilityCount > 0 && <span className="text-amber-500">{feasibilityCount} feas</span>})
        </span>
      )}
    </span>
  );
}

export function DurationBadge({ durationMs }: { durationMs: number }) {
  const color = durationMs <= DURATION_THRESHOLDS.good ? 'text-green-600' 
    : durationMs <= DURATION_THRESHOLDS.warn ? 'text-amber-600' 
    : 'text-red-600';
  
  return (
    <span className={cn("tabular-nums", color)}>{durationMs.toFixed(1)}ms</span>
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
                    <span className={cn("shrink-0",
                      isReject ? "text-red-500" 
                        : isFeasibility ? "text-amber-500" 
                        : "text-blue-500"
                    )}>
                      [{entry.category}]
                    </span>
                    <span className={cn("break-words min-w-0",
                      isReject ? "text-red-400" 
                        : isFeasibility ? "text-amber-400" 
                        : "text-foreground"
                    )}>
                      {entry.label}
                    </span>
                  </div>
                  {Object.keys(entry.data).length > 0 && (
                    <span className={cn("break-all",
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
```

### 2. Update DebugPanel.tsx

Simplify to just wrap the shared component with v1/v3 toggle:

```typescript
import { LogEntry } from '@/lib/devLogger';
import { DebugLogPanel } from '@/components/debug/DebugLogPanel';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export type AlgorithmVersion = 'v1' | 'v3';

interface DebugPanelProps {
  logs: LogEntry[];
  durationMs?: number;
  algorithmVersion: AlgorithmVersion;
  onAlgorithmVersionChange: (version: AlgorithmVersion) => void;
}

export function DebugPanel({ 
  logs, 
  durationMs,
  algorithmVersion,
  onAlgorithmVersionChange,
}: DebugPanelProps) {
  const versionToggle = (
    <ToggleGroup 
      type="single" 
      value={algorithmVersion} 
      onValueChange={(value) => value && onAlgorithmVersionChange(value as AlgorithmVersion)}
      size="sm"
    >
      <ToggleGroupItem value="v1" className="text-xs font-mono px-2 h-6">v1</ToggleGroupItem>
      <ToggleGroupItem 
        value="v3" 
        className="text-xs font-mono px-2 h-6 data-[state=on]:bg-amber-500/20 data-[state=on]:text-amber-600"
      >
        v3
      </ToggleGroupItem>
    </ToggleGroup>
  );

  return (
    <DebugLogPanel 
      logs={logs}
      durationMs={durationMs}
      headerRight={versionToggle}
    />
  );
}
```

### 3. Update V3Test.tsx

Replace inline log rendering with shared component:

```typescript
// Replace lines 357-415 with:
<DebugLogPanel 
  logs={logs}
  durationMs={durationMs}
  maxHeight="70vh"
/>
```

### 4. Update Index.tsx

Remove tuning props, add durationMs tracking:

```typescript
// Remove: handleV3TuningChange callback
// Keep: v3Tuning state (still passed to worker)

<DebugPanel 
  logs={debugLogs}
  durationMs={generationDurationMs}  // Track from worker result
  algorithmVersion={algorithmVersion}
  onAlgorithmVersionChange={setAlgorithmVersion}
/>
```

Note: Need to track `durationMs` from worker result. The worker already returns it - just need to store it in state.

---

## Changes Summary

| File | Lines Changed |
|------|---------------|
| `src/components/debug/DebugLogPanel.tsx` | +120 (new) |
| `src/components/debug/index.ts` | +3 (new) |
| `src/pages/V3Test.tsx` | -80, +5 (import + use shared) |
| `src/components/DebugPanel.tsx` | -100, +35 (simplified) |
| `src/pages/Index.tsx` | -10, +8 (remove tuning, add duration) |

