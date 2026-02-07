
# Plan: Standardize Rejection Details Across All Rejection Points

## The Problem

The `RejectionBadge` component is already shared between V3Test and the main app. However, the rejection points in `intersection.ts` pass minimal details, while `region-search.ts` passes full diagnostics.

| Location | Rejection Types | Current Details |
|----------|-----------------|-----------------|
| `region-search.ts` | prominence, canvas AR | ✅ Full (`besideCount`, `besideRowCount`, `belowRowCount`, `heroAR`, `canvasAR`) |
| `intersection.ts` | prominence, canvas AR, hero vs smallest | ❌ Minimal (only `ratio`, `required`, or `canvasAR`) |

## Solution

Add standardized fields to all rejection points in `intersection.ts` so the `RejectionBadge` always displays full context.

---

## Technical Changes

| File | Change |
|------|--------|
| `src/lib/v3/intersection.ts` | Add standardized fields to all 5 rejection points |

---

## Detailed Changes

### 1. Extract Variables for Reuse

Near line 227, after `belowRowCount` is defined, add:

```typescript
const belowRowCount = regionAssignment.belowRowCount;

// For rejection diagnostics
const besideCount = regionAssignment.besidePhotos.length;
const besideRowCount = regionAssignment.besideRowCount;
```

### 2. Canvas Too Tall (lines 277-292)

Before:
```typescript
details: { canvasAR: +canvasAR.toFixed(2), minAR: tuning.canvas_minAR },
```

After:
```typescript
details: { 
  canvasAR: +canvasAR.toFixed(2), 
  allowed: `${tuning.canvas_minAR.toFixed(2)} - ${tuning.canvas_maxAR.toFixed(2)}`,
  besideCount,
  besideRowCount,
  belowRowCount,
  heroAR: +heroAR.toFixed(2),
},
```

### 3. Canvas Too Wide (lines 295-311)

Before:
```typescript
details: { canvasAR: +canvasAR.toFixed(2), maxAR: tuning.canvas_maxAR },
```

After:
```typescript
details: { 
  canvasAR: +canvasAR.toFixed(2), 
  allowed: `${tuning.canvas_minAR.toFixed(2)} - ${tuning.canvas_maxAR.toFixed(2)}`,
  besideCount,
  besideRowCount,
  belowRowCount,
  heroAR: +heroAR.toFixed(2),
},
```

### 4. Prominence Too Low (lines 322-338)

Before:
```typescript
details: { ratio: +prominence.ratio.toFixed(2), required: tuning.hero_minProminence },
```

After:
```typescript
details: { 
  prominenceRatio: +prominence.ratio.toFixed(2), 
  required: tuning.hero_minProminence,
  besideCount,
  besideRowCount,
  belowRowCount,
  heroAR: +heroAR.toFixed(2),
  canvasAR: +canvasAR.toFixed(2),
},
```

### 5. Hero Too Large vs Smallest (lines 343-367)

This one already has more detail. Add the standard fields:

Before:
```typescript
details: { 
  ratio: +smallestCheck.ratio.toFixed(1), 
  maxAllowed: tuning.hero_maxToSmallest,
  heroArea: +heroArea.toFixed(3),
  smallestAreas,
},
```

After:
```typescript
details: { 
  ratio: +smallestCheck.ratio.toFixed(1), 
  maxAllowed: tuning.hero_maxToSmallest,
  heroArea: +heroArea.toFixed(3),
  smallestAreas,
  besideCount,
  besideRowCount,
  belowRowCount,
  heroAR: +heroAR.toFixed(2),
  canvasAR: +canvasAR.toFixed(2),
},
```

### 6. Simple Rows Canvas AR (lines 605-626)

This is the hero-less case, so `besideCount`, `besideRowCount`, `belowRowCount` don't apply. Keep as-is but add row count info:

Before:
```typescript
details: { 
  canvasAR: +canvasAR.toFixed(2), 
  minAR: tuning.canvas_minAR,
  maxAR: tuning.canvas_maxAR,
},
```

After:
```typescript
details: { 
  canvasAR: +canvasAR.toFixed(2), 
  allowed: `${tuning.canvas_minAR.toFixed(2)} - ${tuning.canvas_maxAR.toFixed(2)}`,
  rowCount,
  photoCount: photos.length,
},
```

---

## Expected Result

All rejections from both files will display full context:

```text
REJECTED: prominence too low
prominenceRatio: 0.84
required: 1.3
besideCount: 8
besideRowCount: 4
belowRowCount: 3
heroAR: 0.60
canvasAR: 0.74
```

The `RejectionBadge` component stays unchanged - it already renders all fields from `details`.
