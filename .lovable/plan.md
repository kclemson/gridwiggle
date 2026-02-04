

## Fix: Make Collage Preview Respect Max Height Constraint

### Problem

The `CollagePreview` component uses `aspect-ratio` CSS which calculates height from width. A parent's `max-h-[70vh]` doesn't constrain this because:

```text
Container width: ~480px
Collage aspect ratio: 1:3 (portrait)
Computed height: 480px × 3 = 1440px  ← Ignores max-height!
```

The `aspect-ratio` property prioritizes width-based sizing and doesn't respond to height constraints from parent containers.

---

### Solution

Add conditional max-height constraint directly on the collage element that calculates the appropriate `maxWidth` when the collage would be too tall:

**File: `src/components/CollagePreview.tsx`**

Add a `maxHeight` prop that the parent can pass, and compute the appropriate max-width based on whichever constraint is more restrictive:

```tsx
interface CollagePreviewProps {
  // ... existing props
  maxHeight?: string; // e.g., "70vh"
}

export function CollagePreview({ 
  // ... existing props
  maxHeight
}: CollagePreviewProps) {
  
  return (
    <div className="w-full overflow-hidden" ...>
      <div
        ref={collageRef}
        className="relative mx-auto w-full"
        style={{
          maxWidth: layout.width,
          maxHeight: maxHeight,  // NEW: Apply max-height constraint
          aspectRatio: `${layout.width} / ${layout.height}`,
          backgroundColor: gapColor,
        }}
      >
```

**File: `src/pages/Index.tsx`**

Simplify the wrapper and pass the constraint to the component:

```tsx
<div className="rounded-xl overflow-hidden border border-border bg-surface p-4">
  <CollagePreview
    photos={state.photos}
    layout={state.layout}
    gapColor={state.settings.gapColor}
    maxHeight="70vh"  // NEW: Pass constraint
    // ... other props
  />
</div>
```

---

### Why This Works

When you set both `aspect-ratio` AND `max-height` on the **same element**, the browser respects both constraints - it will size to fit within whichever is more restrictive while maintaining the aspect ratio.

The key insight is that the constraint must be on the element with `aspect-ratio`, not on a parent container.

---

### File Changes

| File | Change |
|------|--------|
| `src/components/CollagePreview.tsx` | Add `maxHeight` prop, apply to style |
| `src/pages/Index.tsx` | Remove flex centering from wrapper, pass `maxHeight="70vh"` to CollagePreview |

