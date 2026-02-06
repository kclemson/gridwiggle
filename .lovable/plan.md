

# Fix BESIDE Region + Compact Cell Labels

## Issue 1: Cell Label Separator (Cosmetic)

**File**: `src/components/layout-rating/LayoutVisualization.tsx`

The label currently shows `1.07 · 18%` with a middle-dot separator. Change to just a space for more compact display.

**Line 112 change**:
```tsx
// Before
{photo?.aspectRatio.toFixed(2)} · {areaPercent}%

// After
{photo?.aspectRatio.toFixed(2)} {areaPercent}%
```

---

## Issue 2: BESIDE Region Not Working (Critical Bug)

### Root Cause

The `decomposeCorner` function in `canvas.ts` always creates the BESIDE region to the RIGHT of the hero:

```typescript
const besideX = heroRect.x + heroRect.width + gap;
const besideWidth = canvasWidth - besideX;
```

For `top-right` corner placement:
- `heroRect.x = canvasWidth - heroWidth = 480 - 272 = 208`
- `besideX = 208 + 272 + 8 = 488`
- `besideWidth = 480 - 488 = -8` (NEGATIVE!)

Since `besideWidth` is negative or very small, the BESIDE region is either skipped or marked as non-viable. All photos go to BELOW.

### Solution

Make `decomposeCorner` position-aware:

**File**: `src/lib/v3/entities/canvas.ts`

Update `decomposeCorner` to accept the hero position and create BESIDE on the correct side:

```typescript
function decomposeCorner(
  canvasWidth: number,
  heroRect: RegionSpec,
  gap: number,
  tuning: V3Tuning,
  position: 'top-left' | 'top-right'  // NEW parameter
): DecompositionResult {
  const regions: RegionSpec[] = [];
  
  let besideX: number;
  let besideWidth: number;
  
  if (position === 'top-left') {
    // BESIDE is to the RIGHT of hero
    besideX = heroRect.x + heroRect.width + gap;
    besideWidth = canvasWidth - besideX;
  } else {
    // BESIDE is to the LEFT of hero (top-right position)
    besideX = 0;
    besideWidth = heroRect.x - gap;
  }
  
  if (besideWidth > tuning.region_minWidth) {
    regions.push({
      x: besideX,
      y: heroRect.y,
      width: besideWidth,
      height: heroRect.height,
    });
  }
  
  // ... BELOW region unchanged
}
```

Also update `decomposeCanvas` to pass the position:

```typescript
case 'corner':
  return decomposeCorner(canvasWidth, heroRect, gap, tuning, proposal.position);
```

### Why This Was Masked

The algorithm currently evaluates multiple proposals (top-left, top-right, edge-left, etc.) and picks the best valid one. Since top-left DOES work correctly, that proposal gets selected and the layout renders - just always with hero on the left and no photos beside.

The top-right proposal was finding valid splits but the BESIDE region itself wasn't viable due to the negative width, so effectively all photos went to BELOW which passed constraints.

---

## Files to Change

| File | Change |
|------|--------|
| `src/components/layout-rating/LayoutVisualization.tsx` | Replace ` · ` with ` ` |
| `src/lib/v3/entities/canvas.ts` | Pass position to decomposeCorner, calculate BESIDE on correct side |
| `src/lib/v3/intersection.ts` | Pass proposal.position to decomposeCanvas |
| `src/lib/v3/types.ts` | May need to update DecompositionMode to include position |

---

## Technical Details

The position parameter needs to flow through the call chain:

```text
proposePositions() → proposal.position = 'top-right'
    ↓
evaluateProposal() calls decomposeCanvas()
    ↓
decomposeCanvas() calls decomposeCorner(position)
    ↓
decomposeCorner() creates BESIDE on LEFT if position='top-right'
```

After this fix, shuffling should produce layouts with the hero on either side AND with photos in the BESIDE region.

