

## Add Efficiency Metrics to Debug Logs Header

### Design Intent
Show at-a-glance health indicators for the layout algorithm run:
1. **Log count** — High counts indicate redundant codepaths or excessive branching
2. **Duration** — Slow runs help identify performance bottlenecks

Color thresholds make it immediately obvious when something needs investigation.

### User Outcomes
- Green/yellow/red coloring on log count and duration
- Quick visual indicator: "is this run healthy or inefficient?"
- Both metrics shown together so you can correlate (e.g., high logs + slow = definitely a problem)

---

## Changes

### 1. V3Test.tsx — Capture timing

Wrap layout generation with `performance.now()`:

```typescript
// Generate layout
const { layout, durationMs } = useMemo(() => {
  devLogger.clear();
  const startTime = performance.now();
  
  // ... existing setup code ...
  
  const result = generateCollageLayoutV3(photoItems, settings, {
    photoWeights,
  });
  
  const durationMs = performance.now() - startTime;
  
  // Capture logs after generation
  setLogs(devLogger.getLogs());
  
  return { layout: result, durationMs };
}, [photoSet]);
```

Display in the header alongside log count:

```typescript
<div className="p-3 border-b font-medium text-sm flex items-center justify-between">
  <span>Debug Logs</span>
  <div className="flex items-center gap-3 font-mono text-xs">
    <LogCountBadge count={logs.length} />
    <DurationBadge durationMs={durationMs} />
  </div>
</div>
```

### 2. V3Test.tsx — Add badge components

Create small inline components with threshold-based coloring:

```typescript
// Thresholds for efficiency indicators
const LOG_THRESHOLDS = { good: 30, warn: 80 };     // < 30 green, 30-80 yellow, > 80 red
const DURATION_THRESHOLDS = { good: 10, warn: 50 }; // < 10ms green, 10-50ms yellow, > 50ms red

function LogCountBadge({ count }: { count: number }) {
  const color = count <= LOG_THRESHOLDS.good 
    ? 'text-green-600' 
    : count <= LOG_THRESHOLDS.warn 
      ? 'text-amber-600' 
      : 'text-red-600';
  
  return (
    <span className={cn("tabular-nums", color)}>
      {count} logs
    </span>
  );
}

function DurationBadge({ durationMs }: { durationMs: number }) {
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
```

---

## Threshold Rationale

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| Log count | ≤ 30 | 31-80 | > 80 |
| Duration | ≤ 10ms | 11-50ms | > 50ms |

These are initial guesses — we can tune them based on observed patterns. The key is having *any* visual signal that makes inefficiencies stand out.

---

## Files Modified

| File | Changes |
|------|---------|
| `src/pages/V3Test.tsx` | Add timing measurement, badge components, update header display |

