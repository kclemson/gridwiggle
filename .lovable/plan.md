

# Fix: Increase Square Direction Penalty Weight

## Problem

With 24 photos and Shape=Square, the layout consistently produces landscape results. The screenshot shows ~5 rows with an aspect ratio around 1.4 (landscape), even though the user selected "Square."

**Root cause:** The direction penalty weight for square (5.0) is too weak compared to the uniformity weight (areaCV × 1.0).

**Current scoring for a landscape layout (aspect ~1.4):**
- `directionPenalty = 5.0 * |1.4 - 1.0| = 2.0`
- `areaCV` might be ~0.15 for a well-packed landscape layout

**Current scoring for a square layout (aspect ~1.0):**
- `directionPenalty = 5.0 * |1.0 - 1.0| = 0`
- `areaCV` might be ~0.25 (worse uniformity to achieve square)

In this case, the landscape layout wins: 2.0 + 0.15 = 2.15 vs 0 + 0.25 = 0.25. But with real photos having mixed aspect ratios, the areaCV difference can be larger, causing landscape to win.

---

## Solution

Increase the square direction penalty weight from 5.0 to 10.0, matching portrait and landscape. This ensures the shape preference dominates over uniformity.

---

## Code Change

**File:** `src/lib/collageLayout.ts`

```typescript
// Line 230-232 - Change from:
} else if (shape === 'square') {
  // Penalize deviation from 1.0 aspect ratio
  directionPenalty = 5.0 * Math.abs(resultAspect - 1.0);
}

// To:
} else if (shape === 'square') {
  // Penalize deviation from 1.0 aspect ratio
  // Weight of 10.0 matches portrait/landscape to ensure shape dominates
  directionPenalty = 10.0 * Math.abs(resultAspect - 1.0);
}
```

---

## Expected Behavior After Fix

**n=24, Shape=Square:**

| Layout Aspect | Old Penalty | New Penalty |
|---------------|-------------|-------------|
| 1.0 (perfect square) | 0 | 0 |
| 1.1 | 0.5 | 1.0 |
| 1.2 | 1.0 | 2.0 |
| 1.3 | 1.5 | 3.0 |
| 1.4 | 2.0 | **4.0** |
| 1.5 | 2.5 | 5.0 |

With the doubled penalty weight, a layout with aspect 1.4 now has a 4.0 penalty instead of 2.0. This makes the square-ish layout with slightly worse uniformity more likely to win.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/collageLayout.ts` | Change square penalty weight from 5.0 to 10.0 |

