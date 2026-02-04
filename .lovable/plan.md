

## Center Helper Text in Collage Header Row

Move the "Drag to rearrange • Tap ★ to feature" text into the title row, horizontally centered between "COLLAGE" and the action icons.

---

## Current Layout

```text
┌──────────────────────────────────────────────────┐
│ COLLAGE                                    ↻  ↓  │
├──────────────────────────────────────────────────┤
│ Drag to rearrange • Tap ★ to feature             │
└──────────────────────────────────────────────────┘
```

## New Layout

```text
┌──────────────────────────────────────────────────┐
│ COLLAGE   Drag to rearrange • Tap ★ to feature  ↻  ↓ │
└──────────────────────────────────────────────────┘
```

---

## File Change

### `src/pages/Index.tsx`

Update the header structure (lines 343-378):

**From:**
```tsx
{/* Header row with title and action icons */}
<div className="flex items-center justify-between">
  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
    Collage
  </h3>
  <div className="flex items-center gap-1">
    {/* buttons */}
  </div>
</div>

{/* Hint text */}
<p className="text-sm text-muted-foreground px-1">
  Drag to rearrange • Tap ★ to feature
</p>
```

**To:**
```tsx
{/* Header row with title, centered hint, and action icons */}
<div className="flex items-center justify-between">
  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
    Collage
  </h3>
  <p className="text-sm text-muted-foreground">
    Drag to rearrange • Tap ★ to feature
  </p>
  <div className="flex items-center gap-1">
    {/* buttons */}
  </div>
</div>
```

This uses flex's `justify-between` with three children to naturally center the middle element.

