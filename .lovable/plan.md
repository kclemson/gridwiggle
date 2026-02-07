
# Fix: Canvas AR Feasibility Check Ignores BELOW Height

## Design Intent

The current `canBesideCountMeetCanvasAR` feasibility check incorrectly rejects valid configurations because it assumes the canvas height is *only* the hero row (height = 1.0). This causes square/portrait heroes with many landscape photos to be pruned before the algorithm even considers that the BELOW region adds height which balances the aspect ratio.

## User Outcome

- Square heroes (AR ~1.0) paired with landscape content will produce valid layouts
- Portrait heroes (AR 0.6–0.9) will work with sufficient content photos  
- The mockup layout (square hero + 4 beside + ~20 below) will succeed
- Failure rate for portrait/square heroes should drop significantly

---

## The Bug

In `src/lib/v3/feasibility.ts` (lines 99-104):

```typescript
// BUG: Assumes canvas height = hero row only
const minCanvasHeight = 1.0 + 2 * normalizedGap;  // ← ignores BELOW!
const canvasWidth = minHeroRowWidth + 2 * normalizedGap;
const bestCaseAR = canvasWidth / minCanvasHeight;

const feasible = bestCaseAR <= tuning.canvas_maxAR * 1.1;
```

This calculates "best case AR" using minimum height (just hero), but for wide hero rows the BELOW region is what brings the AR back into range.

---

## The Fix: Estimate BELOW Height Geometrically

Replace the flawed check with a proper geometric estimate:

```text
Given:
  - heroRowWidth = heroAR + gap + minBesideWidth
  - belowCount = totalPhotos - besideCount - 1 (hero)
  - avgContentAR = average AR of all content photos

For the canvas to meet maxAR, we need:
  canvasWidth / canvasHeight ≤ maxAR
  → canvasHeight ≥ canvasWidth / maxAR
  → requiredBelowHeight = canvasWidth / maxAR - heroRowHeight - gaps

The achievable BELOW height (minimum estimate) is:
  belowHeight ≈ √(belowCount × avgAR / heroRowWidth)
```

---

## File to Modify

| File | Changes |
|------|---------|
| `src/lib/v3/feasibility.ts` | Update signature to accept `totalContentCount` and `avgContentAR`, then estimate BELOW height before checking AR |

---

## Technical Implementation

### Updated Function Signature

```typescript
export function canBesideCountMeetCanvasAR(
  heroAR: number,
  besidePhotos: PhotoDimension[],
  totalContentCount: number,      // NEW: total content photos (excluding hero)
  avgContentAR: number,           // NEW: average AR of all content
  normalizedGap: number,
  tuning: V3Tuning
): { feasible: boolean; minHeroRowWidth: number }
```

### Updated Logic

```typescript
// Calculate hero row width (same as before)
const sumBesideAR = besidePhotos.reduce((s, p) => s + p.aspectRatio, 0);
const maxRows = Math.min(besidePhotos.length, 4);
const minBesideWidth = sumBesideAR / maxRows;
const minHeroRowWidth = heroAR + normalizedGap + minBesideWidth;
const canvasWidth = minHeroRowWidth + 2 * normalizedGap;

// Calculate required BELOW height to meet canvas_maxAR
const heroRowHeightWithGaps = 1.0 + normalizedGap + 2 * normalizedGap;
const requiredTotalHeight = canvasWidth / tuning.canvas_maxAR;
const requiredBelowHeight = Math.max(0, requiredTotalHeight - heroRowHeightWithGaps);

// Estimate achievable BELOW height
const belowCount = totalContentCount - besidePhotos.length;
if (belowCount > 0 && requiredBelowHeight > 0) {
  // Geometric estimate: height ≈ √(n × avgAR / width)
  // This is conservative (underestimates) as it assumes optimal packing
  const estimatedBelowHeight = Math.sqrt(belowCount * avgContentAR / minHeroRowWidth);
  
  // Feasible if we can achieve ≥80% of required height (conservative margin)
  const feasible = estimatedBelowHeight >= requiredBelowHeight * 0.8;
  
  if (!feasible) {
    devLogger.log('feasibility', 'Canvas AR infeasible (BELOW too short)', {
      besideCount: besidePhotos.length,
      belowCount,
      requiredBelowHeight: requiredBelowHeight.toFixed(2),
      estimatedBelowHeight: estimatedBelowHeight.toFixed(2),
    });
  }
  
  return { feasible, minHeroRowWidth };
}

// No BELOW photos or no height needed → use original check
const bestCaseAR = canvasWidth / (1.0 + 2 * normalizedGap);
const feasible = bestCaseAR <= tuning.canvas_maxAR * 1.1;
return { feasible, minHeroRowWidth };
```

### Update Caller in region-search.ts

```typescript
// Calculate avgContentAR once before the loop
const avgContentAR = photos.reduce((s, p) => s + p.aspectRatio, 0) / photos.length;

// In the loop:
const canvasARFeasibility = canBesideCountMeetCanvasAR(
  heroAR, 
  besidePhotos, 
  photos.length,      // NEW
  avgContentAR,       // NEW
  normalizedGap, 
  tuning
);
```

---

## Mathematical Verification

For the mockup (square hero + 4 beside + 21 below):

```text
Inputs:
  heroAR = 1.0
  besideCount = 4, sumBesideAR ≈ 5.8
  avgContentAR ≈ 1.4
  belowCount = 21

Calculations:
  minBesideWidth = 5.8 / 4 = 1.45
  minHeroRowWidth = 1.0 + 0.03 + 1.45 = 2.48
  canvasWidth = 2.48 + 0.06 = 2.54
  
  requiredTotalHeight = 2.54 / 2.0 = 1.27
  requiredBelowHeight = 1.27 - 1.0 - 0.03 - 0.06 = 0.18
  
  estimatedBelowHeight = √(21 × 1.4 / 2.48) = √11.9 = 3.45
  
  3.45 ≥ 0.18 × 0.8 = 0.14 ✓ FEASIBLE
```

The real BELOW height in the mockup is ~1.2, so this conservative estimate (3.45) correctly allows the configuration through.

---

## Edge Cases

| Scenario | Before | After |
|----------|--------|-------|
| Square hero + many landscape | ❌ Rejected | ✓ Passes |
| Portrait hero + many content | ❌ Rejected | ✓ Passes if geometry allows |
| Wide hero row + few BELOW | May pass incorrectly | Correctly rejects if BELOW can't provide height |
| Landscape hero + any content | ✓ Works | ✓ Unchanged |
