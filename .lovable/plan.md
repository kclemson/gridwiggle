
# Add Spinner to Photos Header During Processing

## Design Intent

When photos are processing, users should see activity indication even in the collapsed state. Moving the spinner from the photo thumbnail to the header makes the "working" status visible at all times.

## User Experience

**Before**: Spinner only visible on photo thumbnail when expanded
**After**: Spinner appears in the header next to "X of Y ready" - visible whether collapsed or expanded

## Technical Changes

### 1. File: `src/pages/Index.tsx`

**Add spinner to header during processing** (around lines 437-443):

```tsx
// Current:
{isProcessing ? (
  <>
    Photos
    <span className="mx-2 text-muted-foreground/50">·</span>
    <span className="text-emerald-600 normal-case tracking-normal">
      {state.photos.filter(p => !p.isProcessing && !p.error).length} of {state.photos.length} ready
    </span>

// After:
{isProcessing ? (
  <>
    Photos
    <span className="mx-2 text-muted-foreground/50">·</span>
    <Loader2 className="inline h-3 w-3 animate-spin text-muted-foreground" />
    <span className="ml-1.5 text-emerald-600 normal-case tracking-normal">
      {state.photos.filter(p => !p.isProcessing && !p.error).length} of {state.photos.length} ready
    </span>
```

This places a small spinner between the dot separator and the progress count.

### 2. File: `src/components/PhotoProcessingView.tsx`

**Remove spinner overlay from photo thumbnail** (lines 38-41):

```tsx
// Remove this block:
{/* Spinner overlay */}
<div className="absolute inset-0 flex items-center justify-center bg-black/40">
  <Loader2 className="h-8 w-8 text-white animate-spin" />
</div>
```

The photo thumbnail will now display without the dark overlay and spinner, showing the image clearly while the header spinner indicates activity.

## Visual Result

**Header (collapsed or expanded)**:
```
Photos · ◌ 2 of 5 ready
         ↑ spinner here
```

**Photo thumbnail**: Clean image without spinner overlay

## Summary

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Add `Loader2` spinner to header between separator and "X of Y ready" |
| `src/components/PhotoProcessingView.tsx` | Remove spinner overlay from photo thumbnail |
