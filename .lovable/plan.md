

# Fix: Mobile Touch Interactions (Tap, Star Toggle, Hold-to-Drag)

## Problem
Two related issues on mobile:
1. Tapping a cell feels like a drag is beginning (native `draggable` attribute conflicts with touch)
2. Tapping the hero star icon doesn't work cleanly because the same native drag interference swallows the touch

## Design Intent
Three distinct gestures on mobile, each with a clear purpose:
- **Tap cell** -- opens crop editor
- **Tap star icon** -- toggles hero status (already wired with `stopPropagation`, just blocked by native drag)
- **Hold 300ms then move** -- drag to swap photos (existing hold-to-drag system)

Desktop behavior stays the same (native drag-and-drop + click).

## User Outcome
- Tapping a photo feels instant and opens the crop editor
- Tapping the star icon toggles hero on/off without opening the crop editor
- Hold-to-drag still works for rearranging photos
- No visual drag artifacts on tap

## Technical Changes

### File: `src/components/CollagePreview.tsx`

**1. Import platform helper**
Add `isMobileDevice` import at the top.

**2. CollageCellComponent -- disable native drag on mobile**
Compute `const mobile = isMobileDevice()` once inside the component, then:

- Set `draggable={!mobile}` so the browser doesn't hijack touches
- Remove `cursor-grab` / `active:cursor-grabbing` on mobile (irrelevant for touch)
- Keep all existing `onDragStart`, `onTouchStart`, `onClick` handlers unchanged

```tsx
const mobile = isMobileDevice();

<div
  ...
  draggable={!mobile}
  className={cn(
    "absolute overflow-hidden transition-all group",
    !mobile && "cursor-grab active:cursor-grabbing",
    isBeingDragged && "opacity-50 scale-95",
    isDragTarget && "ring-4 ring-primary ring-offset-2 ring-offset-background"
  )}
  ...
>
```

**3. Star button -- ensure touch events pass through correctly**
The existing `stopPropagation` on `onClick`, `onMouseDown`, and `onTouchStart` already isolates the star button from the cell's handlers. No changes needed here -- fixing the native `draggable` is sufficient.

### What does NOT change
- Desktop drag-and-drop (still uses native `draggable`)
- Mobile hold-to-drag (custom touch handlers with 300ms threshold)
- Star button markup or event handlers (already correctly isolated)
- Crop editor click handler (`onCellClick`)
- Touch drag preview overlay

### One file changed
`src/components/CollagePreview.tsx` only. Uses existing `isMobileDevice()` from `src/lib/platform.ts`.

