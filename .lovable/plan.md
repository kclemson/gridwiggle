
# Fix Gap Slider Stability + Error Overlay

## Problem Summary
1. **Slider movement causes random layout failures** - V3 uses `Math.random()` on every regeneration, even when the user is just adjusting spacing
2. **Configure section disappears on failure** - It's conditional on `state.layout` existing
3. **Existing collage is destroyed on failure** - User loses their work

---

## Root Cause Analysis

### Why randomness exists
The V3 engine was designed to provide layout variety for the "shuffle" feature. However, the randomness is **not gated** behind the `randomize` flag that already exists:

| Location | Randomness | Problem |
|----------|-----------|---------|
| `split-search.ts` line 58 | `shuffleArray(photos)` | Every regeneration shuffles photos |
| `split-search.ts` line 154 | `validSplits[Math.floor(Math.random() * ...)]` | Random selection from valid splits |
| `intersection.ts` line 455 | `Math.random() * 0.01` tiebreaker | Scores vary randomly |
| `utils.ts` line 120 | `Math.random()` in jitter calculation | Row distribution varies |

The `randomize` flag is passed from `Index.tsx` → `generateCollageLayoutV3` → but **never threaded** to the functions that actually use `Math.random()`.

---

## User Outcomes After Fix

1. **Stable slider experience** - Moving Spacing slider produces consistent, predictable changes
2. **Shuffle still works** - Refresh button still provides variety (uses `randomize: true`)
3. **Collage preserved on error** - Last good layout stays visible with overlay message
4. **Configure always accessible** - Can still adjust settings to escape edge cases

---

## Implementation

### Step 1: Thread `randomize` flag through V3 engine

**File: `src/lib/v3/intersection.ts`**
- Update `findValidConfiguration` to accept `randomize` parameter
- Pass it to `findBestSplit`
- Remove random tiebreaker in `scoreConfiguration` when `randomize === false`

```typescript
// Line 42-46
export function findValidConfiguration(
  photos: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  tuning: V3Tuning = DEFAULT_V3_TUNING,
  randomize: boolean = false  // ADD THIS
): ScoredConfiguration | null {
```

```typescript
// Line 140-145: Pass randomize to findBestSplit
const splitResult = findBestSplit(
  contentPhotos,
  heroAR,
  normalizedGapForLayout,
  tuning,
  randomize  // ADD THIS
);
```

```typescript
// Line 454-457: Conditional tiebreaker
function scoreConfiguration(..., randomize: boolean): number {
  // ...existing score calculation...
  
  // Only add random tiebreaker when shuffling for variety
  const randomTiebreaker = randomize ? Math.random() * 0.01 : 0;
  
  return (prominenceScore * 0.6) + (areaUniformity * 0.4) + randomTiebreaker;
}
```

**File: `src/lib/v3/split-search.ts`**
- Add `randomize` parameter to `findBestSplit`
- When `randomize === false`: sort photos by AR (deterministic), pick best-scored split
- When `randomize === true`: shuffle photos, pick randomly from valid splits

```typescript
// Line 35
export function findBestSplit(
  photos: PhotoDimension[],
  heroAR: number,
  normalizedGap: number,
  tuning: V3Tuning,
  randomize: boolean = false  // ADD THIS
): SplitResult | null {
```

```typescript
// Line 58-60: Conditional ordering
const orderedPhotos = randomize 
  ? shuffleArray(photos) 
  : [...photos].sort((a, b) => a.aspectRatio - b.aspectRatio);
```

```typescript
// Line 153-157: Conditional selection
const selected = randomize
  ? validSplits[Math.floor(Math.random() * validSplits.length)]
  : validSplits.reduce((best, current) => current.score > best.score ? current : best);
```

**File: `src/lib/v3/utils.ts`**
- Add `randomize` parameter to `distributeByARBudget`
- When `randomize === false`: use deterministic row breaks (no jitter)

```typescript
// Line 90
export function distributeByARBudget(
  photos: PhotoDimension[],
  targetRowCount: number,
  tuning: V3Tuning,
  randomize: boolean = false  // ADD THIS
): PhotoDimension[][] {
```

```typescript
// Line 115-117: Conditional jitter
const jitterMultiplier = randomize 
  ? 1 + (Math.random() * 2 - 1) * jitter 
  : 1.0;  // No jitter when deterministic
```

**File: `src/lib/v3/index.ts`**
- Pass `randomize` to `findValidConfiguration`

```typescript
// Line 127
const config = findValidConfiguration(dimensions, canvasWidth, pixelGap, tuning, randomize);
```

---

### Step 2: Preserve layout on failure + show error overlay

**File: `src/pages/Index.tsx`**

Add state for tracking layout errors:
```typescript
// After line 52
const [layoutError, setLayoutError] = useState<string | null>(null);
```

Update `regenerateCollage` to preserve last good layout:
```typescript
// In regenerateCollage, around line 144-150
try {
  devLogger.clear();
  
  const useV3 = !import.meta.env.DEV || algorithmVersion === 'v3';
  const layout = useV3
    ? generateCollageLayoutV3(...)
    : generateCollageLayout(...);
  
  setDebugLogs(devLogger.getLogs());
  
  if (layout) {
    setLayout(layout);
    setLayoutError(null);  // Clear any previous error
  } else if (state.layout) {
    // Generation failed but we have a previous layout - keep it, show error
    setLayoutError("Couldn't generate a new layout. Try shuffling or adjusting photos.");
  } else {
    // No previous layout - nothing to preserve
    setLayout(null);
    setLayoutError("Couldn't generate a layout with these photos.");
  }
} catch (error) {
  console.error('Layout generation failed:', error);
  if (!state.layout) {
    setLayoutError("Something went wrong. Please try again.");
  }
}
```

Update UI to show overlay when `layoutError` is set:
```typescript
// Around line 504, wrap CollagePreview in a relative container with overlay
<div className="relative rounded-xl overflow-hidden border border-border bg-surface p-4">
  <CollagePreview
    photos={state.photos}
    layout={state.layout}
    gapColor={state.settings.gapColor}
    onSwapPhotos={handleSwapPhotos}
    onCellClick={setEditingPhotoId}
    onToggleHero={handleToggleHero}
  />
  
  {/* Error overlay - shown when layout generation fails */}
  {layoutError && (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
      <p className="text-sm text-muted-foreground text-center mb-3 px-4">
        {layoutError}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setLayoutError(null);
          regenerateCollage({ randomize: true });
        }}
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        Try Again
      </Button>
    </div>
  )}
</div>
```

Clear error when user makes changes that could help:
```typescript
// In handleUpdateSettings, clear error when settings change
const handleUpdateSettings = useCallback((updates: Partial<CollageSettingsType>) => {
  updateSettings(updates);
  setLayoutError(null);  // ADD THIS - give them a fresh start
  if (state.layout && ('gapSize' in updates || 'shape' in updates)) {
    // ...existing regeneration logic
  }
}, [...]);
```

---

### Step 3: Keep Configure visible even on error

**File: `src/pages/Index.tsx`**

The Configure section is currently only rendered when `state.layout` exists (inside the `state.layout` conditional block). We need to also show it when we have an error state with a previous layout still displayed.

Since we're now preserving the layout on error, Configure will remain visible. But we should also show it when there was an attempt but no layout:

```typescript
// Around line 515-519
{/* Configure - shown when collage exists OR when there was an error */}
{state.layout && (
  <CollageSettings
    settings={state.settings}
    onUpdate={handleUpdateSettings}
  />
)}
```

This already works because we're now preserving `state.layout` on failure!

---

## Files Changed Summary

| File | Change |
|------|--------|
| `src/lib/v3/intersection.ts` | Add `randomize` param, pass to split search, conditional score tiebreaker |
| `src/lib/v3/split-search.ts` | Add `randomize` param, conditional shuffle vs sort, conditional random vs best selection |
| `src/lib/v3/utils.ts` | Add `randomize` param to `distributeByARBudget`, conditional jitter |
| `src/lib/v3/index.ts` | Pass `randomize` to `findValidConfiguration` |
| `src/pages/Index.tsx` | Add `layoutError` state, preserve layout on failure, error overlay UI |

---

## Testing Checklist

1. Upload 5+ photos, generate collage
2. Move Spacing slider back and forth - layout should remain stable
3. Click shuffle button - layout should change (variety)
4. Force a failure (e.g., 2 extreme portrait photos) - previous collage should show with overlay
5. Click "Try Again" on overlay - should attempt with randomize
6. Verify Configure section never disappears while a collage is visible
