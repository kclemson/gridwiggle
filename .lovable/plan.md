
# Region Parity Score Implementation

## Summary

Add a **region parity score** to `scoreRegionAssignment()` that rewards layouts where the average cell area in BESIDE is close to the average cell area in BELOW. This steers the algorithm toward balanced splits that pass prominence checks without forcing square collages.

---

## Implementation

### File: `src/lib/v3/region-search.ts`

Update `scoreRegionAssignment()` function (lines 543-567):

```typescript
function scoreRegionAssignment(
  heroAR: number,
  besideResult: { cells: { width: number; height: number }[]; width: number; height: number },
  belowResult: { cells: { width: number; height: number }[]; width: number; height: number },
  _normalizedGap: number,
  tuning: V3Tuning
): number {
  // Uniformity score: coefficient of variation of cell areas
  const allAreas = [
    ...besideResult.cells.map(c => c.width * c.height),
    ...belowResult.cells.map(c => c.width * c.height),
  ];
  const uniformityScore = 1.0 / (1.0 + coefficientOfVariation(allAreas));
  
  // Hero prominence check (soft constraint)
  const heroArea = heroAR * 1.0;
  const maxContentArea = Math.max(...allAreas, 0);
  const prominenceRatio = maxContentArea > 0 ? heroArea / maxContentArea : Infinity;
  const prominenceScore = prominenceRatio >= tuning.hero_minProminence 
    ? 1.0 
    : prominenceRatio / tuning.hero_minProminence;
  
  // Region parity score: reward balanced average cell areas between regions
  // This prevents huge cells in BELOW when it has too few photos
  let parityScore = 1.0;
  
  if (besideResult.cells.length > 0 && belowResult.cells.length > 0) {
    const avgBesideArea = besideResult.cells
      .reduce((sum, c) => sum + c.width * c.height, 0) / besideResult.cells.length;
    const avgBelowArea = belowResult.cells
      .reduce((sum, c) => sum + c.width * c.height, 0) / belowResult.cells.length;
    
    // Ratio clamped to [0, 1] - 1.0 means perfect parity
    const ratio = avgBesideArea / avgBelowArea;
    parityScore = Math.min(ratio, 1 / ratio);
  }
  
  // Combined score with balanced weights
  return (uniformityScore * 0.35) + (prominenceScore * 0.35) + (parityScore * 0.30);
}
```

---

## Knowledge Base Entry

Add this to your project knowledge base:

> **Algorithm Explanation Guidelines**
>
> When explaining technical math or algorithms, include a **test matrix table** showing expected outcomes across representative input combinations (e.g., 20/25/30/35 photos × portrait/mixed/landscape heroes). This makes the geometric and behavioral implications concrete rather than abstract, helping identify edge cases like "would this always produce square collages?" before implementation.

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/v3/region-search.ts` | Add region parity score (30% weight) to `scoreRegionAssignment()` |

---

## Expected Behavior

| Scenario | Before | After |
|----------|--------|-------|
| Portrait hero + 15 photos (13 BESIDE, 2 BELOW) | Parity not considered → prominence fails | Low parity score → algorithm prefers 8/7 split |
| Landscape hero + 24 photos | Random split selection | Prefers splits where avg cell areas match |
| Mixed photos, balanced split | Works fine | Still works, parity ≈ 1.0 |

## Validation

1. Load portrait-heavy photo sets from the screenshots
2. Verify debug logs show higher scores for balanced splits
3. Verify prominence rejection rate decreases
4. Check that canvas AR variety is maintained (not all square)
