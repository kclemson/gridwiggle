

## Remove V1 Layout Algorithm

### Design Intent
Fully remove the V1 layout algorithm since V3 is now production-ready. This cleans up ~3,000 lines of legacy code while keeping the algorithm-agnostic `reflowAfterSwap` utility.

### User Outcome
- Cleaner codebase with one layout engine instead of two
- No change to app behavior (V3 already handles all layouts)
- Debug panel simplified (no more v1/v3 toggle needed)

---

## What Gets Removed

| File | Lines | Status |
|------|-------|--------|
| `src/lib/collageLayout.ts` | 977 | **DELETE** (except `reflowAfterSwap`) |
| `src/lib/heroLayout.ts` | 1808 | **DELETE** |
| `src/lib/layoutBlocks.ts` | 512 | **DELETE** |
| `src/lib/layoutMath.ts` | ~200 | **REVIEW** (may have shared utilities) |

**Total removed:** ~3,000+ lines

---

## What Gets Modified

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Remove v1 fallback branch, simplify to always use V3 worker |
| `src/components/DebugPanel.tsx` | Remove `AlgorithmVersion` toggle, simplify props |
| `src/lib/collageLayout.ts` → `src/lib/layoutUtils.ts` | Keep only `reflowAfterSwap` in a smaller utility file |
| `src/test/layout/layoutAdapter.ts` | Update to use V3 instead of V1 |

---

## Technical Details

### 1. Extract `reflowAfterSwap` to New Utility File

Create `src/lib/layoutUtils.ts` with just the swap reflow logic:

```typescript
// src/lib/layoutUtils.ts
import { PhotoItem, CollageLayout, CollageCell } from '@/types/collage';
import { getDisplayCrop } from '@/lib/cropUtils';

/**
 * Swap two photos and reflow affected rows.
 * Algorithm-agnostic - works with any layout structure.
 */
export function reflowAfterSwap(
  layout: CollageLayout,
  photos: PhotoItem[],
  photoId1: string,
  photoId2: string,
  gap: number
): CollageLayout {
  // ... existing implementation from collageLayout.ts
}
```

### 2. Simplify Index.tsx

Remove the v1 branch entirely:

```typescript
// Before
const useV3 = !import.meta.env.DEV || algorithmVersion === 'v3';
if (useV3) {
  // V3 worker path
} else {
  // V1 fallback
  layout = generateCollageLayout(photosToUse, settings, {...});
}

// After
// Always use V3 worker
const result = await generateLayoutInWorker({
  dimensions,
  normalizedGap,
  tuning: tuningOverride,
  randomize,
});
```

Remove the `algorithmVersion` state and related imports.

### 3. Simplify DebugPanel

Remove algorithm toggle:

```typescript
// Before
export type AlgorithmVersion = 'v1' | 'v3';

interface DebugPanelProps {
  logs: LogEntry[];
  durationMs?: number;
  algorithmVersion: AlgorithmVersion;
  onAlgorithmVersionChange: (version: AlgorithmVersion) => void;
}

// After
interface DebugPanelProps {
  logs: LogEntry[];
  durationMs?: number;
}
```

Remove the `ToggleGroup` with v1/v3 buttons from the UI.

### 4. Update Test Adapter

Update `src/test/layout/layoutAdapter.ts` to use V3:

```typescript
import { generateCollageLayoutV3 } from '@/lib/v3';

export function runLayoutTest(testCase: LayoutTestCase): LayoutTestResult {
  // ... convert photos to PhotoDimension format
  // ... call generateCollageLayoutV3 instead of generateCollageLayout
}
```

### 5. Delete V1 Files

```
rm src/lib/collageLayout.ts
rm src/lib/heroLayout.ts
rm src/lib/layoutBlocks.ts
```

---

## Files Summary

### To Delete
- `src/lib/collageLayout.ts`
- `src/lib/heroLayout.ts`
- `src/lib/layoutBlocks.ts`

### To Create
- `src/lib/layoutUtils.ts` (extract `reflowAfterSwap` here)

### To Modify
- `src/pages/Index.tsx` - Remove v1 fallback + algorithmVersion state
- `src/components/DebugPanel.tsx` - Remove algorithm toggle
- `src/test/layout/layoutAdapter.ts` - Switch to V3

---

## Verification Checklist

After implementation:
1. Main app generates layouts with V3 only
2. Photo swapping still works (uses `reflowAfterSwap`)
3. Debug panel shows logs without algorithm toggle
4. JSON capture/export still works
5. No TypeScript errors

