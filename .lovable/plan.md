
# V3 Layout Test Page + Diagnostic Logging

## Overview

Create a dedicated dev-only test page (`/v3-test`) for rapid V3 algorithm iteration, plus add diagnostic logging to understand why BESIDE packing fails.

---

## Part 1: V3 Layout Test Page

### New File: `src/pages/V3Test.tsx`

A minimal, focused test page with:

**Features:**
- **Random photo generation**: 10-50 photos with random aspect ratios
- **80% hero layouts**: Most tests include a hero photo
- **One-click shuffle**: Generate new random set instantly
- **CSS visualization**: Colored rectangles (reuse `LayoutVisualization` component)
- **Inline debug logs**: Show V3 devLogger output directly on page
- **Static settings**: 480px canvas, 8px gap (match production defaults)

**Layout:**
```text
+----------------------------------+
| V3 Layout Test    [Shuffle]      |
+----------------------------------+
| Photo set: 23 photos (hero: yes) |
| Avg AR: 1.05                     |
+----------------------------------+
|                                  |
|    [ CSS Layout Visualization ]  |
|                                  |
+----------------------------------+
| Debug Logs                 [v]   |
| -------------------------------- |
| [v3] Starting V3 layout...       |
| [v3] Evaluating proposal...      |
| [v3] Distribution split: ...     |
+----------------------------------+
```

**Photo Generation Logic:**
```typescript
// Random count between 10-50
const photoCount = Math.floor(Math.random() * 41) + 10;

// Random orientation bias (-0.5 to +0.5)
const orientationBias = (Math.random() - 0.5);

// 80% chance of hero
const hasHero = Math.random() < 0.8;

// Use existing generatePhotoSet from photoGenerator.ts
const photos = generatePhotoSet(photoCount, orientationBias, hasHero);
```

**Key Components:**
- Reuse `LayoutVisualization` from layout-rating (CSS rectangles)
- Reuse `generatePhotoSet` from `src/test/layout/photoGenerator.ts`
- Show `devLogger.getLogs()` in a collapsible section
- Clear logs on shuffle via `devLogger.clear()`

---

### File: `src/App.tsx`

Add dev-only route:

```typescript
{import.meta.env.DEV && (
  <>
    <Route path="/layout-rating" element={<LayoutRating />} />
    <Route path="/v3-test" element={<V3Test />} />
  </>
)}
```

---

## Part 2: Diagnostic Logging for BESIDE Bug

### File: `src/lib/v3/entities/content-pool.ts`

Add detailed logging inside `findOptimalSplit` to trace why each `besideCount` fails:

```typescript
// In the split loop:
for (let besideCount = minBesidePhotos; besideCount <= maxBesidePhotos; besideCount++) {
  // ... existing logic ...
  
  // Log why BESIDE failed
  if (besidePhotos.length > 0 && besideResult.actualHeight > besideRegion.height) {
    devLogger.log('v3-split', 'BESIDE height constraint failed', {
      besideCount,
      besideWidth: besideRegion.width,
      besideHeightLimit: besideRegion.height,
      actualHeight: besideResult.actualHeight,
      photosARs: besidePhotos.map(p => p.aspectRatio.toFixed(2)),
    });
    continue;
  }
  
  if (besideResult.maxCellArea > maxCellArea) {
    devLogger.log('v3-split', 'BESIDE area constraint failed', {
      besideCount,
      maxCellArea,
      actualMaxCellArea: besideResult.maxCellArea,
    });
    continue;
  }
  
  // ... similar for BELOW ...
}

// Log final result
devLogger.log('v3-split', 'Split search complete', {
  bestSplit: bestSplit ? { besideCount: bestSplit.besideCount, score: bestSplit.score } : null,
  triedCounts: `1 to ${maxBesidePhotos}`,
});
```

This logging will show us:
- Exact height and area values for each attempted split
- Which constraint (height vs area) is failing
- The aspect ratios of photos being tested in BESIDE

---

## Implementation Summary

| File | Change |
|------|--------|
| `src/pages/V3Test.tsx` | **NEW** - V3 test page with random photos + CSS visualization |
| `src/App.tsx` | Add `/v3-test` dev-only route |
| `src/lib/v3/entities/content-pool.ts` | Add diagnostic logging to `findOptimalSplit` |

---

## Dependencies

Uses existing code:
- `generatePhotoSet` from `src/test/layout/photoGenerator.ts`
- `LayoutVisualization` from `src/components/layout-rating/LayoutVisualization.tsx`
- `devLogger` from `src/lib/devLogger.ts`
- `generateCollageLayoutV3` from `src/lib/v3/index.ts`
