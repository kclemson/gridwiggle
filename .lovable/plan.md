

# Fix: V3Test Not Using Randomization

## Problem Identified

Two issues are causing the deterministic layouts:

1. **V3Test calls `generateCollageLayoutV3`** (line 122) instead of the new V4 orchestrator
2. **`randomize: true` is never passed** - the options object only includes `photoWeights`

Without `randomize: true`, the V4 algorithm is intentionally deterministic:
- Content photos are sorted by AR (not shuffled)
- Below row count uses full iteration (not random pick)
- Corner is always `'top-left'` (not random)
- Selection picks highest score (not weighted random)

This explains why the same heroAR always produces the same canvasAR - with fixed inputs and no randomization, the output is mathematically determined.

---

## Solution

Update `V3Test.tsx` to:
1. Call V4 directly (via the exported function from `src/lib/v4/index.ts`)
2. Pass `randomize: true` to enable variety

---

## Code Changes

### File: `src/pages/V3Test.tsx`

**Change 1: Import V4 instead of V3** (around line 23)

```typescript
// FROM:
import { generateCollageLayoutV3 } from '@/lib/v3/index';

// TO:
import { generateCollageLayoutV4 } from '@/lib/v4/index';
```

**Change 2: Call V4 with randomize** (around line 122)

```typescript
// FROM:
const layout = generateCollageLayoutV3(photoItems, settings, { photoWeights });

// TO:
const layout = generateCollageLayoutV4(photoItems, settings, { 
  photoWeights, 
  randomize: true,  // Enable variety on every shuffle
});
```

---

## Expected Behavior After Fix

| Before | After |
|--------|-------|
| Same canvasAR for same heroAR | Different layouts each shuffle |
| Only 2-3 canvas shapes | Full AR range (0.5 - 2.0) |
| Always `top-left` corner | Random corner positions |
| Deterministic selection | Weighted random selection |

---

## Test Matrix

Running "Shuffle 25" on a fixed 46-photo set should now produce:

| Metric | Before | After |
|--------|--------|-------|
| Unique canvasAR values | ~2-3 | ~15-20 |
| Corner variety | top-left only | All 4 corners |
| besideCount variety | Fixed for each heroAR | Variable |
| belowRowCount variety | Fixed | Variable |

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/V3Test.tsx` | Import V4, pass `randomize: true` |

**Total: ~3 lines changed**

