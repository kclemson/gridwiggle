

# Per-Row Prominence Experiment

## Summary

Minimal experiment to validate per-row prominence validation before tackling full multi-hero architecture. The only change: prominence compares hero area to its **hero row content** (beside region) instead of **all content** (beside + below).

---

## Design Intent

**What problem are we solving?**
- Current global prominence (hero vs all content) won't scale to multi-hero layouts
- With multiple hero rows, each hero should be prominent *within its own row*, not globally
- This experiment validates the per-row approach before building recursion

**What will you experience?**
- Single-hero layouts may accept slightly different configurations (more tolerant when hero row content is small)
- Debug panel shows which prominence mode was used
- V3 test page allows rapid evaluation of the change

---

## The Change

### Current (Global Prominence)

```typescript
// Lines 318-323 in intersection.ts
const heroArea = heroAR * 1.0;
const contentAreas = [
  ...besideResult.cells.map(c => c.width * c.height),  // BESIDE
  ...belowResult.cells.map(c => c.width * c.height),   // BELOW  ← included
];
const prominence = validateProminence(heroArea, contentAreas, tuning);
```

Hero competes against ALL content photos, including those in below region.

### Experiment (Per-Row Prominence)

```typescript
const heroArea = heroAR * 1.0;
const besideAreas = besideResult.cells.map(c => c.width * c.height);  // Hero row only
const prominence = validateProminence(heroArea, besideAreas, tuning);
```

Hero only competes against photos in its own row (beside region).

---

## Future-Proofing: Conditional Logic

To prepare for multi-hero, wrap the prominence logic in a conditional that checks hero count:

```typescript
// Get hero count (for now, always 1 or 0)
const heroCount = heroPhoto ? 1 : 0;  // Will become findHeroPhotos(photos).length

// Per-row prominence for multi-hero (and single-hero experiment)
// Global prominence would only apply if we ever want it for single-hero again
const prominenceAreas = besideResult.cells.map(c => c.width * c.height);

// Log which mode we're using
devLogger.log('layout', 'Prominence validation mode', {
  mode: 'per-row',  // Will become conditional on heroCount
  heroRowContentCount: prominenceAreas.length,
  globalContentCount: contentPhotos.length,
});

const prominence = validateProminence(heroArea, prominenceAreas, tuning);
```

---

## Edge Cases

| Scenario | Before (Global) | After (Per-Row) |
|----------|-----------------|-----------------|
| Hero row = 0 beside photos | Hero vs all below → passes easily | Hero vs empty set → auto-pass (ratio = Infinity) |
| Hero row = 1 large beside | Hero vs all → that 1 large + below | Hero vs 1 → stricter check |
| Hero row = 3 small beside | Hero vs all (diluted) | Hero vs 3 small → passes easily |
| Below has biggest photo | Prominence drops (big below competes) | Prominence ignores below → higher ratio |

**Key insight**: Per-row is *more* permissive when below contains large photos (they no longer compete), but *stricter* when the hero row itself has few large photos competing.

---

## Implementation

### File: `src/lib/v3/intersection.ts`

**Location**: Lines 316-323 (prominence validation block)

```typescript
// BEFORE
const heroArea = heroAR * 1.0;
const contentAreas = [
  ...besideResult.cells.map(c => c.width * c.height),
  ...belowResult.cells.map(c => c.width * c.height),
];
const prominence = validateProminence(heroArea, contentAreas, tuning);

// AFTER
const heroArea = heroAR * 1.0;

// Per-row prominence: hero competes only with its row (beside region)
// This prepares for multi-hero where each hero validates against its own row
const besideAreas = besideResult.cells.map(c => c.width * c.height);

devLogger.log('layout', 'Prominence validation (per-row mode)', {
  heroArea: +heroArea.toFixed(3),
  besidePhotoCount: besideAreas.length,
  belowPhotoCount: belowResult.cells.length,
});

const prominence = validateProminence(heroArea, besideAreas, tuning);
```

**Also update**: Keep the existing `contentAreas` computation (for smallest-cell check which should remain global):

```typescript
// Smallest-cell check still uses ALL content (global)
// This prevents tiny cells anywhere in the layout
const allContentAreas = [
  ...besideResult.cells.map(c => c.width * c.height),
  ...belowResult.cells.map(c => c.width * c.height),
];
const smallestCheck = validateSmallestCellRatio(heroArea, allContentAreas, effectiveMaxToSmallest);
```

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/v3/intersection.ts` | Change prominence to use beside-only areas; keep smallest-cell check global |

---

## Validation

1. **V3 Test Page**: Rapid shuffle with various photo counts and orientations
2. **Metrics to watch**:
   - Prominence ratio distribution (should shift upward since below no longer competes)
   - Soft rejection frequency for `prominence_too_low` (should decrease)
   - Visual quality of accepted layouts (does hero still feel prominent?)
3. **Edge cases**:
   - 0 beside photos (hero takes full width) → should auto-pass
   - Hero row with one large square beside → should be strict
   - Portrait-heavy sets where below has biggest photo → should now pass

---

## Test Matrix: Expected Prominence Ratio Changes

| Photo Set | Global (Before) | Per-Row (After) | Why |
|-----------|-----------------|-----------------|-----|
| 20 photos, hero left, 3 beside | hero / avg(top 25% of 19) | hero / avg(top 25% of 3) | Fewer competitors → higher ratio |
| 20 photos, hero left, 0 beside | hero / avg(top 25% of 19) | Infinity (empty set) | Auto-pass |
| 10 photos, beside has 2 big squares | hero / avg(top 2 of 9) | hero / avg(top 1 of 2) | Stricter - those 2 are the comparison |
| 30 photos, below has biggest | hero / avg(includes that big one) | hero / avg(excludes it) | More permissive |

