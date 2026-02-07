

## Add Feasibility Styling to V3Test.tsx

### Design Intent
Match the amber styling that DebugPanel.tsx uses for `feasibility` category logs, so they're visually distinct from search logs.

### User Outcome
Feasibility logs appear in amber instead of blue, making it immediately clear which logs are "early pruning" vs "actual search activity."

---

## Changes

### File: `src/pages/V3Test.tsx`

Update the log rendering (around lines 222-250) to detect feasibility category:

```typescript
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
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/pages/V3Test.tsx` | Add amber styling for `feasibility` category logs |

