

# Default PNG Export to 2x Resolution

## What changes
One line in `src/pages/Index.tsx`: pass `scale = 2` to `exportCollageAsPng()`, doubling the export resolution (e.g., ~2000-4000px wide instead of ~1000-2000px).

## Technical detail
In the `handleDownload` function (~line 270), change:
```typescript
// Before
const blob = await exportCollageAsPng(photos, layout, gapColor);

// After
const blob = await exportCollageAsPng(photos, layout, gapColor, 2);
```

No other files change. The `scale` parameter already exists in `exportCollageAsPng` and is fully wired up.

