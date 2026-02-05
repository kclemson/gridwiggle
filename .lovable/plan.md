
# Option C: Hero + Single Content Block

## Overview

Replace the multi-block stacking approach with a simpler architecture:

```text
Current (broken for shape):
┌────────────────────────┐
│  Hero Unit (hero+beside) │
├────────────────────────┤
│  Content Block 1 (4 photos) │
├────────────────────────┤
│  Content Block 2 (4 photos) │
├────────────────────────┤
│  ... 10 more blocks ...  │
└────────────────────────┘
= Always tall regardless of shape

Proposed (Option C):
┌────────────────────────┐
│  Hero Unit (hero+beside) │
├────────────────────────┤
│  Single Content Block    │
│  (ALL remaining photos)  │
│  → shape-aware scoring   │
└────────────────────────┘
= Aspect ratio respects shape setting
```

## Why This Works

The shape logic lives in `packPhotosIntoRegion` → `findBestRowSplit`, which scores partitions based on how close the resulting aspect ratio matches the target shape. When all remaining photos go into ONE block, the algorithm can optimize the *entire* remaining set to hit the target aspect ratio.

Currently, splitting into 13 small blocks means each block is optimized individually, but stacking them defeats the global optimization.

---

## Technical Changes

### File: `src/lib/heroLayout.ts`

**Function: `generateBlockBasedHeroLayout`** (lines 1204-1234)

Replace the chunk-and-stack loop with a single block:

```typescript
// BEFORE (lines 1207-1223):
const photoChunks = splitPhotosForBlocks(remaining, tuning.contentPhotosPerBlock);
const contentBlocks: LayoutBlock[] = [];

for (const chunk of photoChunks) {
  const block = buildContentRowsBlock(chunk, ...);
  if (block) contentBlocks.push(block);
}

// AFTER:
// Build ONE content block with ALL remaining photos
// This allows shape-aware scoring to optimize the entire set
const contentBlock = remaining.length > 0
  ? buildContentRowsBlock(
      remaining,
      canvasWidth,
      gap,
      packPhotosIntoRegion,
      tuning.minPhotosPerRow,
      shape
    )
  : null;

const contentBlocks = contentBlock ? [contentBlock] : [];
```

**Block shuffle adjustment** (lines 1228-1231):

With only 2 blocks (hero + content), shuffling gives:
- Hero on top, content below (50% chance)
- Content on top, hero below (50% chance)

This is still meaningful variety! The hero can appear at top or bottom of the collage.

---

## Trade-offs

| Aspect | Before (Multi-block) | After (Single block) |
|--------|---------------------|----------------------|
| **Shape control** | Broken for large sets | Works correctly |
| **Shuffle variety** | Hero at top/middle/bottom | Hero at top/bottom only |
| **Performance** | Slightly faster (smaller chunks) | Fine (single optimization pass) |

The shuffle variety reduction is minor - the main visual variety comes from:
1. Which photos end up beside the hero (still randomized)
2. How rows are partitioned (still randomized within scoring tolerance)
3. Hero anchor side (left/right)

---

## Expected Results

For 63 photos with 1 hero:

| Shape | Behavior |
|-------|----------|
| **Landscape** | Wide collage - `findBestRowSplit` optimizes all ~50 remaining photos for landscape aspect |
| **Square** | Balanced 1:1 aspect ratio |
| **Portrait** | Tall collage (intentional) |
| **Auto** | Organic - current scoring behavior |

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/heroLayout.ts` | Simplify `generateBlockBasedHeroLayout` to use single content block |

