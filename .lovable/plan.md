

# Root Cause: BESIDE Packing Fails Due to Height Constraint

## What I Found

The bug is **not** in the cap logic - it's in how **single-photo packing** interacts with the height constraint, combined with an algorithm that gives up too early.

### The Math

1. **Hero sizing** (for a ~1.5:1 landscape hero at 480px canvas):
   - Hero width: ~264px (55% of 480px, the minimum clamp)
   - Hero height: ~175px (264 / 1.5)

2. **BESIDE region**:
   - Width: 480 - 264 - 8 = 208px
   - Height: 175px (same as hero)

3. **Single portrait photo in BESIDE** (AR ~0.67):
   - At 208px width: height = 208 / 0.67 = **310px**
   - This violates the 175px height constraint → **rejected**

4. **Two portrait photos in BESIDE** (AR ~0.67 each):
   - Combined row AR = 1.34
   - Row height = (208 - 8) / 1.34 = **149px**
   - This **fits** within 175px! ✓

### The Bug

The `findOptimalSplit` algorithm tests splits starting with `besideCount = 0` (trivially passes), then `besideCount = 1` (fails height check), and **stops if it found a "best" at 0**.

```typescript
// Current logic (simplified):
for (let besideCount = 0; besideCount <= max; besideCount++) {
  // besideCount = 0: passes trivially (no photos = no constraints to violate)
  // besideCount = 1: single portrait fails height check → continue
  // besideCount = 2: WOULD work, but we already have bestSplit from 0!
  
  if (bestSplit === null || score < bestSplit.score) {
    bestSplit = { besideCount, score };
  }
}
```

The scoring favors `besideCount = 0` because `score = worstCellArea` and with no BESIDE photos, `besideResult.maxCellArea = 0`!

### Why 2 Photos Would Work

| Beside Count | BESIDE Row Height | Fits 175px? | Notes |
|--------------|-------------------|-------------|-------|
| 1 portrait   | 310px             | No          | Too tall |
| 2 portraits  | 149px             | Yes         | Works! |
| 3 portraits  | 100px             | Yes         | Works! |

## The Fix

### Option A: Require minimum BESIDE utilization (simple)

Enforce that **if a BESIDE region exists, at least 1 photo must go there**. If no valid split can do this, the proposal fails - which is the correct behavior (the geometry doesn't work for this hero position).

```typescript
// Change loop start from 0 to 1
const minBesidePhotos = 1;
for (let besideCount = minBesidePhotos; besideCount <= maxBesidePhotos; besideCount++) {
```

This will:
- Force testing of besideCount = 1, 2, 3... 
- besideCount = 1 fails → try 2
- besideCount = 2 with 2 portraits → works!

### Option B: Fix scoring to penalize empty regions (more robust)

Add a heavy penalty for splits where valid regions have 0 photos:

```typescript
// In findOptimalSplit scoring:
const emptyRegionPenalty = (besideCount === 0 && besideRegion !== null) ? 1e9 : 0;
const score = worstCellArea + emptyRegionPenalty;
```

**I recommend Option A** - it's simpler and aligns with the "no empty regions" philosophy.

## Changes Required

### File: `src/lib/v3/entities/content-pool.ts`

**Change 1:** Start the split search at `besideCount = 1` instead of 0

```typescript
// Line 145 - change from:
for (let besideCount = 0; besideCount <= maxBesidePhotos; besideCount++) {

// To:
const minBesidePhotos = 1; // BESIDE region exists, must have content
for (let besideCount = minBesidePhotos; besideCount <= maxBesidePhotos; besideCount++) {
```

**Change 2:** Update the failure return to indicate no valid split (not a 0-photo "success")

```typescript
// Line 206-211 - already correct, but clarify the comment:
if (bestSplit === null) {
  return { 
    assignments: new Map(), 
    totalAssigned: 0,  // Signals failure - no photos assigned
    splitInfo: { besideCount: 0, belowCount: 0 }  // Explicit: no valid split found
  };
}
```

## Expected Behavior After Fix

1. With 19 photos including several portraits:
   - `besideCount = 1` fails (single portrait too tall)
   - `besideCount = 2` with 2 narrowest portraits → row height ~149px < 175px → **works!**
   
2. The BESIDE region will have content instead of being empty

3. If genuinely no photos can fit in BESIDE (e.g., all very tall portraits with a very short hero), the proposal correctly fails → engine tries different hero position

## Summary

| File | Change |
|------|--------|
| `src/lib/v3/entities/content-pool.ts` | Start split search at `besideCount = 1` instead of 0 to prevent empty BESIDE regions |

