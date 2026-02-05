
# Fix Hero Detection in Layout Rating Tool

## Problem

The layout rating tool is **not correctly triggering the hero layout codepath** because:

1. The synthetic photo generator correctly sets `priority: 1` for hero photos
2. The `syntheticToPhotoItem` function correctly passes `priority` to the `PhotoItem`
3. **BUT** `generateCollageLayout` detects heroes via `photoWeights`, not `priority`
4. The adapter calls `generateCollageLayout(photoItems, settings, { tuning, randomize: false })` without passing `photoWeights`
5. Result: All photos default to weight 1.0, so `dims.filter(d => d.weight >= 2.0)` returns empty, and no hero layouts are generated

## The Fix

Update `runLayoutTest` in `src/test/layout/layoutAdapter.ts` to convert priority to photoWeights before calling the layout algorithm.

### File: `src/test/layout/layoutAdapter.ts`

```typescript
export function runLayoutTest(testCase: LayoutTestCase): LayoutTestResult {
  const { photos, shape, tuning } = testCase;
  
  // Convert synthetic photos to PhotoItems
  const photoItems = photos.map(syntheticToPhotoItem);
  
  // Convert priority to photoWeights (same logic as Index.tsx)
  // Priority 1 = hero → weight 2.0
  // Priority 2, 3 = standard → weight 1.0
  const photoWeights: Record<string, number> = {};
  for (const photo of photos) {
    photoWeights[photo.id] = photo.priority === 1 ? 2.0 : 1.0;
  }
  
  // Merge tuning with defaults
  const fullTuning: LayoutTuning = { ...DEFAULT_TUNING, ...tuning };
  
  // Run the layout algorithm WITH WEIGHTS
  const settings: CollageSettings = {
    shape,
    gapColor: '#000000',
    gapSize: 4,
  };
  
  const layout = generateCollageLayout(photoItems, settings, {
    tuning: fullTuning,
    randomize: false,
    photoWeights,  // ← Now heroes will be detected!
  });
  
  // ... rest unchanged
}
```

## Expected Outcome

After this fix:
- Hero layouts will use 2-row or 3-row beside packing (multi-row next to hero)
- For 8+ standard photos with a hero, you'll see the block-based layout with the hero spanning multiple rows
- For 4-7 standard photos, you'll see edge-anchored hero with 2-row beside packing
- The rating tool will correctly exercise the full hero layout codepath

## Additional Notes

The thresholds in the layout algorithm are:
- **< 4 standard photos**: Falls back to 1-row beside (hero + row of photos)
- **4-7 standard photos**: Edge-anchored with 2-row beside packing
- **8+ standard photos**: Block-based with hero spanning 2 or 3 rows

Since the test matrix includes photo counts of 3, 5, 7, 9, 12, 17, 23, 35, 50 with one photo designated as hero:
- 3 photos (2 standards) → 1-row fallback
- 5 photos (4 standards) → 2-row beside packing
- 7+ photos → Multi-row beside packing, should see varied hero layouts
