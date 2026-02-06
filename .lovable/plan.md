

# Add Edge Mode Visibility Logging

## Changes Overview

Add logging at two key points to make it clear which proposals are being generated and when edge/floating modes fall back to corner decomposition.

---

## File 1: `src/lib/v3/intersection.ts`

Add a summary log after generating proposals, before the evaluation loop.

**After line 62, add:**
```typescript
// Log all proposals that will be evaluated
const proposalSummary = proposals.map(p => `${p.mode}:${p.position}`).join(', ');
devLogger.log('v3', 'Proposals generated', {
  count: proposals.length,
  contentCount: contentStats.count,
  proposals: proposalSummary,
  edgeThreshold: tuning.decomp_edgeMinPhotos,
  floatingThreshold: tuning.decomp_floatingMinPhotos,
});
```

This will output something like:
```
[v3] Proposals generated {
  count: 4,
  contentCount: 16,
  proposals: "corner:top-left, corner:top-right, edge:left, edge:right",
  edgeThreshold: 8,
  floatingThreshold: 15
}
```

---

## File 2: `src/lib/v3/entities/canvas.ts`

Add logging when edge/floating modes fall back to corner decomposition.

**In `decomposeCanvas` function, update the switch statement (around lines 43-50):**

```typescript
case 'edge':
  devLogger.log('v3', 'Edge mode fallback', {
    position,
    reason: 'Edge decomposition not yet implemented, using corner',
  });
  return decomposeCorner(canvasWidth, heroRect, gap, tuning, position);
case 'floating':
  devLogger.log('v3', 'Floating mode fallback', {
    position,
    reason: 'Floating decomposition not yet implemented, using corner',
  });
  return decomposeCorner(canvasWidth, heroRect, gap, tuning, position);
```

This will make it explicit in the debug panel that edge proposals ARE being evaluated but are falling back to corner logic.

---

## Expected Debug Output After Fix

When you shuffle with 17 photos, you should see:

```
[v3] Proposals generated { count: 4, proposals: "corner:top-left, corner:top-right, edge:left, edge:right", ... }
[v3] Evaluating proposal { mode: "corner", position: "top-left", ... }
[v3] Proposal accepted { mode: "corner", position: "top-left", ... }
[v3] Evaluating proposal { mode: "corner", position: "top-right", ... }
[v3] Proposal accepted { mode: "corner", position: "top-right", ... }
[v3] Evaluating proposal { mode: "edge", position: "left", ... }
[v3] Edge mode fallback { position: "left", reason: "Edge decomposition not yet implemented..." }
[v3] Proposal accepted { mode: "edge", position: "left", ... }
[v3] Evaluating proposal { mode: "edge", position: "right", ... }
[v3] Edge mode fallback { position: "right", reason: "Edge decomposition not yet implemented..." }
[v3] Proposal accepted { mode: "edge", position: "right", ... }
```

---

## Files to Change

| File | Change |
|------|--------|
| `src/lib/v3/intersection.ts` | Add "Proposals generated" log after line 62 |
| `src/lib/v3/entities/canvas.ts` | Add fallback logs in edge/floating switch cases + import devLogger |

