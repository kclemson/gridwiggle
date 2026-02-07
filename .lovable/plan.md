
# Simplify Processing & Collage Generation UI

## What's Changing

1. **Remove "Processing Photos" header** - The purple wand icon + "Processing Photos" text is redundant since the spinning thumbnail and progress dots already communicate processing status clearly

2. **Remove "Generate Collage" button** - Collage auto-generates after photos finish processing. If generation fails with no existing layout, we'll show a simpler inline retry prompt instead of a full-width button

---

## Technical Details

### File 1: `src/components/PhotoProcessingView.tsx`

**Remove the header section** (lines 28-34):

Delete the "Processing Photos" title and wand icon. Keep just:
- Current photo thumbnail with spinner
- Stats row ("X ready", "Y failed")
- Processing queue dots

### File 2: `src/pages/Index.tsx`

**Replace Generate button with inline error state** (lines 465-473):

When there's no layout yet but 2+ photos, show:
- If no error: nothing (auto-generation will trigger)
- If error occurred: show a centered retry prompt with refresh icon (similar to existing error overlay style but for the "no layout yet" case)

Currently the flow is:
```
!state.layout ? <Button>Generate Collage</Button> : <CollagePreview />
```

Change to:
```
!state.layout ? (
  layoutError ? <RetryPrompt /> : null
) : (
  <CollagePreview />
)
```

This means after photos finish processing, if layout generation succeeds → collage appears. If it fails → error message with retry button appears.

---

## Summary

| File | Change |
|------|--------|
| `PhotoProcessingView.tsx` lines 28-34 | Delete "Processing Photos" header block |
| `Index.tsx` lines 465-473 | Replace Generate button with conditional error prompt |
