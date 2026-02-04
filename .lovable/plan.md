

## Fix: Properly Scale Collage Preview to Fit

### Root Cause

CSS `aspect-ratio` + `max-height` on the same element does **not** scale proportionally. The browser:
1. Calculates height from width based on aspect-ratio
2. Caps height at max-height
3. **Keeps width unchanged** → causes clipping

This is why every photo appears cut off in the screenshot.

---

### The Correct Solution

Use **computed scaling** - calculate the appropriate max-width based on the max-height constraint:

```text
If collage at full preview width would be taller than 500px:
  → Calculate what width would give exactly 500px height
  → Use that as maxWidth instead
```

This ensures the collage scales down proportionally when it would exceed the height limit.

---

### Implementation

**File: `src/components/CollagePreview.tsx`**

Remove the `maxHeight: 500` that doesn't work, and instead compute a width-based constraint:

```tsx
// Current (broken):
style={{
  maxWidth: layout.width,
  maxHeight: 500,  // ← This clips, doesn't scale
  width: '100%',
  aspectRatio: `${layout.width} / ${layout.height}`,
  ...
}}

// Fixed:
// Calculate max width that ensures height stays ≤ 500px
const maxPreviewHeight = 500;
const aspectRatio = layout.width / layout.height;
// If aspect ratio is 0.5 (portrait), width = 500 * 0.5 = 250px max
const heightConstrainedWidth = maxPreviewHeight * aspectRatio;
const effectiveMaxWidth = Math.min(layout.width, heightConstrainedWidth);

style={{
  maxWidth: effectiveMaxWidth,  // ← Width constrained by height limit
  width: '100%',
  aspectRatio: `${layout.width} / ${layout.height}`,
  ...
}}
```

---

### Why This Works

```text
Example: Portrait collage 1200×2400 (0.5 aspect ratio)
  
Container width: 480px (from parent)
Natural height: 480 / 0.5 = 960px (too tall!)

With fix:
  heightConstrainedWidth = 500 × 0.5 = 250px
  effectiveMaxWidth = min(1200, 250) = 250px
  Actual width: min(480, 250) = 250px
  Actual height: 250 / 0.5 = 500px ✓
```

The collage scales to fit within the height limit while maintaining its aspect ratio.

---

### File Changes

| File | Change |
|------|--------|
| `src/components/CollagePreview.tsx` | Compute `effectiveMaxWidth` from aspect ratio and height limit, remove broken `maxHeight` |

