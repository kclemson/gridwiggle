
# Plan: Extend Low-Count Accommodation to All Constraints

## What We're Building

Extend the existing `hero_lowCountThreshold` / `hero_lowCountMultiplier` system to relax **all three** constraint categories for low photo counts — not just prominence.

**Design Intent**: With few photos, geometric options are limited. Instead of complex special-case logic, we widen the acceptance window uniformly.

---

## User Experience

| Constraint | Default | Effect with < 8 photos (×0.85) |
|------------|---------|-------------------------------|
| Min Prominence | 1.3 | → 1.10 (weaker heroes OK) |
| Max Hero/Smallest | 45× | → 53× (bigger disparity OK) |
| Min Canvas AR | 0.50 | → 0.43 (taller canvases OK) |
| Max Canvas AR | 2.25 | → 2.65 (wider canvases OK) |

No new UI controls — the existing "Low Count Threshold" and "Low Count Multiplier" sliders now affect all constraints.

---

## Technical Changes

### 1. Add Helper Functions

**File**: `src/lib/v3/utils.ts`

```typescript
/**
 * Calculate effective hero_maxToSmallest based on content count.
 * Returns HIGHER threshold (more permissive) for low photo counts.
 */
export function getEffectiveMaxToSmallest(
  contentCount: number,
  tuning: V3Tuning
): number {
  if (contentCount < tuning.hero_lowCountThreshold) {
    // Divide by multiplier to RAISE the limit (more permissive)
    return tuning.hero_maxToSmallest / tuning.hero_lowCountMultiplier;
  }
  return tuning.hero_maxToSmallest;
}

/**
 * Calculate effective canvas_minAR based on content count.
 * Returns LOWER threshold (more permissive) for low photo counts.
 */
export function getEffectiveCanvasMinAR(
  contentCount: number,
  tuning: V3Tuning
): number {
  if (contentCount < tuning.hero_lowCountThreshold) {
    return tuning.canvas_minAR * tuning.hero_lowCountMultiplier;
  }
  return tuning.canvas_minAR;
}

/**
 * Calculate effective canvas_maxAR based on content count.
 * Returns HIGHER threshold (more permissive) for low photo counts.
 */
export function getEffectiveCanvasMaxAR(
  contentCount: number,
  tuning: V3Tuning
): number {
  if (contentCount < tuning.hero_lowCountThreshold) {
    return tuning.canvas_maxAR / tuning.hero_lowCountMultiplier;
  }
  return tuning.canvas_maxAR;
}
```

### 2. Update Intersection Validation

**File**: `src/lib/v3/intersection.ts`

In `evaluateCornerProposal`, pass content count to validation:

```typescript
// Line ~375: Validate hero-to-smallest ratio
const effectiveMaxToSmallest = getEffectiveMaxToSmallest(photos.length, tuning);
const smallestCheck = validateSmallestCellRatioWithLimit(heroArea, contentAreas, effectiveMaxToSmallest);
```

Also update the canvas AR check (around line 320) to use effective bounds:

```typescript
const effectiveMinAR = getEffectiveCanvasMinAR(photos.length, tuning);
const effectiveMaxAR = getEffectiveCanvasMaxAR(photos.length, tuning);

if (canvasAR < effectiveMinAR || canvasAR > effectiveMaxAR) {
  // rejection logic
}
```

### 3. Update Region Search

**File**: `src/lib/v3/region-search.ts`

Two canvas AR checks need to use effective values:

1. **Line ~176** (no-BESIDE case):
```typescript
const effectiveMinAR = getEffectiveCanvasMinAR(photos.length, tuning);
const effectiveMaxAR = getEffectiveCanvasMaxAR(photos.length, tuning);

if (canvasAR < effectiveMinAR - AR_EPSILON || canvasAR > effectiveMaxAR + AR_EPSILON) {
```

2. **Line ~287** (with-BESIDE case):
Same pattern as above.

### 4. Update Feasibility Pre-Checks

**File**: `src/lib/v3/feasibility.ts`

In `canMeetProminenceConstraints`, use effective maxToSmallest:

```typescript
const effectiveMaxToSmallest = getEffectiveMaxToSmallest(contentCount, tuning);
const maxRowsForSmallest = Math.floor(
  Math.sqrt((effectiveMaxToSmallest * avgBesideAR) / heroAR)
);
```

In `canBesideCountMeetCanvasAR`, use effective canvas bounds:

```typescript
const effectiveMaxAR = getEffectiveCanvasMaxAR(totalContentCount, tuning);
const feasible = bestCaseAR <= effectiveMaxAR * 1.1;
```

In `calculateBesideCountRange`, use effective canvas bounds for both min and max calculations.

### 5. Update Hero Validation Helper

**File**: `src/lib/v3/entities/hero.ts`

Modify `validateSmallestCellRatio` to accept explicit limit:

```typescript
export function validateSmallestCellRatio(
  heroArea: number,
  contentAreas: number[],
  maxRatio: number  // Changed from tuning: V3Tuning
): { valid: boolean; ratio: number } {
  // ...existing logic...
  return {
    valid: ratio <= maxRatio,  // Use passed limit instead of tuning.hero_maxToSmallest
    ratio,
  };
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/v3/utils.ts` | Add 3 new helper functions |
| `src/lib/v3/entities/hero.ts` | Update `validateSmallestCellRatio` signature |
| `src/lib/v3/intersection.ts` | Use effective values for maxToSmallest and canvas AR |
| `src/lib/v3/region-search.ts` | Use effective canvas AR bounds (2 locations) |
| `src/lib/v3/feasibility.ts` | Use effective values in pre-checks (3 locations) |

---

## Expected Impact

- **Prominence**: Already relaxed (1.3 → 1.1)
- **Hero/Smallest**: Now 45 → 53, accepting ~18% more disparity
- **Canvas AR**: Now 0.50–2.25 → 0.43–2.65, ~15% wider range

Combined effect: Estimated **20-30% fewer failures** for 5-7 photo sets by relaxing constraints in concert rather than individually.
