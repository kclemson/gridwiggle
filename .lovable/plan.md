
# Add Randomize Support to V3

## Problem

V3 currently doesn't accept or use the `randomize` option. Looking at `Index.tsx` lines 112-115, the V3 call doesn't pass `randomize`:

```typescript
const layout = algorithmVersion === 'v3'
  ? generateCollageLayoutV3(photosToUse, settings, { 
      photoWeights,
      // randomize is NOT passed!
    })
```

Meanwhile V1 and V2 both receive and use `randomize` for variety on refresh.

## Solution

Two changes needed:

### 1. Update V3 Options Interface (`src/lib/v3/index.ts`)

Add `randomize` to the options type and implement Fisher-Yates shuffle:

```typescript
export interface GenerateLayoutV3Options {
  photoWeights?: Record<string, number>;
  tuning?: Partial<V3Tuning>;
  canvasWidth?: number;
  randomize?: boolean;  // NEW
}
```

### 2. Shuffle Photos When Randomizing (`src/lib/v3/index.ts`)

Add a shuffle helper and apply it before layout generation:

```typescript
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
```

Then in `generateCollageLayoutV3`:

```typescript
const { 
  photoWeights = {}, 
  tuning: tuningOverrides,
  canvasWidth: providedCanvasWidth,
  randomize = false,  // NEW
} = options;

// Extract dimensions with weights
let dimensions = extractPhotoDimensions(photos, photoWeights);

// Shuffle for variety when requested
if (randomize) {
  dimensions = shuffleArray(dimensions);
}
```

### 3. Pass Randomize from Index.tsx (`src/pages/Index.tsx`)

Update the V3 call to include the `randomize` parameter:

```typescript
const layout = algorithmVersion === 'v3'
  ? generateCollageLayoutV3(photosToUse, settings, { 
      photoWeights,
      randomize,  // ADD THIS
    })
```

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/v3/index.ts` | Add `randomize` option, add `shuffleArray` helper, apply shuffle when `randomize` is true |
| `src/pages/Index.tsx` | Pass `randomize` to V3 options (line 114) |

## Result

After this change, clicking the refresh button with V3 will shuffle photo order, producing different row arrangements and visual variety.
