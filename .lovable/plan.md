

# Fix V2 Row Packing: Align Height Calculation

## Root Cause

V2's `packRowsToFit` and `packRow` calculate row heights **independently**, causing a mismatch:

```text
packRowsToFit (lines 143-152):          packRow (line 41):
┌─────────────────────────────────┐     ┌─────────────────────────────────┐
│ rowHeight = proportional weight │     │ rowHeight = availableWidth /    │
│             distribution        │     │             sum(aspectRatios)   │
│                                 │     │                                 │
│ Uses this for Y positioning     │     │ Uses THIS for cell.height       │
└─────────────────────────────────┘     └─────────────────────────────────┘
                ↓                                       ↓
         Different values → Overlap/Gaps!
```

V1's `calculateLayoutWithOffset` calculates height once per row and uses it for BOTH cell heights and Y advancement - no mismatch possible.

## Solution

Follow V1's pattern: calculate each row's natural height in `packRowsToFit` and use that exact value for both:
1. Passing to `packRow` (or calculating cells directly)
2. Advancing the Y position

The simplest fix: have `packRowsToFit` calculate cells directly like V1 does, rather than delegating to `packRow` with a region.

---

## Technical Changes

### File: `src/lib/v2/pack.ts`

Rewrite `packRowsToFit` to calculate natural row heights and use them consistently:

```typescript
export function packRowsToFit(
  photos: PhotoDimension[],
  region: RegionSpec,
  gap: number,
  targetPhotosPerRow: number = 3.5
): LayoutCell[] {
  if (photos.length === 0) return [];
  
  // Determine row distribution
  const rowCount = Math.max(1, Math.round(photos.length / targetPhotosPerRow));
  const photosPerRow = Math.ceil(photos.length / rowCount);
  const rows: PhotoDimension[][] = [];
  
  for (let i = 0; i < photos.length; i += photosPerRow) {
    rows.push(photos.slice(i, Math.min(i + photosPerRow, photos.length)));
  }
  
  // Build cells row by row, letting each row take its natural height
  const cells: LayoutCell[] = [];
  let y = region.y;
  
  for (const row of rows) {
    // Calculate THIS row's natural height (like V1 does)
    const totalAR = sum(row.map(p => p.aspectRatio));
    const availableWidth = region.width - gap * (row.length - 1);
    const rowHeight = availableWidth / totalAR;
    
    // Position photos in this row
    let x = region.x;
    for (const photo of row) {
      const width = rowHeight * photo.aspectRatio;
      cells.push({
        photoId: photo.id,
        x,
        y,
        width,
        height: rowHeight,  // Same height used for cells
      });
      x += width + gap;
    }
    
    y += rowHeight + gap;  // Same height used for Y advancement
  }
  
  return cells;
}
```

### File: `src/lib/v2/strategy.ts`

Update strategies to derive `canvasHeight` from actual cell bounds rather than pre-estimating:

```typescript
export function strategySimpleRows(...): LayoutCandidate {
  const region: RegionSpec = { x: 0, y: 0, width: canvasWidth, height: 0 };
  const cells = packRowsToFit(photos, region, gap, targetPhotosPerRow);
  
  // Calculate actual canvas height from cells
  const canvasHeight = cells.reduce(
    (max, c) => Math.max(max, c.y + c.height), 
    0
  );
  
  return { cells, canvasWidth, canvasHeight, score: 0, metadata: { strategy: 'simpleRows' } };
}
```

Apply similar fix to `strategyHeroTop` and `strategyHeroSide`.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/v2/pack.ts` | Rewrite `packRowsToFit` to calculate natural heights inline (like V1) |
| `src/lib/v2/strategy.ts` | Derive `canvasHeight` from actual cell bounds |

---

## Why This Works

V1's approach is mathematically self-consistent:

```text
For a row of photos with aspect ratios [AR1, AR2, AR3]:
- Total AR sum = AR1 + AR2 + AR3
- Row height = availableWidth / sum
- Photo widths = [h * AR1, h * AR2, h * AR3]
- Sum of widths = h * (AR1 + AR2 + AR3) = h * sum = availableWidth ✓
```

Every photo in the row has the same height, and widths sum to exactly the available width. This is the correct algebra - no proportional allocation needed.

