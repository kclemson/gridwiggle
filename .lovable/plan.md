
# Fix: Rejection UI Not Rendering

## Problem

The rejection visualization (red ring + RejectionBadge) never appears when:
1. A previous layout generation succeeded (so `state.layout` is truthy)
2. A new generation attempt fails with a `rejectedLayout`

The render logic at line 669 is:
```tsx
{state.layout ? <CollagePreview> : rejectedLayout ? <RejectionUI> : ...}
```

Since `state.layout` remains truthy, the rejection branch is never reached.

## Solution

When we have a rejected layout geometry to visualize, **clear `state.layout`** so the rejection UI can render.

## File Change

**`src/pages/Index.tsx`** - Lines 260-285

Current:
```typescript
if (result.rejectedLayout) {
  const SCALE = 1000;
  setRejectedLayout({
    cells: result.rejectedLayout.cells.map(c => ({...})),
    canvasWidth: Math.round(result.rejectedLayout.canvasWidth * SCALE),
    canvasHeight: Math.round(result.rejectedLayout.canvasHeight * SCALE),
    reason: result.rejectedLayout.reason,
    details: result.rejectedLayout.details,
  });
} else {
  setRejectedLayout(null);
}

if (state.layout) {
  setLayoutError("Couldn't generate a new layout...");
} else {
  setLayout(null);
  setLayoutError("Couldn't generate a layout...");
}
```

Fixed:
```typescript
if (result.rejectedLayout) {
  const SCALE = 1000;
  setRejectedLayout({
    cells: result.rejectedLayout.cells.map(c => ({...})),
    canvasWidth: Math.round(result.rejectedLayout.canvasWidth * SCALE),
    canvasHeight: Math.round(result.rejectedLayout.canvasHeight * SCALE),
    reason: result.rejectedLayout.reason,
    details: result.rejectedLayout.details,
  });
  // Clear layout so rejection visualization renders
  setLayout(null);
  setLayoutError("Layout rejected. Try shuffling or adjusting photos.");
} else {
  setRejectedLayout(null);
  if (state.layout) {
    // No geometry to show - keep old layout with error message
    setLayoutError("Couldn't generate a new layout. Try shuffling or adjusting photos.");
  } else {
    setLayout(null);
    setLayoutError("Couldn't generate a layout with these photos.");
  }
}
```

## Behavior After Fix

| Scenario | Current | After Fix |
|----------|---------|-----------|
| First generation fails with geometry | Shows nothing | Red rejection UI |
| Shuffle fails with geometry | Shows old layout | Red rejection UI |
| Generation fails, no geometry | Shows error text | Same (no change) |

The key insight: we only clear the layout when we have a rejected geometry to show. If generation fails without geometry data, we keep the old layout visible (better UX than blank screen).
