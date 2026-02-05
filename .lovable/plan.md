

# Clean Up Tuning Parameter - Make It Required

## Problem

The `tuning` parameter is marked optional (`tuning?: LayoutTuning`) with fallback logic (`effectiveTuning = tuning ?? DEFAULT_TUNING`), but this is defensive coding for a case that never happens. We control all calling code, and tuning is always passed.

## Changes

### 1. Make tuning required in function signatures

**`src/lib/collageLayout.ts`**

```typescript
// Line 67: Change from optional to required
export interface LayoutOptions {
  photoWeights: Record<string, number>;
  randomize?: boolean;
  tuning: LayoutTuning;  // Remove the ?
}
```

**`src/lib/heroLayout.ts`**

```typescript
// Line 1594: Change from optional to required
export function generateHeroLayout(
  photos: PhotoItem[],
  settings: CollageSettings,
  targetAspect: number | undefined,
  weights: Record<string, number>,
  randomize: boolean,
  tuning: LayoutTuning  // Remove the ?
): CollageLayout {
```

### 2. Remove fallback logic

**`src/lib/heroLayout.ts`**

```typescript
// REMOVE this line (~1597):
const effectiveTuning = tuning ?? DEFAULT_TUNING;

// Just use `tuning` directly throughout the function
```

### 3. Update all usages of effectiveTuning to just tuning

Replace all references to `effectiveTuning` with `tuning` in `heroLayout.ts`.

## Then: Add minPhotosPerRow Randomization

After cleanup, implement the variety feature:

```typescript
// In generateHeroLayout, after the function signature
let layoutTuning = tuning;

// For auto mode: randomize minPhotosPerRow for shape variety
if (targetAspect === undefined && randomize) {
  const minRowOptions = [2, 3, 4, 5];
  const randomMinPerRow = minRowOptions[Math.floor(Math.random() * minRowOptions.length)];
  layoutTuning = { ...tuning, minPhotosPerRow: randomMinPerRow };
}

// Pass layoutTuning to downstream functions
```

## Files to Modify

1. **`src/lib/collageLayout.ts`** - Make `tuning` required in `LayoutOptions` interface
2. **`src/lib/heroLayout.ts`** - Make `tuning` required, remove fallback, add randomization

## Result

- Cleaner code that reflects reality
- No defensive fallbacks for impossible cases
- Clear immutable pattern for per-layout tuning overrides

