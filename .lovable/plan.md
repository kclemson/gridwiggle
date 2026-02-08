
# Hero Prominence Slider: Relative Resize Without Repacking

## What Users Want

The slider should make the **hero bigger relative to the other photos** — the hero takes up more canvas real estate while the other photos shrink to accommodate. This is different from uniform zooming (which was previously implemented).

## The Core Insight

The V3 layout engine already has a parameter for this: `hero_targetProminence` in the tuning config. Currently it defaults to `1.5` (hero area = 1.5× content area). Adjusting this parameter and re-running the layout algorithm with the **same photo order** (no shuffle) achieves exactly what you want.

### Why Not Just Scale Coordinates?

- Uniform scaling makes everything bigger/smaller together — the hero doesn't become *relatively* more prominent
- To increase hero's relative size, the content photos need to pack into smaller space
- This requires actual re-packing, not just multiplication

### Why This Approach Works

1. The layout algorithm preserves photo order when `randomize=false`
2. Increasing `hero_targetProminence` makes the hero take more canvas area
3. Content photos are packed into the remaining space (smaller)
4. The hero position and decomposition mode stay the same — no shuffle

---

## Technical Implementation

### 1. Replace Hero Scale with Prominence Scale

**File: `src/pages/Index.tsx`**

Replace the uniform scaling approach with prominence-based regeneration:

```typescript
// Hero prominence scale factor (1.0 = default tuning, 0.7-1.3 range)
const [heroProminence, setHeroProminence] = useState(1.0);

// When slider drags: live preview by immediately regenerating layout
// When slider releases: commit the current layout

// No need for scaledLayout computation — just regenerate with modified tuning
const handleHeroProminenceChange = useCallback((prominence: number) => {
  setHeroProminence(prominence);
  
  // Regenerate with modified prominence — no shuffle, same photo order
  const modifiedTuning = {
    ...v3Tuning,
    hero_targetProminence: DEFAULT_V3_TUNING.hero_targetProminence * prominence,
  };
  
  regenerateCollage({ 
    randomize: false,  // Critical: preserve photo order
    v3Tuning: modifiedTuning,
  });
}, [v3Tuning, regenerateCollage]);

const handleHeroProminenceCommit = useCallback(() => {
  // Just update v3Tuning state to persist the prominence
  setV3Tuning(prev => ({
    ...prev,
    hero_targetProminence: DEFAULT_V3_TUNING.hero_targetProminence * heroProminence,
  }));
  setHeroProminence(1.0);  // Reset slider to new baseline
}, [heroProminence]);
```

### 2. Update the Slider Component

**File: `src/components/HeroScaleSlider.tsx`**

Rename to `HeroProminenceSlider` and update the UI to communicate the relative nature:

```typescript
/**
 * Slider for adjusting hero prominence (relative size).
 * Range: 70% to 130% — makes hero bigger/smaller relative to other photos.
 */
export function HeroProminenceSlider({ 
  value, 
  onChange, 
  onCommit,
  disabled = false,
}: HeroProminenceSliderProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Hero</span>
      <Slider
        value={[value * 100]}
        onValueChange={([v]) => onChange(v / 100)}
        onValueCommit={([v]) => onCommit?.(v / 100)}
        min={70}
        max={130}
        step={5}
        disabled={disabled}
        className="w-20 [&>span:first-child]:bg-muted-foreground/30"
      />
      <span className="text-xs text-muted-foreground tabular-nums w-8">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}
```

### 3. Wire Up in CollageSettings

**File: `src/components/CollageSettings.tsx`**

Pass the prominence callbacks:

```typescript
<HeroProminenceSlider
  value={heroProminence}
  onChange={onHeroProminenceChange}
  onCommit={onHeroProminenceCommit}
  disabled={!hasHero}
/>
```

### 4. Remove Unused `scaledLayout` Logic

**File: `src/pages/Index.tsx`**

Delete the `scaledLayout` useMemo and the old uniform-scale commit handler. Pass `state.layout` directly to `CollagePreview`.

---

## Why This Works

| Slider Value | `hero_targetProminence` | Effect |
|--------------|------------------------|--------|
| 70% | 1.05 | Hero is 30% smaller relative to content |
| 100% | 1.50 (default) | Default hero prominence |
| 130% | 1.95 | Hero is 30% larger relative to content |

The algorithm:
1. Receives modified prominence parameter
2. Sizes hero based on content area × prominence
3. Packs content into remaining regions
4. Hero becomes more/less prominent without shuffling

---

## User Experience

1. Upload photos → mark one as hero
2. See "Hero" slider in settings bar
3. Drag slider → layout regenerates instantly with different hero/content ratio
4. Release slider → prominence is committed
5. Export reflects the adjusted prominence

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/HeroScaleSlider.tsx` | Rename to `HeroProminenceSlider`, update labels |
| `src/components/CollageSettings.tsx` | Use new component and props |
| `src/pages/Index.tsx` | Replace scale logic with prominence-based regeneration |

---

## Performance Note

Regenerating on every drag step might feel laggy for complex layouts. If that becomes an issue, we can:
1. Debounce the regeneration (e.g., 100ms)
2. Show "updating..." feedback during drag
3. Only regenerate on commit (loses live preview)

For now, let's try immediate regeneration since V3 is fast (~10-50ms).
