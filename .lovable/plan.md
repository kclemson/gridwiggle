

## Add Max Height Constraint to Collage Preview

### Problem

Portrait collages scale to fill the full container width, resulting in excessively tall previews that push content off-screen and require significant scrolling.

### Solution

Add a `max-height` constraint to the collage wrapper. This is a CSS-only change that caps the preview height while maintaining the correct aspect ratio.

---

### Design Decision: Where to Apply the Constraint

| Option | Pros | Cons |
|--------|------|------|
| **In `CollagePreview.tsx`** | Component self-contains its display logic | May not always want the constraint (e.g., export preview) |
| **In `Index.tsx` wrapper** | Context-specific, collage component stays pure | Correct approach - UI context controls display |

**Recommendation:** Apply in `Index.tsx` - the parent controls how the preview is displayed in this UI context.

---

### Implementation

**File: `src/pages/Index.tsx` (line 389)**

Add `max-h-[70vh]` and adjust flex behavior to center the collage when it's constrained:

```tsx
// Current
<div className="rounded-xl overflow-hidden border border-border bg-surface p-4">

// Updated
<div className="rounded-xl overflow-hidden border border-border bg-surface p-4 max-h-[70vh] flex items-center justify-center">
```

The `CollagePreview` component already has `w-full` and uses `maxWidth` with `aspect-ratio`, so it will naturally scale down to fit within the height constraint while maintaining proportions.

---

### Why 70vh?

- Leaves room for header (~56px) and some breathing room
- On mobile (812px height), this is ~568px max - reasonable for viewing
- Tall portrait collages will scale to fit, wide landscape collages won't be affected
- User can still export at full resolution - this is just the preview constraint

