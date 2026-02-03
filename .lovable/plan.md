

## Fix Landscape Orientation Not Being Applied

### Problem Analysis

The collage layout algorithm currently treats orientation as a **soft preference** rather than a **hard constraint**. Looking at the screenshot with 22 photos and "Landscape" selected, the collage is clearly portrait (taller than wide).

**Root cause in `collageLayout.ts`:**

```typescript
const totalScore = 
  areaCV * 1.0 +           // Primary: uniform cell sizes
  heightCV * 0.3 +         // Secondary: uniform row heights  
  aspectDiff * 0.2 +       // Light: target aspect ratio ← TOO LOW!
  rowBalancePenalty;
```

The aspect ratio difference only contributes 0.2 weight vs 1.0 for area uniformity. With many photos, the algorithm always prefers uniform cell sizes even if it results in the wrong orientation.

### Solution

Change the approach: **enforce the target aspect ratio as a hard constraint**, then optimize for uniformity within that constraint.

Instead of scoring partitions and hoping one matches the target aspect, calculate the required row heights to achieve the target aspect ratio, then scale each row to fit.

### Technical Changes

**File: `src/lib/collageLayout.ts`**

1. **Increase aspect ratio weight significantly** from 0.2 to 2.0 to make orientation the primary factor
2. **Add a hard penalty** for aspect ratios that don't match the orientation direction (landscape result when portrait is selected, or vice versa)

```typescript
// Score partition with orientation as primary constraint
function scorePartition(
  partition: PhotoDimension[][],
  targetAspect: number,
  isLandscape: boolean,  // Add this parameter
  baseWidth: number = 1200
): PartitionScore {
  // ... existing calculations ...
  
  const resultAspect = baseWidth / totalHeight;
  
  // Hard penalty: wrong orientation direction
  const wrongDirection = isLandscape 
    ? resultAspect < 1.0   // Landscape should be > 1 (wider than tall)
    : resultAspect > 1.0;  // Portrait should be < 1 (taller than wide)
  const directionPenalty = wrongDirection ? 10.0 : 0;
  
  const totalScore = 
    aspectDiff * 2.0 +       // PRIMARY: match target aspect
    directionPenalty +       // HARD: correct orientation direction
    areaCV * 0.5 +           // Secondary: uniform cell sizes
    heightCV * 0.2 +         // Light: uniform row heights
    rowBalancePenalty;
  
  return { partition, areaCV, heightCV, aspectDiff, totalScore };
}
```

3. **Adjust row count exploration** to favor fewer rows for landscape (more photos per row = wider layout) and more rows for portrait

```typescript
// In findBestRowSplit
const idealPhotosPerRow = isLandscape ? 5 : 3;  // More per row for landscape
const idealRows = Math.ceil(n / idealPhotosPerRow);

// For landscape, explore toward fewer rows; for portrait, toward more rows
const minRows = isLandscape 
  ? Math.max(1, idealRows - 2) 
  : Math.max(1, idealRows - 1);
const maxRows = isLandscape 
  ? Math.min(n, idealRows + 1, 6) 
  : Math.min(n, idealRows + 3, 10);
```

### Expected Result

**Before (22 photos, landscape selected):**
- 6 rows × 3-4 photos = portrait collage (~1:1.5 aspect)

**After (22 photos, landscape selected):**
- 4 rows × 5-6 photos = landscape collage (~1.5:1 aspect)

The collage will be wider than tall when landscape is selected, fitting within the 512px width constraint but requiring horizontal scroll or smaller thumbnails to accommodate the wider layout.

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/collageLayout.ts` | Prioritize aspect ratio in scoring, add orientation direction penalty, adjust row count exploration |

