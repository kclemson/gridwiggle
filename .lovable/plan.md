

## Fix: Make "Regenerate Collage" Actually Regenerate

The plan accounts for your preference: first creation respects upload order (deterministic), while regeneration introduces variety through shuffling and top-N selection.

---

## How It Works

| Action | `state.layout` | `randomize` | Result |
|--------|----------------|-------------|--------|
| First "Create Collage" | `null` | `false` | Deterministic best layout, respects upload order |
| "Regenerate Collage" | exists | `true` | Shuffled order + random pick from top 5 layouts |

---

## File Changes

### 1. `src/lib/collageLayout.ts`

**Add `randomize` option to interface:**
```typescript
export interface LayoutOptions {
  photoWeights?: Record<string, number>;
  randomize?: boolean;  // NEW
}
```

**Add Fisher-Yates shuffle helper:**
```typescript
function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
```

**Update `findBestRowSplit` signature and logic:**
- Accept new `randomize` parameter
- Shuffle photo order when randomizing
- Collect top 5 scoring partitions instead of just best
- Pick randomly from top 5 when randomizing

**Update `generateCollageLayout`:**
- Pass `options?.randomize` through to `findBestRowSplit`

---

### 2. `src/pages/Index.tsx`

**Update `handleCreateCollage`:**
```typescript
const handleCreateCollage = useCallback(() => {
  const photoWeights: Record<string, number> = {};
  for (const photo of state.photos) {
    photoWeights[photo.id] = photo.priority === 1 ? 2.0 : 1.0;
  }
  
  // Randomize when regenerating (layout already exists)
  const shouldRandomize = state.layout !== null;
  
  const layout = generateCollageLayout(state.photos, state.settings, { 
    photoWeights,
    randomize: shouldRandomize 
  });
  setLayout(layout);
  setLayoutStale(false);
}, [state.photos, state.settings, state.layout, setLayout]);
```

---

## Behavior Summary

- **First create**: Uses original upload order, picks the single best layout
- **Regenerate**: Shuffles photos + picks randomly from top 5 good layouts = different result each click
- **Auto-regenerate (settings/hero changes)**: Stays deterministic (those code paths don't pass `randomize: true`)

