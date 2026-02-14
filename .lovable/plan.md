

# Move Layout Info Below Settings

## What changes

The dev-only LayoutInfoPanel moves from **above** CollageSettings to **below** it. This prevents the settings controls from jumping vertically when the layout info panel appears or changes height between generations.

## Technical change

**`src/pages/Index.tsx`** (lines 356-369): Swap the order of the two blocks so CollageSettings renders first, then LayoutInfoPanel.

Before:
```text
CollagePreview
LayoutInfoPanel (dev-only, variable height)
CollageSettings  <-- jumps when panel above changes
```

After:
```text
CollagePreview
CollageSettings  <-- stable position
LayoutInfoPanel (dev-only, variable height)
```

Single edit, ~6 lines moved.

