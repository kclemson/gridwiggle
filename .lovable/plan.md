

# Fix PNG Export Scale

## The Problem

The default `scale` parameter in `exportCollageAsPng` is `1`, but the call site in `src/pages/Index.tsx` (line 625) hardcodes `2`:

```typescript
const blob = await exportCollageAsPng(
  state.photos,
  state.layout,
  state.settings.gapColor,
  2  // <-- overrides the default
);
```

That is why the exported PNG is ~3384px wide (the layout width x2) despite the function default being 1.

## Fix

**File:** `src/pages/Index.tsx`, line 625

Remove the hardcoded `2` so the function uses its default scale of `1`:

```typescript
const blob = await exportCollageAsPng(
  state.photos,
  state.layout,
  state.settings.gapColor
);
```

One-line change.

