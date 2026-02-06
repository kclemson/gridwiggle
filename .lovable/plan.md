

# V3 Test Page: Photo Labels + BESIDE Height Fix Analysis

## Part 1: Photo Labels Feature

### File: `src/components/layout-rating/LayoutVisualization.tsx`

Add alphabetic labels to each photo cell for easier reference in discussions.

**Changes:**
1. Generate letter labels (A, B, C... Z, AA, AB...)
2. Display label prominently in each cell alongside existing AR and area%

```tsx
/**
 * Generate alphabetic label: 0=A, 25=Z, 26=AA, 27=AB, etc.
 */
function getPhotoLabel(index: number): string {
  if (index < 26) {
    return String.fromCharCode(65 + index); // A-Z
  }
  // For 26+, use AA, AB, AC...
  const first = Math.floor(index / 26) - 1;
  const second = index % 26;
  return String.fromCharCode(65 + first) + String.fromCharCode(65 + second);
}
```

**Visual update:**
```text
+-------------+
|    [A]      |   <- Bold letter label
| 1.13 · 18%  |   <- Existing AR and area%
+-------------+
```

The label will be sorted by:
- Y position (top to bottom)
- Then X position (left to right)

This ensures A is top-left, B is next in reading order, etc.

---

## Part 2: Mathematical Analysis of Your Mockups

Based on the code constraints, here's the math for each mockup:

### Constraint from code:
```
maxContentArea = heroArea / hero_minProminence = 18% / 1.3 = 13.85%
```

Any content photo exceeding 13.85% of canvas would fail the prominence check.

### Original Layout (current bug)
| Cell | AR | Area% | Pass? |
|------|----|-------|-------|
| Hero | 1.13 | 18% | n/a |
| Pink (beside) | 0.91 | 4% | Yes |
| Teal (beside) | 0.89 | 4% | Yes |
| ... others | various | 3-8% | Yes |

**Problem**: BESIDE region has height=199px but photos only use 97px of it, leaving blank space.

### Mockup 2 (3,4,3,3) - Scale BESIDE to fill
If we scale the BESIDE photos (pink+teal) to fill the full hero height:
- Current height: ~97px
- Target height: ~199px
- Scale factor: 199/97 ≈ 2.05×
- New areas: 4% × 2.05 ≈ **8.2%** each

**Verdict: PASSES** - 8.2% < 13.85% cap

The rows below would need to widen to match the new total canvas width, but their cells get smaller (more photos per row) so they also pass.

### Mockup 3 (3,4,6) - Merge bottom rows
Same BESIDE scaling as mockup 2.
- Row 3 now has 6 photos at full width → each cell is smaller → passes

**Verdict: PASSES**

### Mockup 4 (3,5,5) - Keep short BESIDE
This keeps the original packed BESIDE (2 photos at 97px height) which leaves empty space.
- Simply redistributes remaining 10 photos into 5+5

**Verdict: Would still have empty space** (doesn't fix the bug)

---

## Part 3: Root Cause of BESIDE Empty Space

The issue is in `packPhotosIntoRegion` in `row-pack.ts`:

1. BESIDE region has `height = heroHeight` (~199px) as a **max constraint**
2. Algorithm packs 2 portrait photos into 1 row
3. Row naturally fills the region WIDTH (174px)
4. Row height = 174 / 1.8 ≈ 97px
5. **No logic exists to scale up to fill available HEIGHT**

### Why the algorithm stops short

The packing logic in `row-pack.ts` lines 195-227 calculates:
```typescript
const rowHeight = availableWidth / rowAR;
```

This fills width, but there's no subsequent step to check:
"We packed content to 97px but the region allows 199px - should we scale up?"

---

## Summary

| Mockup | Layout | Would Pass Constraints? | Fixes Bug? |
|--------|--------|------------------------|------------|
| Original | 3,4,3,3 with gap | Yes | No - has empty space |
| Mockup 2 | 3,4,3,3 scaled | Yes (8.2% < 13.85%) | Yes |
| Mockup 3 | 3,4,6 | Yes | Yes |
| Mockup 4 | 3,5,5 | Yes | No - keeps empty space |

Your mockup 2 demonstrates exactly what the fix should do: scale the BESIDE photos to fill the hero height, then adjust content rows to match the new width.

---

## Next Steps

1. **Implement photo labels** - Add A, B, C... labels to `LayoutVisualization`
2. **Fix BESIDE height filling** - Add `fillHeight` constraint to `packPhotosIntoRegion` that scales content to fill bounded regions

