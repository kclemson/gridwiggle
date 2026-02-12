

# Fix: Cap Hero 2 Width Flex with Crop Tolerance Penalty

## What's Happening

After the height-constraining fix, Hero 2 keeps its natural height (`hH2`), but its width gets flexed to `adjustedWH2 = heroRow1Width - besideWidth2 - gap`. When `adjustedWH2` differs significantly from the natural `wH2`, the cell's aspect ratio no longer matches the photo's -- the renderer crops to fit, but heavy cropping makes the hero look skewed.

## The Fix: Crop Tolerance on Hero 2

Allow up to 10% width deviation (which translates to ~10% crop off left+right or top+bottom). Beyond that threshold, penalize the candidate so the engine prefers configurations where Region 2's packed width naturally aligns with the top row.

## Technical Changes

### 1. `src/lib/v4/index.ts` -- after line 708 (adjustedWH2 calculation)

Add a distortion check and penalty:

```typescript
// Measure how much Hero 2's width was flexed vs its natural width
const hero2WidthDeviation = Math.abs(adjustedWH2 - wH2) / wH2;
const HERO_CROP_TOLERANCE = 0.10; // allow up to 10% crop
const hero2CropPenalty = hero2WidthDeviation > HERO_CROP_TOLERANCE
  ? Math.min(0.3, (hero2WidthDeviation - HERO_CROP_TOLERANCE) * 2.0)
  : 0;
```

Also add a hard skip if deviation exceeds 25% (no amount of cropping saves it):

```typescript
if (hero2WidthDeviation > 0.25) continue;
```

Then subtract from the final score on line 767:

```typescript
const score = Math.max(0.05, rawScore - arPenalty - coveragePenalty
  - prominencePenalty - contentUniformityPenalty - hero2CropPenalty);
```

### 2. `src/workers/layoutWorker.ts` -- after line 759 (same spot)

Same deviation check. The worker uses hard rejects, so add:

```typescript
const hero2WidthDeviation = Math.abs(adjustedWH2 - wH2) / wH2;
if (hero2WidthDeviation > 0.25) continue;
```

No penalty needed in the worker since it already uses hard rejects for AR/coverage/prominence.

## What This Achieves

- Small width flex (under 10%): no penalty, slight crop is invisible
- Medium flex (10-25%): penalized, engine prefers better-fitting candidates
- Large flex (over 25%): hard reject, prevents obviously skewed heroes
- Hero 1 is unaffected (its width is never flexed)

## What Does NOT Change

- Region packing logic
- Height-constraining approach (Region 2 stays height-constrained)
- Single-hero paths
- Rendering / CroppedImage behavior

