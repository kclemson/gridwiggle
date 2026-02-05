
# Plan: Add Canvas Area Percentage to Layout Visualization

## Summary

Add a percentage display to each cell in the layout visualization showing what portion of the total canvas area that photo occupies. This will help with rating decisions — for example, understanding why a hero might feel "not prominent" even if it has slightly more area than other large cells.

## Changes

### File: `src/components/layout-rating/LayoutVisualization.tsx`

**Add area percentage calculation inside the map:**

```typescript
const totalArea = layout.width * layout.height;
const cellArea = cell.width * cell.height;
const areaPercent = (cellArea / totalArea) * 100;
```

**Update the label to show both metrics:**

Currently shows:
```
⭐ 1.00   (aspect ratio only)
```

Will show:
```
⭐ 1.00 · 17%   (aspect ratio + area percentage)
```

**Visual design:**
- Keep existing aspect ratio format (2 decimal places)
- Add separator (·) and percentage 
- Percentage shown as whole number with % symbol
- Same styling/background as current label

## Technical Details

The calculation is straightforward:
- `cellArea = cell.width * cell.height`  
- `canvasArea = layout.width * layout.height`
- `percentage = (cellArea / canvasArea) * 100`

This uses the layout's coordinate system values directly, so it's already normalized and doesn't need any unit conversion.

## Expected Result

From your screenshot example, the hero (starred cell with 1.00 aspect ratio) would show something like:
```
⭐ 1.00 · 17%
```

And you'd be able to compare that against the large pink cell (1.36 aspect) which might show:
```
1.36 · 15%
```

This helps you understand if the hero is mathematically larger but visually doesn't feel prominent.
