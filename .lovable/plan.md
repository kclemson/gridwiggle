

# Add Comprehensive Logging to Floating Strategy

## Problem Analysis

The debug panel screenshots reveal a strong correlation:
- **Collages with only "Strategy" logs** → Using "floating" strategy → **Black bars/dead space**
- **Collages with full logs** → Using "edge-anchored" strategy → **Clean, tight layouts**

The "floating" strategy code path (lines 958-1191 in `heroLayout.ts`) has **zero** `[Hero]` prefixed console.log statements, while the "edge-anchored" path has comprehensive logging at every decision point.

## Root Causes

1. **Missing diagnostic logging** - Can't see what the floating algorithm is computing
2. **Possible layout bugs** - The black bars suggest width calculations aren't filling the canvas
3. **Silent fallback** - When floating falls back to edge-anchored, there's no logging about why

## Solution

Add comprehensive `[Hero]` logging to the floating strategy at these points:

### 1. Configuration Entry (after line 969)
```typescript
console.log('[Hero] Floating config', {
  useIntroRows,
  introPhotoCount: introPhotos.length,
  leftCount,
  rightCount,
  belowCount: initialBelowPhotos.length,
});
```

### 2. Side Packing Results (after line 1031)
```typescript
console.log('[Hero] Side packing', {
  leftRows: 'row3Height' in leftResult ? 3 : 2,
  leftHeight: leftResult.combinedHeight.toFixed(0),
  leftWidth: leftResult.naturalTotalWidth.toFixed(0),
  rightRows: 'row3Height' in rightResult ? 3 : 2,
  rightHeight: rightResult.combinedHeight.toFixed(0),
  rightWidth: rightResult.naturalTotalWidth.toFixed(0),
});
```

### 3. Scale Factor Decision (after line 1055)
```typescript
console.log('[Hero] Trying config', {
  rowMode: 'floating',
  heroWidth: heroWidth.toFixed(0),
  totalNaturalWidth: totalNaturalWidth.toFixed(0),
  scaleFactor: scaleFactor.toFixed(2),
  accepted: scaleFactor >= 0.80 && scaleFactor <= 1.20,
});
```

### 4. Fallback Trigger (before lines 1041 and 1060)
```typescript
console.log('[Hero] Fallback triggered', {
  reason: maxSideHeight === 0 ? 'no-side-packing' : 'scale-out-of-tolerance',
  scaleFactor: scaleFactor?.toFixed(2) ?? 'n/a',
  fallbackTo: 'edge-anchored',
});
```

### 5. Layout Complete (before return at line 1186)
```typescript
console.log('[Hero] Layout complete', {
  finalAspect: (canvasWidth / finalHeight).toFixed(2),
  heroCell: { width: heroCell.width, height: heroCell.height },
  heroPctOfCanvas: ((heroCell.width * heroCell.height) / (canvasWidth * finalHeight) * 100).toFixed(1) + '%',
  leftCells: leftCells.length,
  rightCells: rightCells.length,
  belowCells: belowCells.length,
  totalCells: allCells.length,
});
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/heroLayout.ts` | Add 5 `[Hero]` log statements to `generateFloatingHeroLayout` function |

## Expected Outcome

After this change, the debug panel will show complete logging for ALL layouts, making it immediately visible when:
- The floating strategy is being used
- What side widths are being calculated
- Whether scale factors are in tolerance
- Why fallbacks are triggered
- Final layout metrics

This will help diagnose and fix the black bar issue in subsequent work.

