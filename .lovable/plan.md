
# Make Layout Algorithm Self-Sufficient for Hero Detection

## Problem

The layout algorithm has a **leaky abstraction**:

- `PhotoItem` has a `priority` field (1 = hero, 2 = medium, 3 = standard)
- The algorithm detects heroes via `photoWeights: Record<string, number>` (weight >= 2.0 = hero)
- These are **two separate concepts** that callers must manually sync
- If a caller passes photos with `priority: 1` but forgets `photoWeights`, heroes are silently ignored

This caused the layout rating tool bug and could affect any future consumer.

---

## Solution

Make `generateCollageLayout` derive weights from `PhotoItem.priority` when `photoWeights` is not provided.

### File: `src/lib/collageLayout.ts`

**Current code (line 662):**
```typescript
const weights = options?.photoWeights ?? {};
```

**Updated code:**
```typescript
// Derive weights from priority if not explicitly provided
const weights = options?.photoWeights ?? deriveWeightsFromPriority(photos);

// ...

function deriveWeightsFromPriority(photos: PhotoItem[]): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const photo of photos) {
    // Priority 1 (hero) → weight 2.0, others → 1.0
    weights[photo.id] = photo.priority === 1 ? 2.0 : 1.0;
  }
  return weights;
}
```

---

## Benefits

1. **Self-contained**: Algorithm works correctly with just `PhotoItem[]` - no implicit contracts
2. **Backward compatible**: Callers passing explicit `photoWeights` still work unchanged
3. **Single source of truth**: Priority field now directly controls layout behavior
4. **Eliminates bug category**: Future consumers cannot accidentally miss hero detection

---

## Code Impact

| File | Change |
|------|--------|
| `src/lib/collageLayout.ts` | Add `deriveWeightsFromPriority()` helper, update weight initialization |

---

## Optional Cleanup

After this change, the layout adapter's manual weight conversion becomes redundant (but harmless). We could remove it for clarity:

```typescript
// src/test/layout/layoutAdapter.ts
// This block is no longer strictly necessary:
const photoWeights: Record<string, number> = {};
for (const photo of photos) {
  photoWeights[photo.id] = photo.priority === 1 ? 2.0 : 1.0;
}
```

However, keeping it explicit is also valid since it documents the intent. I'll leave it in place for now.

---

## Implementation

Single change in `generateCollageLayout`:
1. Add helper function `deriveWeightsFromPriority`
2. Use it as fallback when `photoWeights` is not provided
