
# Add LayoutInfoPanel to V3 Test Page + Fix Low-Photo-Count Failures

## Two Changes

### 1. Add LayoutInfoPanel below the CSS layout visualization

The `LayoutInfoPanel` component already exists and is shown below the collage in the main app (`Index.tsx`). Adding it to V3Test requires making the layout metadata available from the sync `generateCollageLayoutV4` call.

**Problem**: `generateCollageLayoutV4` returns `CollageLayout | null` -- no metadata. The worker path constructs `layoutMeta` separately. V3Test uses the sync path.

**Solution**: Change `generateCollageLayoutV4` to return `{ layout, layoutMeta }` instead of just `CollageLayout | null`. This is a small API change affecting:
- `src/lib/v4/index.ts` -- return type becomes `{ layout: CollageLayout; layoutMeta: Record<string, unknown> } | null`
- `src/pages/V3Test.tsx` -- destructure the new return, store `layoutMeta` in state, render `LayoutInfoPanel` below the canvas visualization
- No change to `layoutGenerationService.ts` or `Index.tsx` since the production path uses the worker, not the sync function

### 2. Eliminate null layouts via "best available" fallback

Instead of returning null when all candidates are rejected, keep the least-bad candidate and select it as a soft rejection. This follows the existing "always generate" policy.

**Changes**:
- `src/workers/layoutWorker.ts` -- track the best-rejected candidate (lowest AR deviation). If no candidates pass all checks, use the best-rejected with a `softRejection` marker.
- `src/lib/v4/index.ts` -- same change in the sync path.

This means the 5 failure cases above would instead produce a layout (possibly with a visible soft rejection indicator in dev mode) rather than a red "Layout generation failed" panel.

## Technical Details

### File: `src/lib/v4/index.ts`

1. Define a return type:
   ```typescript
   interface V4LayoutResult {
     layout: CollageLayout;
     layoutMeta: Record<string, unknown>;
   }
   ```
2. Change `generateCollageLayoutV4` return type from `CollageLayout | null` to `V4LayoutResult | null`
3. After selecting a candidate, construct `layoutMeta` (same fields as the worker: template, targetCanvasAR, actualCanvasAR, arDeviation, areaFrac, heroCoverage, heroAR, prominenceRatio, score, corner, candidateCount, regionSizes, regionTargetRows, regionActualRows, besideWidth, belowHeight)
4. In `generateCandidates`, track `bestRejected` -- the candidate with the lowest AR deviation that was rejected. If no passing candidates exist, return `bestRejected` in a separate field.
5. If using bestRejected, attach a `softRejection` to the metadata.

### File: `src/workers/layoutWorker.ts`

1. Same "best rejected" tracking in `generateCandidates`
2. If no passing candidates, use bestRejected and set `softRejection` in the response

### File: `src/pages/V3Test.tsx`

1. Update `generateLayoutResult` to destructure `{ layout, layoutMeta }` from the new return type
2. Add `layoutMeta` to `TestState`
3. Render `<LayoutInfoPanel meta={layoutMeta} />` below the `LayoutVisualization` component (and below the canvas dimensions text), inside the right-column canvas card
4. Import `LayoutInfoPanel` from `@/components/debug`

### File: `src/lib/v4/index.ts` -- generateCandidates changes

Add a `bestRejected` tracker alongside the candidates array:
```text
let bestRejected: { candidate: LayoutCandidate; deviation: number } | null = null;

// In each rejection point (ar_coherence, coverage, prominence):
if (!bestRejected || arDeviation < bestRejected.deviation) {
  bestRejected = { candidate: built_candidate, deviation: arDeviation };
}

// Return { candidates, bestRejected }
```

Then in the main function:
```text
if (candidates.length === 0 && bestRejected) {
  // Use best rejected as fallback
  selected = bestRejected.candidate;
  softRejection = { reason: 'best_available', details: { ... } };
}
```
