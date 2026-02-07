

## Fix DebugPanel: Reset Badge Update + Show Duration

### Design Intent
Fix two bugs in the main app's DebugPanel:
1. Reset button clears localStorage but badge doesn't update
2. Generation duration (ms) not displayed

### User Outcome
- Clicking reset immediately shows "0 pending" (badge disappears)
- Duration badge shows time taken for each layout generation

---

## Root Causes

| Bug | Why It Happens |
|-----|----------------|
| Reset doesn't update badge | `pendingCount` is read on render, but `clearCaptures()` doesn't trigger re-render |
| No duration shown | `result.durationMs` exists but isn't stored in state or passed to DebugPanel |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/DebugPanel.tsx` | Add `useState` for pendingCount so reset triggers re-render |
| `src/pages/Index.tsx` | Add `lastDurationMs` state, store result.durationMs, pass to DebugPanel |

---

## Technical Details

### 1. DebugPanel.tsx - Use State for Pending Count

```typescript
export function DebugPanel({ 
  logs, 
  durationMs,
}: DebugPanelProps) {
  // Track pending count in state so we can force re-render on reset
  const [pendingCount, setPendingCount] = useState(() => getCaptureStats().pending);

  const handleExport = useCallback(() => {
    const { data, count } = exportPendingCaptures();
    if (count === 0) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadJson(data, `v3-captures-${timestamp}.json`);
    setPendingCount(0);  // Update state to trigger re-render
  }, []);

  const handleReset = useCallback(() => {
    clearCaptures();
    setPendingCount(0);  // Update state to trigger re-render
  }, []);

  // ... rest unchanged
}
```

### 2. Index.tsx - Store and Pass durationMs

Add state near other layout state:
```typescript
const [lastDurationMs, setLastDurationMs] = useState<number | undefined>(undefined);
```

Store after worker returns result:
```typescript
// After result handling
setLastDurationMs(result.durationMs);
```

Pass to DebugPanel:
```typescript
<DebugPanel 
  logs={debugLogs}
  durationMs={lastDurationMs}
/>
```

---

## Behavior After Fix

| Action | Result |
|--------|--------|
| Generate layout | Badge shows "X pending", duration shows "Y.Yms" |
| Click Reset | Badge immediately disappears (0 pending) |
| Click Export | Badge resets to 0, JSON downloads |

