
# Fix: Hero Scale Slider Not Persisting Changes

## The Problem

When you drag the hero size slider and release it at a value other than 100%, the scale resets back to 100% instead of persisting the new size.

**Root cause**: A state race condition between the slider's value updates and the commit handler.

## What's Happening

1. User drags slider from 100% → 70%
2. `onValueChange` fires → `setHeroScale(0.7)` (async state update)
3. User releases slider → `onValueCommit` fires → `handleHeroScaleCommit()` runs
4. But `heroScale` in the callback closure might still be stale (not yet 0.7)
5. The useEffect watching `state.layout` then resets `heroScale` to 1.0
6. Net result: slider snaps back to 100%

## The Fix

**Change 1**: Pass the current slider value directly to the commit handler instead of reading from state.

**Change 2**: In the commit handler, use the passed value instead of reading `heroScale` from state.

---

## Technical Implementation

### File: `src/components/HeroScaleSlider.tsx`

Pass the current value through `onCommit`:

```typescript
interface HeroScaleSliderProps {
  value: number;
  onChange: (scale: number) => void;
  onCommit?: (scale: number) => void;  // Changed: now receives the value
  disabled?: boolean;
}

// In the Slider component:
<Slider
  value={[value * 100]}
  onValueChange={([v]) => onChange(v / 100)}
  onValueCommit={([v]) => onCommit?.(v / 100)}  // Pass value directly
  // ...
/>
```

### File: `src/components/CollageSettings.tsx`

Update the prop type to match:

```typescript
onHeroScaleCommit?: (scale: number) => void;  // Now receives scale value
```

### File: `src/pages/Index.tsx`

Update `handleHeroScaleCommit` to use the passed value:

```typescript
const handleHeroScaleCommit = useCallback((scale: number) => {
  if (!state.layout || scale === 1.0) return;
  
  const newLayout = {
    width: Math.round(state.layout.width * scale),
    height: Math.round(state.layout.height * scale),
    cells: state.layout.cells.map(cell => ({
      ...cell,
      x: Math.round(cell.x * scale),
      y: Math.round(cell.y * scale),
      width: Math.round(cell.width * scale),
      height: Math.round(cell.height * scale),
    })),
  };
  
  setLayout(newLayout);
}, [state.layout, setLayout]);  // Removed heroScale dependency
```

---

## Why This Works

By passing the slider value directly from `onValueCommit`, we bypass the React state timing issue entirely. The commit handler receives the exact value the slider was at when released, guaranteed to be fresh.

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/HeroScaleSlider.tsx` | Pass value through `onCommit` callback |
| `src/components/CollageSettings.tsx` | Update prop type signature |
| `src/pages/Index.tsx` | Use passed value in commit handler |

---

## Visual Behavior After Fix

1. Drag slider to 70% → preview scales down in real-time
2. Release slider → 70% scale is committed to layout dimensions
3. Slider resets to 100% (new base) but layout stays at the smaller size
4. Export uses the scaled dimensions
