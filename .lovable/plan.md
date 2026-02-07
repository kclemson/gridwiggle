

# Remove V2 Layout Code

## Overview

Remove the V2 layout algorithm code entirely since V3 is the active development target. V3 is fully independent with its own types, utilities, and logic - no actual dependencies on V2 code.

## What Gets Removed

### Files to Delete

| File | Description |
|------|-------------|
| `src/lib/v2/index.ts` | V2 entry point |
| `src/lib/v2/math.ts` | V2 math utilities |
| `src/lib/v2/pack.ts` | V2 packing functions |
| `src/lib/v2/score.ts` | V2 scoring logic |
| `src/lib/v2/strategy.ts` | V2 strategy generation |
| `src/lib/v2/types.ts` | V2 type definitions |

The entire `src/lib/v2/` directory will be deleted.

### UI Changes

**DebugPanel.tsx**:
- Change `AlgorithmVersion` type from `'v1' | 'v2' | 'v3'` to `'v1' | 'v3'`
- Remove the V2 toggle button from the ToggleGroup

**Index.tsx**:
- Remove `import { generateCollageLayoutV2 } from '@/lib/v2'`
- Simplify the layout generation conditional to only handle V1 and V3

---

## Technical Changes

### 1. Update `src/components/DebugPanel.tsx`

**Line 8**: Change type definition:
```typescript
// Before
export type AlgorithmVersion = 'v1' | 'v2' | 'v3';

// After
export type AlgorithmVersion = 'v1' | 'v3';
```

**Lines 141-143**: Remove the V2 toggle button:
```typescript
// DELETE these lines:
<ToggleGroupItem value="v2" className="text-xs font-mono px-2 h-6">
  v2
</ToggleGroupItem>
```

### 2. Update `src/pages/Index.tsx`

**Line 13**: Remove V2 import:
```typescript
// DELETE this line:
import { generateCollageLayoutV2 } from '@/lib/v2';
```

**Lines 113-128**: Simplify conditional to remove V2 branch:
```typescript
// Before (nested ternary)
const layout = algorithmVersion === 'v3'
  ? generateCollageLayoutV3(...)
  : algorithmVersion === 'v2'
    ? generateCollageLayoutV2(...)
    : generateCollageLayout(...);

// After (simple ternary)
const layout = algorithmVersion === 'v3'
  ? generateCollageLayoutV3(photosToUse, settings, { 
      photoWeights,
      randomize,
      tuning: tuningOverride,
    })
  : generateCollageLayout(photosToUse, settings, { 
      photoWeights,
      randomize,
      tuning: DEFAULT_TUNING,
    });
```

### 3. Delete `src/lib/v2/` directory

Remove all 6 files in the V2 directory:
- `index.ts`
- `math.ts`
- `pack.ts`
- `score.ts`
- `strategy.ts`
- `types.ts`

---

## Verification

V3 independence confirmed:
- No imports from `@/lib/v2` anywhere in the V3 code
- V3 has its own complete type definitions (`src/lib/v3/types.ts`)
- V3 has its own utility functions (`src/lib/v3/utils.ts`)
- The comment "Reuses proven logic from v2" in utils.ts refers to copied logic, not imports

---

## Files Summary

| File | Action |
|------|--------|
| `src/lib/v2/index.ts` | **Delete** |
| `src/lib/v2/math.ts` | **Delete** |
| `src/lib/v2/pack.ts` | **Delete** |
| `src/lib/v2/score.ts` | **Delete** |
| `src/lib/v2/strategy.ts` | **Delete** |
| `src/lib/v2/types.ts` | **Delete** |
| `src/components/DebugPanel.tsx` | **Modify** - Remove V2 from type and toggle |
| `src/pages/Index.tsx` | **Modify** - Remove V2 import and conditional branch |

