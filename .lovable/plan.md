

# Step 1: Sync Photo-Count Scaling into the Worker (immediate fix)

## What Changes

Seven surgical edits to `src/workers/layoutWorker.ts` so the photo-count scaling actually takes effect in production layouts.

### 1. Import `photoCountScale` (line 16)

Add it to the existing import from `hero-constraints.ts`.

### 2. Single-hero `effectiveAreaFractionMax` call (line 333)

Pass `contentPhotos.length + 1` as the `totalPhotos` argument so the area ceiling shrinks at high counts.

### 3. Single-region prominence penalty (line 450)

Scale the min-prominence threshold:
```
const countScale = photoCountScale(contentPhotos.length + 1);
const effectiveMinProm = tuning.hero_minProminence * countScale;
```
Then use `effectiveMinProm` instead of `tuning.hero_minProminence`.

### 4. Two-region prominence penalty (line 577)

Same scaling applied to the multi-region path.

### 5. Dual-hero `effectiveAreaFractionMax` call (line 681)

Pass `contentPhotos.length + 2` as `totalPhotos`.

### 6. Dual-hero prominence hard reject (line 855)

Scale the threshold so dual-hero layouts aren't rejected unnecessarily at high counts:
```
const countScale = photoCountScale(contentPhotos.length + 2);
const effMinProm = tuning.hero_minProminence * countScale;
if (prom1 < effMinProm || prom2 < effMinProm) continue;
```

### 7. `layoutMeta` object (lines 1085-1103)

Add two fields:
```
photoCountScaleFactor: photoCountScale(dimensions.length),
photoCount: dimensions.length,
```

This makes the Layout Info panel display work for worker-generated layouts (currently it only works for the sync fallback).

---

# Step 2: Plan for eliminating the duplication (next step)

The root cause of this bug is that the V4 engine lives in two places: `src/lib/v4/index.ts` (sync fallback) and `src/workers/layoutWorker.ts` (production). Every change must be manually applied to both.

The refactor would:

1. **Extract shared orchestration** into pure functions in `src/lib/v4/` (e.g., `engine.ts`) that take inputs and return results with zero DOM/Worker dependencies.
2. **Worker becomes a thin wrapper** -- receives message, calls the shared engine function, posts result back. ~30 lines instead of ~1,150.
3. **Sync fallback calls the same function** directly on the main thread.
4. Vite's worker bundler handles the import graph automatically -- no manual code duplication needed.

This eliminates the entire class of "forgot to sync the worker" bugs permanently. We'll tackle this after confirming the scaling fix works.

---

One file edited for step 1. Step 2 is documented here for future reference.
