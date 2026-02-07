

# Fix: Spinner Not Animating During Generation

## The Problem

The spinner appears but doesn't animate. This is because the **main thread is blocked** during layout generation, preventing CSS animation frames from running.

### What's Happening Now

```text
1. Click refresh → setIsGenerating(true)
2. setTimeout(0) queues the work
3. React paints the spinner (frame 1 - static)
4. Layout algorithm runs synchronously (~10-50ms)
   ⚠️ Main thread BLOCKED - no animation frames possible
5. setIsGenerating(false) → spinner disappears
```

The spinner only exists for one paint frame before the thread blocks, so you never see it move.

## The Solution

Add a **small delay before starting the blocking work** to give the browser time to:
1. Paint the spinner
2. Start the CSS animation
3. Run at least 1-2 animation frames

Then the user sees motion before the freeze, which feels much more responsive.

## Technical Changes

### File: `src/pages/Index.tsx`

Change the setTimeout delay from 0ms to ~50ms:

```typescript
// Current (line ~125-130):
setIsGenerating(true);
setTimeout(() => {
  // ... layout generation
}, 0);

// After:
setIsGenerating(true);
setTimeout(() => {
  // ... layout generation
}, 50);  // Allow 2-3 animation frames before blocking
```

### Why 50ms?

- CSS animations run at 60fps = ~16.7ms per frame
- 50ms gives the browser 2-3 frames to show spinner motion
- Still feels instant (50ms is below human perception threshold for "delay")
- The total time is still fast: 50ms wait + 10-50ms generation = 60-100ms total

### Alternative: Web Worker (Future Enhancement)

For truly non-blocking generation, we could move the layout algorithm to a Web Worker. This would allow the spinner to animate continuously. However, this is a larger refactor and the 50ms delay is sufficient for now.

## Summary

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Change `setTimeout(..., 0)` to `setTimeout(..., 50)` in `regenerateCollage` |

This is a 1-character fix that makes the spinner visibly animate before the layout generation blocks the thread.

