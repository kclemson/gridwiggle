

## Fix: Remove Hardcoded Minimum BELOW Height

### Design Intent
Allow "all photos beside hero" layouts by removing an incorrect assumption that BELOW must always have some content.

### User Outcome
Portrait heroes with low photo counts can now generate valid layouts where all photos stack in multiple rows beside the hero, with nothing below.

---

## Root Cause

Two places hardcode `0.2` as minimum BELOW height when estimating canvas AR:

| File | Line | Current Code |
|------|------|--------------|
| `src/lib/v3/feasibility.ts` | ~100 | `const minCanvasHeight = 1.0 + normalizedGap + 0.2 + 2 * normalizedGap;` |
| `src/lib/v3/region-search.ts` | ~195 | `const minCanvasHeight = 1.0 + normalizedGap + 0.2 + 2 * normalizedGap;` |

This is a hardcoded assumption, not a tuning parameter, because there's no valid design reason for it. The minimum should be `0` - an empty BELOW region is perfectly valid.

---

## The Fix

Remove the `0.2` from both places:

```typescript
// Before:
const minCanvasHeight = 1.0 + normalizedGap + 0.2 + 2 * normalizedGap;

// After:
const minCanvasHeight = 1.0 + 2 * normalizedGap;
```

The existing code already handles empty BELOW correctly:
- `packToFillWidth([])` returns `{ height: 0 }` 
- Validation checks `belowPhotos.length > 0 && result.cells.length === 0` 
- Canvas AR calculation works with `belowResult.height = 0` 

---

## Why Not a Tuning Parameter?

This isn't a "dial" that users would ever want to adjust - it's a bug. There's no scenario where you'd want to force a minimum BELOW height:
- If you want more content below, you adjust canvas AR constraints
- If you want taller layouts, you adjust `canvas_minAR`

Adding it to tuning would just be documenting a mistake. The clean fix is removal.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/v3/feasibility.ts` | Remove `+ 0.2` from minCanvasHeight calculation |
| `src/lib/v3/region-search.ts` | Remove `+ 0.2` from minCanvasHeight calculation |

---

## Expected Result

Portrait hero (AR=0.67) with 5 photos beside in 3 rows:

```text
+----------+--------+
|          | Row 1  |
|   HERO   +--------+
|  (tall)  | Row 2  |
|          +--------+
|          | Row 3  |
+----------+--------+
```

Canvas AR = ~1.17 (valid within 0.67-2.0 range)

