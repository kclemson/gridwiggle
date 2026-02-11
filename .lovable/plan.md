

# Add Configurable Hero Count Mix to V3 Test Tool

## What Changes for You

The test tool will generate dual-hero layouts ~50% of the time (up from 0%), giving much better coverage of the diagonal-corners algorithm. The hero mix percentages will be defined as a simple config object at the top of the file, making it easy to adjust ratios or add 3-hero support later.

## Technical Details

### 1. Update `generatePhotoSet` signature (`src/test/layout/photoGenerator.ts`)

Change `hasHero: boolean` to `heroCount: number` (0, 1, or 2+):

```typescript
export function generatePhotoSet(
  count: number,
  orientationBias: number,
  heroCount: number  // was: hasHero: boolean
): SyntheticPhoto[]
```

- When `heroCount >= 2`, the first N photos each get `priority: 1` with independent `sampleHeroAspectRatio()` calls
- Minimum photo count for dual hero: 8 (matching engine gate)

### 2. Add hero mix config and update `generateRandomSet` (`src/pages/V3Test.tsx`)

Add a config constant at the top:

```typescript
const HERO_MIX = {
  0: 0.05,  // 5% no-hero
  1: 0.45,  // 45% single-hero
  2: 0.50,  // 50% dual-hero
} as const;
```

Update `generateRandomSet` to sample from this distribution, falling back to single-hero when photo count < 8 (dual-hero minimum).

### 3. Update stats display (`src/pages/V3Test.tsx`)

Change the hero stats section to show all heroes when multiple exist:

- "2 Heroes: AR 1.33, AR 0.75" instead of just one
- Update `buildCapture` to set correct `heroCount` and capture all hero ARs

### 4. Update `LayoutTestCase` type and `generateTestBatch` (`src/test/layout/types.ts`, `src/test/layout/layoutAdapter.ts`)

- Change `hasHero: boolean` to `heroCount: number` in `LayoutTestCase`
- Update `generateTestBatch` to use matching distribution (5/45/50)
- Update `RatedLayout` similarly

### Files Changed

| File | Change |
|------|--------|
| `src/test/layout/photoGenerator.ts` | `heroCount` param, loop for N heroes |
| `src/pages/V3Test.tsx` | `HERO_MIX` config, updated stats display, `buildCapture` |
| `src/test/layout/types.ts` | `heroCount: number` replaces `hasHero: boolean` |
| `src/test/layout/layoutAdapter.ts` | `generateTestBatch` uses new distribution |

### Forward-Looking for 3-Hero

Adding 3-hero support later is just:
1. Add `3: 0.XX` to `HERO_MIX` (rebalance others)
2. The `generatePhotoSet` loop already handles any heroCount
3. Engine changes (separate task) to support 3-hero topologies

