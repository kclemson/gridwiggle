

# Lower Hero Height Clamp in Dual-Hero Layouts

## Problem
When two heroes both hit the 0.45 height clamp, the middle band gets squeezed to ~10% of canvas height, resulting in 2 photos stretched across the full width with extreme aspect ratios (AR 7+).

## User Outcome
Middle band gets twice the vertical space (20% instead of 10%), receives more photos (e.g., 4 instead of 2), and those photos have natural aspect ratios (~1.9 instead of ~7.5). Heroes shrink ~11% in height -- a minor visual trade-off for significantly more balanced layouts.

## Change

**File:** `src/lib/v3/utils.ts`, function `deriveRegionCountsThreeWay`

Lower the hero height clamp from `0.45` to `0.40` on two lines:

```
// Before
hH1 = Math.max(0.1, Math.min(0.45, hH1));
hH2 = Math.max(0.1, Math.min(0.45, hH2));

// After
hH1 = Math.max(0.1, Math.min(0.40, hH1));
hH2 = Math.max(0.1, Math.min(0.40, hH2));
```

That's it -- two constant changes, same function, same logic.

## Test Matrix: Before vs After

Canvas AR 1.5, area fraction 0.25, 14 content photos, both heroes portrait (AR 0.67):

| Metric | Clamp 0.45 | Clamp 0.40 |
|--------|-----------|-----------|
| Hero height | 0.45 (clamped) | 0.40 (clamped) |
| Middle band height | 0.10 | 0.20 |
| Middle band area share | ~15% | ~27% |
| Photos in middle | 2 | 4 |
| Middle cell AR | ~7.5 (extreme) | ~1.9 (natural) |
| Hero prominence | Large | Slightly smaller (-11%) |

Canvas AR 1.0, area fraction 0.25, 14 content, both heroes square (AR 1.0):

| Metric | Clamp 0.45 | Clamp 0.40 |
|--------|-----------|-----------|
| Hero height | 0.354 (unclamped) | 0.354 (unclamped) |
| Middle band height | 0.29 | 0.29 |
| Photos in middle | 4-5 | 4-5 |

No change -- clamp doesn't trigger for square heroes on square canvases.

Canvas AR 1.5, area fraction 0.25, 14 content, both heroes landscape (AR 1.5):

| Metric | Clamp 0.45 | Clamp 0.40 |
|--------|-----------|-----------|
| Hero height | 0.354 (unclamped) | 0.354 (unclamped) |
| Middle band height | 0.29 | 0.29 |

No change -- landscape heroes don't hit the clamp.

The fix only activates for the cases that need it (portrait/square heroes on wide canvases) and has zero effect on layouts where the clamp wasn't triggered.

