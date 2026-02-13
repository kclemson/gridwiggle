

# Tune hero-row Template: Raise Minimum Hero AR

## What Changes for Users

Heroes that are only mildly landscape (AR 1.2 to 1.8) will no longer get the full-width row treatment on portrait canvases. Instead, they'll use corner-anchor, which splits content into two regions (beside + below the hero) rather than cramming all content photos into rows below. This produces more balanced layouts for heroes like the 1.39 AR hummingbird.

## Change

**File:** `src/lib/v3/hero-constraints.ts`

One value change in the `hero-row` template definition:

```
heroAR: { min: 1.2, max: 3.0 }  -->  heroAR: { min: 1.8, max: 3.0 }
```

## Impact

| Hero AR | Before | After |
|---------|--------|-------|
| 1.39 (hummingbird) | hero-row (full-width band) | corner-anchor (corner + 2 content regions) |
| 1.60 | hero-row | corner-anchor |
| 1.80 | hero-row | hero-row (unchanged) |
| 2.50 (panoramic) | hero-row | hero-row (unchanged) |

Heroes in the 1.2-1.8 range on portrait canvases will fall through to corner-anchor (which accepts AR 0.4-3.0 on all canvas shapes), giving the content photos more room to distribute evenly.

## Technical Details

- Single constant change in `hero-constraints.ts`, line for the `hero-row` template
- No logic changes needed -- the template registry filtering in `findCandidateTemplates` already handles fallback naturally
- Corner-anchor is the universal fallback and handles these ARs well

