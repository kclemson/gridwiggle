

# Remove Rounded Corners from Layout Visualization Canvas

## Change Summary

Remove the rounded corners from the outer canvas container so edge cells display with sharp corners that accurately represent the layout boundaries.

## Technical Details

**File:** `src/components/layout-rating/LayoutVisualization.tsx`

**Line 73** - Remove `rounded-lg` from the container className:

```typescript
// Before:
className="relative mx-auto border border-border rounded-lg overflow-hidden bg-muted/30"

// After:
className="relative mx-auto border border-border overflow-hidden bg-muted/30"
```

This removes the `border-radius: 0.5rem` that was causing the rounded corners on the canvas edges.

