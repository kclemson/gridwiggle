

## Simple Fix: Cap the Preview Container Height

### The Problem
CSS `aspect-ratio` calculates height from width and doesn't respect `max-height` constraints. The collage correctly maintains its aspect ratio but grows too tall for a comfortable preview.

### The Solution
Add a fixed max-height to the **outer wrapper** in Index.tsx - not the collage itself. This is simpler and actually works:

| What | Value |
|------|-------|
| **Container** | The wrapper `<div className="rounded-xl ... p-4">` |
| **Constraint** | `max-h-[400px]` (or 500px - a simple pixel value) |
| **Behavior** | Tall collages get scrollable or clipped within the container |

### Why Pixels Instead of vh?
- `70vh` on a 1000px viewport = 700px - still quite tall
- A fixed `400px` or `500px` is predictable and comfortable
- Users can still export at full resolution - this is just the preview

### File: `src/pages/Index.tsx` (line ~389)

**Current:**
```tsx
<div className="rounded-xl overflow-hidden border border-border bg-surface p-4">
```

**Updated:**
```tsx
<div className="rounded-xl overflow-hidden border border-border bg-surface p-4 max-h-[400px]">
```

### Also: Remove Unused maxHeight Prop
Since we're constraining at the wrapper level, remove the `maxHeight` prop from `CollagePreview`:

1. **Index.tsx**: Remove `maxHeight="70vh"` prop
2. **CollagePreview.tsx**: Remove `maxHeight` prop and its usage

This keeps the component clean and puts the UI constraint where it belongs - in the page layout.

