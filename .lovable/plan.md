
# Fix: Capture Rejected Layouts for Non-Hero (Simple Rows) Path

## The Problem

When a non-hero layout fails canvas AR validation, the code returns `null` without calling `setRejectedLayout()`. This means:
1. The layout cells are computed (line 573)
2. AR validation fails (line 589) 
3. But no rejected layout is stored for visualization

The hero path properly captures rejected layouts before every `return null`, but the simple rows path was never updated to do the same.

## The Fix

**File:** `src/lib/v3/intersection.ts` (lines 589-596)

Add `setRejectedLayout()` call before returning null when canvas AR validation fails:

```typescript
// Validate canvas AR bounds
if (canvasAR < tuning.canvas_minAR || canvasAR > tuning.canvas_maxAR) {
  // NEW: Capture rejected layout for visualization
  setRejectedLayout({
    cells,
    canvasWidth,
    canvasHeight,
    reason: canvasAR < tuning.canvas_minAR ? 'canvas_too_tall' : 'canvas_too_wide',
    details: { 
      canvasAR: +canvasAR.toFixed(2), 
      minAR: tuning.canvas_minAR,
      maxAR: tuning.canvas_maxAR,
    },
    timestamp: Date.now(),
  });
  
  devLogger.log('layout', 'Simple rows layout outside AR bounds', {
    canvasAR: canvasAR.toFixed(2),
    minAR: tuning.canvas_minAR,
    maxAR: tuning.canvas_maxAR,
  });
  return null;
}
```

## Technical Details

| Aspect | Details |
|--------|---------|
| File | `src/lib/v3/intersection.ts` |
| Function | `generateSimpleRowsLayout` |
| Lines | 589-596 |
| Change | Add `setRejectedLayout()` call before `return null` |
| Impact | Non-hero rejected layouts will now display in V3Test visualization |

The cells are already computed at line 573, so we have all the data needed - we just need to store it.
