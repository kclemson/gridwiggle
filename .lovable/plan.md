

# Move Thumbnail Below Dots with Better Spacing

## Problem Summary

Looking at your screenshot:
1. There's a large vertical gap between the header and the dots (from `pt-16` on the parent)
2. The thumbnail is currently above the dots but too close to them
3. You want the layout inverted: dots on top, thumbnail below with some breathing room

## Design Intent

**What behavior do we want?**
- Dots appear near the top of the processing section (less wasted vertical space)
- Thumbnail appears BELOW the dots, pointing up to its dot
- A comfortable gap between dots and thumbnail

**What will users experience?**
- More compact vertical layout
- Clearer visual hierarchy: progress bar first, then the current photo preview below

## Visual Comparison

**Current layout:**
```
                              ← lots of empty space
      [thumbnail]             ← thumbnail above, cramped
●●●●●●●○●●●●●●●●●●           ← dots
```

**New layout:**
```
●●●●●●●○●●●●●●●●●●           ← dots at top
        ↓
      [thumbnail]             ← thumbnail below with gap
```

## Implementation Details

### File: `src/components/PhotoProgressDots.tsx`

**Changes:**
1. Swap the order: render dots container FIRST, then thumbnail container
2. Change thumbnail positioning from `bottom-0` to `top-0` (since it's now below)
3. Adjust the reserved space height and add a small gap (`mt-3`) between dots and thumbnail

```tsx
return (
  <div className={cn("flex flex-col items-center", className)}>
    {/* Dots scroll container - NOW FIRST */}
    <div 
      ref={containerRef}
      className="flex gap-1 overflow-x-auto max-w-xs px-2 scrollbar-hide"
    >
      {/* ... dots mapping unchanged ... */}
    </div>
    
    {/* Thumbnail - NOW BELOW dots, with gap */}
    <div className="h-14 mt-3 relative w-full flex justify-center">
      <div className="relative max-w-xs w-full px-2">
        {currentPhoto && thumbnailOffset !== null && (
          <div 
            className="absolute top-0 -translate-x-1/2 z-10"
            style={{ left: thumbnailOffset }}
          >
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shadow-sm">
              <img ... />
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);
```

### File: `src/components/PhotoProcessingView.tsx`

**Change:** Reduce the top padding from `pt-16` to `pt-8` to bring the dots closer to the header.

```tsx
// Line 26: change pt-16 to pt-8
<div className="space-y-4 pt-8">
```

## File Changes Summary

| File | Location | Change |
|------|----------|--------|
| PhotoProgressDots.tsx | Lines 56-75 | Swap order: dots first, then thumbnail container |
| PhotoProgressDots.tsx | Line 58 | Add `mt-3` for gap between dots and thumbnail |
| PhotoProgressDots.tsx | Line 62 | Change `bottom-0` to `top-0` for downward positioning |
| PhotoProcessingView.tsx | Line 26 | Reduce `pt-16` to `pt-8` |

