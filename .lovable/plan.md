
# Content Cell Cap Fix

## What We're Doing

Adding a **maximum area cap** on content cells. Before accepting a layout, we check: *"Is any content cell larger than the hero allows?"*

The math is simple:

```
If hero must be 1.3x larger than any content cell, then:
   maxContentArea = heroArea / 1.3
```

If any packed content cell exceeds this cap, we reject that proposal.

## The Change

**One file: `src/lib/v3/intersection.ts`**

In `evaluateProposal`, right after packing the regions (line 129-135), and **before** the existing prominence check, add a pre-validation step:

```typescript
// Pack all regions
const { cells: contentCells, totalHeight, contentAreas } = packAllRegions(...);

// NEW: Calculate maximum allowed content cell area
const heroArea = proposal.rect.width * proposal.rect.height;
const maxContentArea = heroArea / tuning.hero_minProminence;

// NEW: Check if any content cell exceeds the cap
const largestContentArea = contentAreas.length > 0 ? Math.max(...contentAreas) : 0;
if (largestContentArea > maxContentArea) {
  devLogger.log('v3', 'Proposal rejected: content cell exceeds cap', {
    mode: proposal.mode,
    position: proposal.position,
    heroArea: Math.round(heroArea),
    maxContentArea: Math.round(maxContentArea),
    largestContentArea: Math.round(largestContentArea),
    excessRatio: (largestContentArea / maxContentArea).toFixed(2),
  });
  return null;
}
```

## Why This Works

This is mathematically equivalent to the existing prominence check, but with clearer diagnostic output. The existing check says "ratio too low" - the new check says "content cell X is Y% over the limit".

The existing prominence check can stay as a safety net, but this new check gives us better logging to understand *which* cell failed and by how much.

## Expected Outcome

1. **Same rejections**, better diagnostics - we'll see exactly how much the largest content cell exceeds the limit
2. The logs will show `excessRatio: 1.85` meaning the content cell is 85% larger than allowed
3. This data helps us understand if we need to tune parameters or improve the packer

## What This Won't Fix (Yet)

The layouts will still fail with the current setup - because the row packer doesn't know about the cap. But now we have:
- Clear visibility into the problem size
- A foundation to make the packer cap-aware in a future iteration

## File Summary

| File | Change |
|------|--------|
| `src/lib/v3/intersection.ts` | Add content cell cap check with detailed logging before prominence validation |
