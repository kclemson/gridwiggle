
# Fix: Align Region Search to Per-Row Prominence

## Problem Summary

After switching `intersection.ts` to per-row prominence, the **region-search.ts** file still uses global prominence (hero vs ALL content). This causes:
- Layouts with beside photos rejected early during region search
- 0-beside (hero full width) passes more often → lack of variety

---

## Root Cause

| File | Prominence Check | Result |
|------|-----------------|--------|
| `region-search.ts` (no BESIDE) | hero vs max(below) | Still uses global (old) |
| `region-search.ts` (with BESIDE) | hero vs max(beside + below) | Still uses global (old) |
| `intersection.ts` | hero vs top25%(beside only) | Per-row (new) ✓ |

The mismatch means candidates are rejected before they reach the per-row validation.

---

## Design Intent

**What behavior do we want?**
- Hero prominence is evaluated only against its **hero row** (beside region)
- 0-beside case: auto-passes prominence (no competition in hero row)
- With-beside case: hero competes only with beside photos

**What will users experience?**
- More variety in layouts (not always hero full-width)
- Better distribution between 0-beside and N-beside configurations

---

## Implementation

### File: `src/lib/v3/region-search.ts`

#### Change 1: No-BESIDE prominence (lines 275-303)

**Before:**
```typescript
// Check prominence before accepting this split
const belowAreas = belowResult.cells.map(c => c.width * c.height);
const heroAreaNoAside = heroAR * 1.0;
const maxContentAreaNoAside = Math.max(...belowAreas, 0);
const prominenceRatioNoAside = maxContentAreaNoAside > 0 ? heroAreaNoAside / maxContentAreaNoAside : Infinity;

if (prominenceRatioNoAside < effectiveMinProminenceNoAside) {
  // reject...
}
```

**After:**
```typescript
// Per-row prominence: with 0 beside, hero has no row competition
// Prominence auto-passes (no photos in hero row to compete with)
// This aligns with the per-row model used in intersection.ts
devLogger.log('region', 'Per-row prominence auto-pass (no BESIDE)', {
  besideCount: 0,
  belowCount: belowPhotos.length,
});
// (Remove the prominence check for 0-beside case)
```

#### Change 2: With-BESIDE prominence (lines 424-456)

**Before:**
```typescript
// Check prominence before accepting this split
const allCellAreas = [
  ...besideResult.cells.map(c => c.width * c.height),
  ...belowResult.cells.map(c => c.width * c.height),
];
const heroArea = heroAR * 1.0;
const maxContentArea = Math.max(...allCellAreas, 0);
const prominenceRatio = maxContentArea > 0 ? heroArea / maxContentArea : Infinity;
```

**After:**
```typescript
// Per-row prominence: hero competes only with beside region (its row)
// This aligns with the per-row model used in intersection.ts
const besideAreas = besideResult.cells.map(c => c.width * c.height);
const heroArea = heroAR * 1.0;
const maxBesideArea = Math.max(...besideAreas, 0);
const prominenceRatio = maxBesideArea > 0 ? heroArea / maxBesideArea : Infinity;

devLogger.log('region', 'Per-row prominence check (with BESIDE)', {
  heroArea: +heroArea.toFixed(3),
  besideCount: besidePhotos.length,
  maxBesideArea: +maxBesideArea.toFixed(3),
  prominenceRatio: +prominenceRatio.toFixed(2),
});
```

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/v3/region-search.ts` | Remove prominence check for 0-beside, change with-beside to per-row (beside-only) |

---

## Expected Outcome

| Scenario | Before (Global) | After (Per-Row) |
|----------|-----------------|-----------------|
| 0 beside (hero full width) | Passes if hero > max(below) | Always passes (no row competition) |
| 3 beside with 1 large square | Fails if large photo bigger than hero | Compares hero to that beside square only |
| 6 beside + 20 below | Fails if any below photo > hero × 0.7 | Compares hero to 6 beside only |

This should restore variety by allowing more "with beside" configurations to pass the region search, matching the per-row philosophy we established in intersection.ts.

---

## Test Matrix

| Photo Count | Hero AR | Before (Global) | After (Per-Row) |
|-------------|---------|-----------------|-----------------|
| 30 photos | 1.73 (landscape) | Mostly 0-beside | Mix of 0/N beside |
| 15 photos | 0.7 (portrait) | Mix | Slightly more beside |
| 8 photos | 1.0 (square) | Mix | Mix |
