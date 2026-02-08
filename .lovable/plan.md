
# Hero Resize Slider: Scale Without Repacking

## What Users Experience Now

When you change hero size, there's no way to do it interactively:
- Hero sizing is computed automatically by the layout algorithm
- To adjust, you have to regenerate the entire layout (reshuffles photos, repacks rows)
- No fine-grained control over hero prominence

## What Users Should Experience

1. Hero photo shows a **resize handle** or slider when selected/focused
2. Drag the slider → hero scales up/down
3. **All other photos scale proportionally** to maintain their relative positions
4. No repacking, no reflow, no worker call — pure CSS transform (instant)
5. On release, commit the scaled layout to state

---

## Design Intent

**Problem**: Users want to adjust hero size without losing their current arrangement.

**Outcome**: Hero prominence becomes a live-adjustable parameter. Photos scale together like zooming a layer in Photoshop — positions and proportions stay locked.

---

## Technical Approach

### The Math

When hero size changes by a scale factor `s`:
- Hero dimensions: `width × s`, `height × s`
- All content cells: same `× s` applied to width/height
- All cell positions (x, y): same `× s` 
- Canvas dimensions: `× s`

This is uniform scaling — aspect ratios preserved, relative positions preserved.

### Why This Works

The V3 layout is already in normalized space (hero height = 1.0). A "hero scale" is just a multiplier applied to the final pixel conversion. We store a `heroScale` factor (default 1.0) and apply it at render time.

---

## Implementation Plan

### 1. Add Hero Scale State

**File: `src/pages/Index.tsx`**

```typescript
// Hero scale factor for live adjustment (1.0 = default)
const [heroScale, setHeroScale] = useState(1.0);

// Reset scale when layout regenerates
// (new layout = new base, scale starts at 1.0)
useEffect(() => {
  setHeroScale(1.0);
}, [state.layout]);
```

### 2. Create Hero Scale Slider Component

**New file: `src/components/HeroScaleSlider.tsx`**

A dedicated slider for adjusting hero prominence:

```typescript
interface HeroScaleSliderProps {
  value: number;           // Current scale (0.5 to 1.5)
  onChange: (scale: number) => void;
  disabled?: boolean;
}
```

- Range: 0.7 to 1.3 (±30% from default)
- Shows visual feedback of current scale %
- Lives near CollageSettings or in the collage header

### 3. Apply Scale to CollagePreview

**File: `src/components/CollagePreview.tsx`**

Add a `scale` prop that uniformly transforms the layout:

```typescript
interface CollagePreviewProps {
  // ... existing props
  scale?: number;  // 1.0 = normal, 0.5 = 50%, 1.5 = 150%
}

// Apply to container style
style={{
  maxWidth: effectiveMaxWidth * scale,
  aspectRatio: `${layout.width} / ${layout.height}`,  // Unchanged
  transform: `scale(${scale})`,
  transformOrigin: 'top center',
}}
```

**Alternative approach** (preferred): Apply scale to canvas dimensions passed to the preview:

```typescript
// In Index.tsx, compute scaled layout
const scaledLayout = useMemo(() => {
  if (!state.layout || heroScale === 1.0) return state.layout;
  return {
    width: Math.round(state.layout.width * heroScale),
    height: Math.round(state.layout.height * heroScale),
    cells: state.layout.cells.map(cell => ({
      ...cell,
      x: Math.round(cell.x * heroScale),
      y: Math.round(cell.y * heroScale),
      width: Math.round(cell.width * heroScale),
      height: Math.round(cell.height * heroScale),
    })),
  };
}, [state.layout, heroScale]);
```

This approach keeps CollagePreview pure (no scale logic).

### 4. Commit Scale on Release

When user finishes dragging the slider:
- Write scaled dimensions back to layout state
- Reset heroScale to 1.0 (new base)

```typescript
const handleScaleCommit = useCallback(() => {
  if (!state.layout || heroScale === 1.0) return;
  
  const scaledLayout = {
    width: Math.round(state.layout.width * heroScale),
    height: Math.round(state.layout.height * heroScale),
    cells: state.layout.cells.map(cell => ({
      ...cell,
      x: Math.round(cell.x * heroScale),
      y: Math.round(cell.y * heroScale),
      width: Math.round(cell.width * heroScale),
      height: Math.round(cell.height * heroScale),
    })),
  };
  
  setLayout(scaledLayout);
  setHeroScale(1.0);  // Reset to new base
}, [state.layout, heroScale, setLayout]);
```

### 5. UI Placement

Add the slider to CollageSettings or CollageHeader:

```tsx
{hasHeroPhoto && state.layout && (
  <div className="flex items-center gap-2">
    <span className="text-sm text-muted-foreground">Hero Size</span>
    <Slider
      value={[heroScale * 100]}
      onValueChange={([v]) => setHeroScale(v / 100)}
      onValueCommit={() => handleScaleCommit()}
      min={70}
      max={130}
      step={5}
      className="w-24"
    />
    <span className="text-xs text-muted-foreground w-8">
      {Math.round(heroScale * 100)}%
    </span>
  </div>
)}
```

---

## Edge Cases

| Case | Behavior |
|------|----------|
| No hero in layout | Slider hidden |
| Scale makes canvas too small | Clamp min scale to prevent tiny layouts |
| Photo swap after scale | Swap operates on scaled layout (already committed) |
| Regenerate/refresh | Scale resets to 1.0 |

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/HeroScaleSlider.tsx` | **New** - Hero scale slider component |
| `src/pages/Index.tsx` | Add `heroScale` state, compute scaled layout, commit handler |
| `src/components/CollageSettings.tsx` | Add hero scale slider when hero present |

---

## User Flow After Implementation

1. Upload photos → create collage with a hero
2. See "Hero Size" slider in settings (only when hero exists)
3. Drag slider → collage scales in real-time (preview updates instantly)
4. Release slider → scale commits to layout
5. Export → uses committed dimensions
