

## Improve V3 Debug Log Scannability

### Design Intent
Make failure cases stand out visually in both the browser console and the V3Test UI logs, while reducing log noise from repetitive packing operations.

### User Outcomes
- Failure logs will use `[layout-reject]` category and appear in red in the UI
- Console logs will use `console.warn` for rejections, making them visually distinct in DevTools
- Fewer logs to scroll through by consolidating repetitive row-packing logs
- Faster debugging cycles when iterating on V3 algorithm

---

## Changes

### Part 1: Reduce Log Noise

#### File: `src/lib/v3/utils.ts`

Remove or consolidate these logs in `distributeByARBudget`:
- **Remove**: "Starting AR-budget distribution" (line 175-181) - the input params are already visible in region-level logs
- **Remove**: "After greedy packing" (line 214-218) - intermediate state, covered by final
- **Keep**: "Final distribution" but simplify it
- **Remove**: "Height validation" (line 250-254) - intermediate validation step
- **Remove**: "Merged row with previous/next" (lines 284-287, 295-298) - low-level detail

This reduces 5-6 logs per packing attempt down to 1.

#### File: `src/lib/v3/row-pack.ts`

- **Remove**: "Row count selection" (line 285-292) - rarely needed for debugging failures

---

### Part 2: Distinguish Failure Logs

#### File: `src/lib/devLogger.ts`

Add a new `level` field to `LogEntry` and update the logger:

```typescript
export interface LogEntry {
  timestamp: number;
  category: string;
  label: string;
  data: Record<string, unknown>;
  level?: 'info' | 'warn' | 'error';  // NEW
}

export const devLogger = {
  log(category: string, label: string, data: Record<string, unknown> = {}, level: 'info' | 'warn' | 'error' = 'info') {
    if (!isDev) return;
    
    // Use appropriate console method based on level
    const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    consoleMethod(`[${category}] ${label}`, data);
    
    logs.push({ timestamp: Date.now(), category, label, data, level });
  },

  // Convenience methods
  warn(category: string, label: string, data: Record<string, unknown> = {}) {
    this.log(category, label, data, 'warn');
  },

  error(category: string, label: string, data: Record<string, unknown> = {}) {
    this.log(category, label, data, 'error');
  },
  
  // ...existing clear() and getLogs()
};
```

#### File: `src/lib/v3/intersection.ts`

Change these failure logs from `devLogger.log` to `devLogger.warn` with a distinct category:

| Current | New |
|---------|-----|
| `devLogger.log('layout', 'Canvas too tall', ...)` | `devLogger.warn('layout-reject', 'Canvas too tall', ...)` |
| `devLogger.log('layout', 'Canvas too wide', ...)` | `devLogger.warn('layout-reject', 'Canvas too wide', ...)` |
| `devLogger.log('layout', 'Prominence too low', ...)` | `devLogger.warn('layout-reject', 'Prominence too low', ...)` |
| `devLogger.log('layout', 'Hero too large vs smallest cells', ...)` | `devLogger.warn('layout-reject', 'Hero too large vs smallest cells', ...)` |
| `devLogger.log('layout', 'No valid configurations found')` | `devLogger.warn('layout-reject', 'No valid configurations found')` |
| `devLogger.log('layout', 'No valid region assignment found for proposal', ...)` | `devLogger.warn('layout-reject', 'No valid region assignment', ...)` |

#### File: `src/lib/v3/region-search.ts`

Same pattern for region rejections:

| Current | New |
|---------|-----|
| `devLogger.log('region', 'Assignment rejected...')` | `devLogger.warn('region-reject', 'Assignment rejected...', ...)` |
| `devLogger.log('region', 'No valid assignment found')` | `devLogger.warn('region-reject', 'No valid assignment found')` |

---

### Part 3: UI Conditional Formatting

#### File: `src/pages/V3Test.tsx`

Update the log entry rendering to apply red styling for warn/error levels:

```tsx
logs.map((entry, idx) => {
  const isReject = entry.level === 'warn' || entry.level === 'error' 
    || entry.category.includes('reject');
  
  return (
    <div key={idx} className="grid grid-cols-[260px_1fr] gap-2">
      <div className="flex gap-1 min-w-0">
        <span className={cn(
          "shrink-0",
          isReject ? "text-red-500" : "text-blue-500"
        )}>
          [{entry.category}]
        </span>
        <span className={cn(
          "break-words min-w-0",
          isReject ? "text-red-400" : "text-foreground"
        )}>
          {entry.label}
        </span>
      </div>
      {Object.keys(entry.data).length > 0 && (
        <span className={cn(
          "break-all",
          isReject ? "text-red-400/70" : "text-muted-foreground"
        )}>
          {formatLogData(entry.data)}
        </span>
      )}
    </div>
  );
})
```

---

## Summary

| Area | Before | After |
|------|--------|-------|
| Logs per pack operation | 5-6 | 1 |
| Failure category | `[layout]` | `[layout-reject]` or `[region-reject]` |
| Console output | All `console.log` | Failures use `console.warn` |
| UI styling | All blue | Rejections in red |

---

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/devLogger.ts` | Add `level` field and `warn()`/`error()` methods |
| `src/lib/v3/utils.ts` | Remove 5 redundant logs from AR-budget distribution |
| `src/lib/v3/row-pack.ts` | Remove 1 redundant "Row count selection" log |
| `src/lib/v3/intersection.ts` | Change 6 failure logs to `devLogger.warn('layout-reject', ...)` |
| `src/lib/v3/region-search.ts` | Change 2+ rejection logs to `devLogger.warn('region-reject', ...)` |
| `src/pages/V3Test.tsx` | Add conditional red styling for reject/warn entries |

