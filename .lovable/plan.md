

## Fix: Scale Collage Preview to Fit (Not Clip)

### The Problem

Currently the wrapper has `max-h-[400px]` + `overflow-hidden`, which clips the bottom of tall collages instead of scaling them down to fit.

### The Solution

Apply `max-height` directly on the element with `aspect-ratio` so CSS can calculate the appropriate width. The browser will respect both constraints and scale proportionally.

---

### Changes

**File: `src/pages/Index.tsx` (line 389)**

Remove the max-height from the wrapper - it shouldn't constrain content:

```tsx
// Current
<div className="rounded-xl overflow-hidden border border-border bg-surface p-4 max-h-[400px]">

// Updated
<div className="rounded-xl overflow-hidden border border-border bg-surface p-4">
```

**File: `src/components/CollagePreview.tsx` (lines 110-118)**

Add `max-height` on the same element as `aspect-ratio`:

```tsx
// Current
<div
  ref={collageRef}
  className="relative mx-auto w-full"
  style={{
    maxWidth: layout.width,
    aspectRatio: `${layout.width} / ${layout.height}`,
    backgroundColor: gapColor,
  }}
>

// Updated
<div
  ref={collageRef}
  className="relative mx-auto"
  style={{
    maxWidth: layout.width,
    maxHeight: 500,  // NEW: Cap height at 500px
    width: '100%',
    aspectRatio: `${layout.width} / ${layout.height}`,
    backgroundColor: gapColor,
  }}
>
```

---

### Why This Works

When CSS has both `aspect-ratio` and `max-height` on the **same element**, it calculates:
- If the natural height > 500px, cap at 500px and shrink width proportionally
- If the natural height <= 500px, use full width

This scales the collage down rather than clipping it.

---

### Important: Export Is Unaffected

The `exportCollageAsPng` function draws directly from `layout.width` and `layout.height` - it doesn't reference the preview's CSS. The export will always be full resolution regardless of the preview constraint.

