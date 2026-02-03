
# Remove useEffect Anti-Pattern from CollagePreview

After reviewing all `useEffect` usages in the codebase, I found one significant violation of the architectural principles.

---

## Issue Found

**File:** `src/components/CollagePreview.tsx` (lines 28-43)

```typescript
useEffect(() => {
  const updateScale = () => {
    const container = containerRef.current;
    if (!container) return;

    const maxWidth = container.clientWidth;
    const maxHeight = container.clientHeight || 600;
    const scaleX = maxWidth / layout.width;
    const scaleY = maxHeight / layout.height;
    setScale(Math.min(scaleX, scaleY, 1));
  };

  updateScale();
  window.addEventListener('resize', updateScale);
  return () => window.removeEventListener('resize', updateScale);
}, [layout.width, layout.height]);
```

**Problem:** This is the same anti-pattern we just fixed in CropEditor - using `useEffect` to read container dimensions and store in state. The initial calculation could cause a flash of incorrect scale (scale=1 before useEffect runs).

---

## Other useEffects Reviewed (All Valid)

| File | Purpose | Why It's OK |
|------|---------|-------------|
| `use-mobile.tsx` | Media query listener | External browser API subscription |
| `use-toast.ts` | Pub/sub listener | External state system subscription |
| `carousel.tsx` | Embla library integration | Third-party library callbacks |
| `sidebar.tsx` | Keyboard shortcut listener | Event listener subscription |
| `NotFound.tsx` | Console error logging | Minor - acceptable for 404 logging |

---

## Solution for CollagePreview

Replace the state-based scale calculation with CSS-based sizing. The collage can be sized using CSS transforms or percentage-based dimensions, similar to how we fixed CropEditor.

**Approach:**
1. Remove the `scale` state and `useEffect`
2. Use CSS `transform: scale()` with a scale factor computed from the container's actual dimensions
3. Use ResizeObserver only if dynamic resize handling is truly needed (not for initial render)

**Alternative simpler approach:**
Since the layout has fixed pixel dimensions, we can use CSS to scale it:
- Set `max-width: 100%` on the container
- Use `aspect-ratio` CSS property to maintain proportions
- Let the browser handle responsive scaling

---

## File Changes

### `src/components/CollagePreview.tsx`

**Remove:**
- `scale` state variable
- The `useEffect` that subscribes to window resize

**Add:**
- CSS-based scaling using a wrapper with `max-width` and `aspect-ratio`
- Compute scale on-demand when needed (e.g., for positioning calculations)

The key insight: We don't need React state to track scale. The container's actual rendered size is the source of truth, and we can read it when needed via refs rather than syncing it to state on every resize.
