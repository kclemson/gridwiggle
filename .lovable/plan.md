
# Fix Square Tolerance + Investigation Findings

## Immediate Fix: Square Tolerance

### File: `src/lib/collageLayout.ts`

**Line 104-105** — Change square bounds from ±15% to ±5%:

```typescript
// Before
case 'square':
  return [0.85, 1.15];  // Near 1:1

// After
case 'square':
  return [0.95, 1.05];  // Strict 1:1 (±5%)
```

---

## Investigation Findings: Hero Layout Shape Violations

### Root Cause Identified

The hero layout system **completely ignores shape constraints** in most code paths:

1. **`generateEdgeAnchoredHeroLayout`** (lines 588-836) — Has NO shape parameter at all. The hero height is determined purely by the beside photos' natural dimensions.

2. **`generateFloatingHeroLayout`** (lines 899-1100) — Also has NO shape parameter. Same issue.

3. **`generateEdgeAnchoredHeroLayout1Row`** (lines 841-887) — No shape parameter.

4. **Shape is only passed to these functions:**
   - `generateSingleHeroLayout` → passes shape to `generateBlockBasedHeroLayout` only
   - `generateContentOnlyLayout` → uses shape in `buildContentRowsBlock`
   - `generateMultiHeroLayout` → receives shape but never uses it

### How Shape Violations Happen

When a user requests "portrait" with a hero:

1. `generateHeroLayout` receives `settings.shape = 'portrait'`
2. Calls `generateSingleHeroLayout(hero, standards, ..., shape)`
3. For < 6 standards, falls back to `generateEdgeAnchoredHeroLayout` **without shape**
4. The hero unit is built purely based on photo aspect ratios
5. Wide hero + 2-row beside packing → extreme landscape aspect ratio
6. No `directionPenalty` is ever applied to penalize wrong orientation

### The Scoring System Disconnect

The `directionPenalty` in `scorePartition()` (collageLayout.ts lines 276-288) is excellent — it heavily penalizes wrong orientations. **But hero layouts never use this scoring.** Hero layouts use fixed geometric formulas (`calculateOptimalHeroFraction`) that ignore target shape.

### Why Content-Only Layouts Work

When there's no hero, `generateContentOnlyLayout` → `buildContentRowsBlock` → `packPhotosIntoRegion` → `findBestRowSplit` → **`scorePartition` with directionPenalty**.

The content rows use the scoring system. Hero layouts don't.

---

## Summary of Issues

| Issue | Cause | Severity |
|-------|-------|----------|
| Square tolerance too loose | `[0.85, 1.15]` bounds | Fixed in this PR |
| Hero layouts ignore shape | No shape parameter in hero functions | High — causes extreme violations |
| Hero coverage too low | Fixed 30-60% hero fraction range | Medium — heroes sometimes too small |

---

## Recommended Next Steps

Before making code changes for hero shape enforcement:

1. **Decide on approach:**
   - **Option A:** Add shape-aware scoring to hero layouts (evaluate multiple hero configurations, pick best)
   - **Option B:** Add post-hoc shape correction (scale/reflow hero unit to fit target bounds)
   - **Option C:** Clamp hero fraction based on target shape (e.g., smaller hero for portrait)

2. **Key questions to answer:**
   - Should heroes be smaller/larger based on target shape?
   - Should we reject hero configurations that violate shape, or adjust them?
   - What's the acceptable trade-off between hero prominence and shape compliance?

I'll apply the square tolerance fix now. The hero shape investigation reveals this is a structural issue requiring a design decision before implementation.
