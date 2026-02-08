
# iOS Safari Memory Crash Fix: Garbage Collection Delay Between Photos

## The Problem

You're seeing:
1. **Long processing time** between photo 1 and 2 (single-threaded mode is working but slower)
2. **Crash on photo 2** (memory isn't being released between photos)

The current flow in `processSmartCrops` runs a tight sequential loop:

```text
for (const photo of photos) {
  await getSmartCrop(...);  // Photo 1 - memory allocated
  // No break - immediately starts photo 2
  await getSmartCrop(...);  // Photo 2 - MORE memory allocated, CRASH
}
```

iOS Safari's JavaScript engine doesn't get a chance to garbage collect between photos. The single-threading fix reduced peak memory per photo, but without GC pauses, memory accumulates across photos.

## The Solution

Add a deliberate pause between photos to allow garbage collection. This is a documented pattern for memory-intensive browser operations.

---

## Implementation

### File: `src/pages/Index.tsx`

Add a GC delay function and call it between photos:

```typescript
// Helper to give browser time to garbage collect between heavy operations
const gcDelay = () => new Promise(resolve => setTimeout(resolve, 100));

// Inside processSmartCrops, after each photo completes:
for (const photo of photos) {
  // ... existing processing code ...
  
  completed++;
  setSmartCropProgress((completed / total) * 100);
  
  // Give browser time to GC between photos (critical for iOS Safari)
  if (completed < total) {
    await gcDelay();
  }
}
```

### Why 100ms?

- Short enough that users won't notice (100ms × 4 photos = 400ms extra)
- Long enough for a GC cycle to run (Safari typically needs 50-100ms)
- Matches the pattern used in the existing ThumbnailNavigator batch loading

---

## Changes Summary

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Add `gcDelay()` call between photo processing iterations |

---

## Technical Context

This follows the architecture pattern documented in your memory: "memory-safe-processing" - processing in small batches with GC delays. The current code processes photos sequentially but without the delay component.

The delay works because:
1. `setTimeout` yields to the event loop
2. This allows Safari's GC to run
3. Memory from photo 1 is released before photo 2 starts

---

## Expected Outcome

After implementation:
- Photo 1 completes → 100ms pause → Photo 2 starts (with freed memory)
- All 4 photos complete without crashing
- Total extra time: ~300ms (imperceptible to users)
