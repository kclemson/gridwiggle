

## Add Log Category Summary Stats to Header

### Design Intent
Provide at-a-glance visibility into how much of the algorithm's work is:
1. **Reject logs** — Branches that were tried and discarded
2. **Feasibility logs** — Early pruning checks that skip entire branches

This helps understand the "shape" of the search: lots of rejects = trying many things, lots of feasibility = smart pruning.

### User Outcome
The header stats area will show breakdown counts like:
```
47 logs (12 rejects, 8 feasibility) • 3.2ms
```

Quick visual of where the algorithm spent its effort without scrolling through logs.

---

## Changes

### File: `src/pages/V3Test.tsx`

**1. Compute summary stats from logs:**

Add a `useMemo` to derive counts from the logs array:

```typescript
const logStats = useMemo(() => {
  let rejectCount = 0;
  let feasibilityCount = 0;
  
  for (const entry of logs) {
    if (entry.level === 'warn' || entry.level === 'error' || entry.category.includes('reject')) {
      rejectCount++;
    } else if (entry.category === 'feasibility') {
      feasibilityCount++;
    }
  }
  
  return { rejectCount, feasibilityCount };
}, [logs]);
```

**2. Update header display:**

Modify the stats area to include breakdown inline with total count:

```typescript
<div className="flex items-center gap-3 font-mono text-xs">
  <LogCountBadge 
    count={logs.length} 
    rejectCount={logStats.rejectCount}
    feasibilityCount={logStats.feasibilityCount}
  />
  <DurationBadge durationMs={durationMs} />
</div>
```

**3. Update LogCountBadge to show breakdown:**

```typescript
function LogCountBadge({ 
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
```

---

## Visual Result

Before:
```
Debug Logs                     47 logs  3.2ms
```

After:
```
Debug Logs                     47 logs (12 rej, 8 feas)  3.2ms
```

The color coding matches the log colors:
- Red for reject count
- Amber for feasibility count
- Green/amber/red for total based on thresholds

---

## Files Modified

| File | Changes |
|------|---------|
| `src/pages/V3Test.tsx` | Add `logStats` memo, update `LogCountBadge` to show breakdown |

