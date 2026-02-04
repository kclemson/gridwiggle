

# Phase 1 & 4: Clean Logs + Add Algorithm Tracing

## Overview

This change removes the now-resolved smart crop debug log and adds structured logging throughout the hero layout algorithm so you can observe the decision flow during testing.

---

## Phase 1: Remove Smart Crop Console Log

### File: `src/pages/Index.tsx` (lines 137-141)

Remove the detailed smart crop logging since person detection is working:

**Remove:**
```typescript
console.log(
  `Smart crop for ${photo.filename || photo.id}: confidence=${result.confidence.toFixed(2)}, ` +
  `subjects="${result.subjects}", skipCrop=${result.skipCrop}`
);
```

---

## Phase 4: Add Algorithm Debug Logging

### File: `src/lib/heroLayout.ts`

Add structured console logs at key decision points to understand the algorithm flow.

### Log Points to Add:

#### 1. Entry Point (generateHeroLayout - line ~1205)
```typescript
console.log('[Collage] Layout requested', {
  totalPhotos: photos.length,
  heroCount: heroes.length,
  standardCount: standards.length,
  targetAspect: effectiveTarget?.toFixed(2) ?? 'auto',
  randomize,
});
```

#### 2. Single Hero Strategy Selection (generateSingleHeroLayout - line ~1018)
```typescript
console.log('[Hero] Strategy', {
  strategy: standards.length < FEW_PHOTOS_THRESHOLD ? 'edge-anchored' : 'floating',
  standardCount: standards.length,
  threshold: FEW_PHOTOS_THRESHOLD,
});
```

#### 3. Edge-Anchored Layout Attempt (generateEdgeAnchoredHeroLayout - line ~490)
```typescript
console.log('[Hero] Edge-anchored config', {
  useIntroRows,
  introPhotoCount: introPhotos.length,
  remainingPhotos: remainingPhotos.length,
  anchorSide: anchorRight ? 'right' : 'left',
  heroWidthFraction: widthFraction.toFixed(2),
});
```

#### 4. Row Packing Attempts (3-row and 2-row loops)
Log each attempt with success/failure reason:
```typescript
console.log('[Hero] Trying config', {
  rowMode: '3-row' | '2-row',
  besideCount,
  scaleFactor: scaleFactor.toFixed(2),
  accepted: scaleFactor >= minTolerance && scaleFactor <= maxTolerance,
});
```

#### 5. Final Layout Result
```typescript
console.log('[Hero] Layout complete', {
  finalAspect: (canvasWidth / finalHeight).toFixed(2),
  heroCell: { width: heroCell.width, height: heroCell.height },
  heroPctOfCanvas: ((heroCell.width * heroCell.height) / (canvasWidth * finalHeight) * 100).toFixed(1) + '%',
  besideCells: adjustedBesideCells.length,
  belowCells: belowCells.length,
  totalCells: allCells.length,
});
```

#### 6. Fallback Triggers
When falling back to simpler layouts:
```typescript
console.log('[Hero] Fallback triggered', {
  reason: 'no-valid-config' | 'too-few-photos',
  fallbackTo: '1-row' | 'edge-anchored',
});
```

---

## Expected Console Output

After these changes, refreshing a collage with a hero photo will produce logs like:

```text
[Collage] Layout requested {totalPhotos: 30, heroCount: 1, standardCount: 29, targetAspect: "1.20", randomize: true}
[Hero] Strategy {strategy: "floating", standardCount: 29, threshold: 8}
[Hero] Edge-anchored config {useIntroRows: true, introPhotoCount: 6, remainingPhotos: 23, anchorSide: "left", heroWidthFraction: "0.35"}
[Hero] Trying config {rowMode: "3-row", besideCount: 12, scaleFactor: "1.08", accepted: true}
[Hero] Layout complete {finalAspect: "0.72", heroCell: {width: 420, height: 580}, heroPctOfCanvas: "8.2%", besideCells: 12, belowCells: 11, totalCells: 30}
```

This gives you visibility into:
- Which strategy the algorithm chose (edge-anchored vs floating)
- How many photos it tried packing beside the hero
- Whether scale factors were within tolerance
- The actual hero size as a % of canvas
- Final aspect ratio of the collage

---

## Files Modified

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Remove smart crop console.log (lines 137-141) |
| `src/lib/heroLayout.ts` | Add debug logs at 6 key decision points |

---

## Technical Notes

The logs are prefixed with `[Collage]` and `[Hero]` so you can:
- Filter console by `[Hero]` to see only layout decisions
- Collapse/expand log groups in browser devtools
- Easily grep for specific decision types

After observing a few shuffle iterations with these logs, we'll have concrete data on:
- Why certain configurations are rejected (tolerance failures)
- How often fallbacks are triggered
- The actual hero canvas % being achieved

This baseline will inform the functional algorithm changes in subsequent phases.

