

# Add Hero-to-Smallest Constraint

## Overview

Prevent layouts where content photos become unreadably small by limiting how much larger the hero can be compared to the smallest content cells.

## Design Intent

**Problem**: Current prominence check (`heroArea / runnerUpArea ≥ 1.3`) only compares to the largest content photo. Layouts can pass where the runner-up is fine but other photos (especially in BESIDE region) are tiny thumbnails.

**Goal**: Hero can't be more than 15× the size of the smallest content photos.

**User Outcome**: No more "hero looks great but those beside photos are invisible" layouts.

---

## Mathematical Approach

**New metric**: `heroArea / avgSmallest(contentAreas)`

- Sort content areas ascending
- Take bottom 10% (minimum 1 photo)
- Calculate average of those smallest photos
- Require: `heroArea / avgSmallest ≤ hero_maxToSmallest`

**Starting threshold**: 15× (derived from screenshot analysis)
- Current bad layout: ~41× → **REJECTED**
- Acceptable below photos: ~10-14× → **ACCEPTED**

---

## Technical Changes

### 1. Add Tuning Parameter (`src/lib/v3/types.ts`)

Add to `V3Tuning` interface:

```text
interface V3Tuning {
  // ... existing params
  
  /** Max hero area relative to avg of smallest content photos (15 = hero ≤ 15× smallest) */
  hero_maxToSmallest: number;
}
```

Default value: `hero_maxToSmallest: 15`

### 2. Add Validation Function (`src/lib/v3/entities/hero.ts`)

New function to validate smallest cell constraint:

```text
/**
 * Validate that hero isn't too large compared to smallest content cells.
 * Uses average of bottom 10% of content areas (minimum 1 photo).
 */
export function validateSmallestCellRatio(
  heroArea: number,
  contentAreas: number[],
  tuning: V3Tuning
): { valid: boolean; ratio: number } {
  if (contentAreas.length === 0) {
    return { valid: true, ratio: 0 };
  }
  
  // Sort ascending, take bottom 10% (min 1)
  const sorted = [...contentAreas].sort((a, b) => a - b);
  const bottomCount = Math.max(1, Math.ceil(sorted.length * 0.1));
  const smallest = sorted.slice(0, bottomCount);
  
  // Average of smallest photos
  const avgSmallest = smallest.reduce((s, v) => s + v, 0) / smallest.length;
  
  const ratio = heroArea / avgSmallest;
  
  return {
    valid: ratio <= tuning.hero_maxToSmallest,
    ratio,
  };
}
```

### 3. Integration Point (`src/lib/v3/intersection.ts`)

In `evaluateNormalizedProposal()`, after the existing prominence check (lines 270-281), add:

```text
// Validate hero-to-smallest ratio
const smallestCheck = validateSmallestCellRatio(heroPixelArea, contentAreas, tuning);

if (!smallestCheck.valid) {
  devLogger.log('v3', 'Hero too large vs smallest cells', {
    ratio: smallestCheck.ratio.toFixed(1),
    maxAllowed: tuning.hero_maxToSmallest,
  });
  return null;
}
```

### 4. Add UI Control (`src/components/V3TuningSection.tsx`)

Add new input to the V3 tuning panel:

| Label | Range | Default | Tooltip |
|-------|-------|---------|---------|
| Max Hero/Smallest | 8-30 | 15 | Hero can't be more than Nx the smallest photos |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/v3/types.ts` | Add `hero_maxToSmallest` to interface and defaults |
| `src/lib/v3/entities/hero.ts` | Add `validateSmallestCellRatio()` function |
| `src/lib/v3/intersection.ts` | Call validation after prominence check |
| `src/components/V3TuningSection.tsx` | Add UI input for new parameter |

---

## Expected Behavior

With `hero_maxToSmallest: 15`:

| Scenario | Ratio | Result |
|----------|-------|--------|
| Screenshot layout (tiny beside cells) | ~41× | REJECTED |
| Good layout (reasonable beside cells) | ~10× | ACCEPTED |
| Edge case (one small cell) | ~16× | REJECTED |

The algorithm will naturally prefer:
- Fewer photos in BESIDE region
- "No beside" layouts (hero at top, all content below)
- More balanced distributions

---

## Why Bottom 10% Average?

Using the single smallest cell would be too strict - one unlucky cell could reject otherwise-good layouts.

Using bottom 10% (minimum 1):
- Catches systematic problems (all beside cells too small)
- Tolerates minor outliers
- Scales with photo count (bottom 2 of 20 photos, bottom 1 of 8 photos)

