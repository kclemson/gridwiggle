
# Fix V3 Hero Layout Failures

## Root Cause Analysis

V3 hero layouts fail because of a **prominence inversion bug** in how content photos are packed into regions.

### The Math Problem

When a hero is placed (corner mode), the canvas is decomposed into:
- **BESIDE region**: Right of hero, same height as hero
- **BELOW region**: Full width, below the hero row

The BESIDE region gets a subset of content photos. But here's the bug:

```text
Canvas: 480px wide
Hero: ~160px wide (derived from prominence target)
BESIDE region: 480 - 160 - gap = ~312px wide

If BESIDE gets 1-2 photos, they scale to fill 312px width:
  - 1 photo with AR=1.0 → 312x312 = 97,344 px²
  - Hero area: ~25,000 px²
  - Prominence ratio: 25,000 / 97,344 = 0.26
  
Required minimum: 1.3
Result: REJECTED
```

**The hero ends up smaller than the content photos beside it!**

### Why Hero-less Works

Without a hero, all photos go into a single full-width region. Row packing distributes them across multiple rows (e.g., 4-5 rows of 4-5 photos each), resulting in reasonably-sized cells.

---

## Solution Options

### Option A: Constrain Hero Minimum Size (Quick Fix)

Ensure hero width is at least 50% of canvas, guaranteeing the BESIDE region is narrow enough that photos can't exceed hero size.

**Pros**: Simple, one-line change
**Cons**: Limits layout variety

### Option B: Prominence-Aware Packing (Better)

Before finalizing the layout, check if any content cell would exceed hero prominence. If so:
1. Reduce BESIDE region allocation (fewer photos)
2. Or increase hero size to compensate
3. Or reject that proposal and try another

**Pros**: Maintains layout variety, mathematically sound
**Cons**: More complex

### Option C: Iterative Hero Sizing (Best Long-term)

Instead of computing hero size upfront, iterate:
1. Start with minimum viable hero
2. Pack content regions
3. Check prominence
4. If failing, grow hero and re-pack
5. Repeat until valid or reject

**Pros**: Optimal layouts
**Cons**: Most complex, save for Phase 2

---

## Recommended Fix (Option B - Prominence-Aware)

### Changes

| File | Change |
|------|--------|
| `src/lib/v3/intersection.ts` | Add diagnostic logging to `evaluateProposal` |
| `src/lib/v3/entities/hero.ts` | Increase hero minimum size to ensure prominence |
| `src/lib/v3/intersection.ts` | Validate BESIDE region can't exceed hero prominence |

### Implementation Details

1. **Clamp hero size to ensure prominence**:
   In `computeHeroSize`, ensure `clampedWidth` is at least large enough that the BESIDE region (with minimum photos) can't exceed prominence.

   ```typescript
   // Current: clamp to 80% of canvas
   const clampedWidth = Math.min(heroWidth, canvasWidth * 0.8);
   
   // Fix: Also ensure minimum size for prominence
   // BESIDE can have at most 2-3 photos, each with max AR ~2.0
   // besideWidth = canvas - heroWidth - gap
   // Worst case: 1 photo at besideWidth, height = besideWidth / AR
   // Content area = besideWidth² / AR
   // Hero area = heroWidth * heroHeight
   // Need: heroArea >= 1.3 * contentArea
   const minHeroWidth = canvasWidth * 0.55; // Ensures BESIDE is narrow
   const clampedWidth = Math.max(minHeroWidth, Math.min(heroWidth, canvasWidth * 0.8));
   ```

2. **Add diagnostic logging**:
   In `evaluateProposal`, log why proposals fail so we can debug:

   ```typescript
   if (!decomposition.valid) {
     devLogger.log('v3', 'Proposal rejected: decomposition invalid', {
       mode: proposal.mode,
       reason: decomposition.invalidReason,
     });
     return null;
   }
   ```

3. **Log prominence failures**:
   ```typescript
   if (!prominence.valid) {
     devLogger.log('v3', 'Proposal rejected: prominence too low', {
       heroArea,
       runnerUpArea: Math.max(...contentAreas),
       ratio: prominence.ratio,
       required: tuning.hero_minProminence,
     });
     return null;
   }
   ```

---

## Files to Modify

| File | Purpose |
|------|---------|
| `src/lib/v3/entities/hero.ts` | Increase minimum hero width to ensure prominence |
| `src/lib/v3/intersection.ts` | Add diagnostic logging for debugging |

---

## Expected Outcome

After this fix:
1. Hero layouts will generate successfully (hero guaranteed large enough)
2. Console logs will show proposal evaluation details for debugging
3. Prominence ratio will be >= 1.3 as designed
