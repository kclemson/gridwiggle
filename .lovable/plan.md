

# Fix Processing Thumbnail for Large Photo Batches (with Auto-Scroll)

## Problem Summary

When uploading 40+ photos, the progress dots wrap to multiple rows. The thumbnail hovers above its specific dot using `absolute bottom-full`, but this positions it relative to just that dot's container — causing it to overlap with the row above.

---

## Design Intent

**What behavior do we want?**
- Keep the thumbnail hovering directly above its specific dot (the pointer effect)
- Prevent the thumbnail from colliding with dots in upper rows
- Auto-scroll to keep the currently-processing dot visible

**What will users experience?**
- The thumbnail always clearly points to its dot
- Single-row horizontal scroll for large batches
- The active dot automatically scrolls into view as processing progresses
- No manual scrolling required to track progress

---

## Technical Approach

1. Make the dots container single-row with horizontal scroll (no wrapping)
2. Use a `ref` on the currently-processing dot
3. Call `scrollIntoView({ behavior: 'smooth', inline: 'center' })` when the processing dot changes

---

## Implementation Details

### File: `src/components/PhotoProgressDots.tsx`

**Change 1: Add useRef and useEffect for auto-scroll**

```tsx
import { useRef, useEffect } from 'react';

// Inside component:
const activeRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (activeRef.current) {
    activeRef.current.scrollIntoView({ 
      behavior: 'smooth', 
      inline: 'center',
      block: 'nearest' 
    });
  }
}, [currentlyProcessingId]);
```

**Change 2: Restructure container for single-row scroll with reserved space**

```tsx
return (
  <div className={cn("flex flex-col items-center", className)}>
    {/* Reserve space for thumbnail above */}
    <div className="h-14" />
    
    <div className="flex gap-1 overflow-x-auto max-w-xs px-2 scrollbar-hide">
      {photos.map((photo) => {
        const isProcessing = photo.id === currentlyProcessingId;
        // ... rest of logic
        
        return (
          <div 
            key={photo.id} 
            ref={isProcessing ? activeRef : null}
            className="relative flex-shrink-0"
          >
            {/* Thumbnail positioned above */}
            {isProcessing && currentPhoto && (
              <div className="absolute -top-14 left-1/2 -translate-x-1/2">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shadow-sm">
                  <img src={currentPhoto.objectUrl} ... />
                </div>
              </div>
            )}
            
            {/* The dot */}
            <div className={cn("w-2 h-2 rounded-full ...", ...)} />
          </div>
        );
      })}
    </div>
  </div>
);
```

**Key additions:**
- `ref={isProcessing ? activeRef : null}` — attach ref only to active dot
- `flex-shrink-0` — prevent dots from shrinking
- `useEffect` with `scrollIntoView()` — auto-center active dot when it changes

### File: `src/index.css`

**Add scrollbar-hide utility:**

```css
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

---

## Auto-Scroll Behavior

As processing moves from photo 1 → 2 → 3 → ... → 40:

```
Step 1:  [thumb]
         ○●●●●●●●●●●●●→   (dot 1 centered)
         
Step 20: ←●●●●●●●[thumb]●●●●●●●●→   (dot 20 scrolled to center)
              ○
              
Step 40: ←●●●●●●●●●●●●●●[thumb]●●→   (dot 40 scrolled to center)
                         ○
```

The user never needs to manually scroll — the active dot stays centered.

---

## File Changes Summary

| File | Location | Change |
|------|----------|--------|
| PhotoProgressDots.tsx | Top | Add `useRef`, `useEffect` imports |
| PhotoProgressDots.tsx | Lines 17-52 | Restructure to single-row scroll with ref + auto-scroll |
| index.css | End of file | Add `.scrollbar-hide` utility |

