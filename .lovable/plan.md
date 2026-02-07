

# Remove Decorative Collage Wrapper

## Investigation Result

The wrapper `div` in `Index.tsx` line 528 is **purely decorative**. It does NOT affect:

- **PNG Export**: Creates its own canvas from `layout` data - never touches the DOM
- **Collage Preview**: Self-contained component with its own `gapColor` background
- **Drag & drop**: All handled internally by `CollagePreview`

The wrapper only adds visual styling (`bg-surface`, `p-4`, borders) that's now creating a confusing black layer between the app background and the collage.

---

## Technical Change

### File: `src/pages/Index.tsx`

**Line 528**: Simplify the wrapper to just provide overflow clipping

```tsx
// Before:
<div className="relative rounded-xl overflow-hidden border border-border bg-surface p-4">

// After:
<div className="relative overflow-hidden">
```

---

## Result

- The collage's `gapColor` (black by default) displays directly against the dark charcoal app background
- No intermediate black rectangle
- Export unchanged (it never used this wrapper)

