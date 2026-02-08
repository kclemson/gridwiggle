
# Fix Thumbnail Clipping in Progress Dots

## Problem

The thumbnail is invisible because of a CSS overflow quirk:
- The dots container has `overflow-x-auto` for horizontal scrolling
- When `overflow-x` is set to anything except `visible`, browsers automatically set `overflow-y: auto`
- This clips the thumbnail that's positioned with `absolute -top-14`

CSS rule: You cannot have `overflow-x: scroll/auto` with `overflow-y: visible` — both axes must be non-visible if one is.

## Solution

Move the thumbnail **outside** the scroll container and calculate its position using JavaScript. This preserves the "pointer" effect while avoiding the clipping.

---

## Implementation Details

### File: `src/components/PhotoProgressDots.tsx`

**Approach**:
1. Add a ref to the scroll container to track its scroll position
2. Add a ref to the active dot to get its `offsetLeft`
3. Render the thumbnail in the reserved `h-14` space above the scroll container
4. Use state to track the thumbnail's left offset, updated when the active dot changes or container scrolls

```tsx
import { useRef, useEffect, useState } from 'react';

export function PhotoProgressDots({ ... }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const [thumbnailOffset, setThumbnailOffset] = useState<number | null>(null);

  // Update thumbnail position when active dot changes or scroll happens
  useEffect(() => {
    const updatePosition = () => {
      if (activeRef.current && containerRef.current) {
        const dotRect = activeRef.current.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        // Center of dot relative to container
        const offset = dotRect.left - containerRect.left + dotRect.width / 2;
        setThumbnailOffset(offset);
      }
    };
    
    updatePosition();
    
    // Also update on scroll
    const container = containerRef.current;
    container?.addEventListener('scroll', updatePosition);
    return () => container?.removeEventListener('scroll', updatePosition);
  }, [currentlyProcessingId]);

  // Auto-scroll to active dot
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        inline: 'center',
        block: 'nearest' 
      });
    }
  }, [currentlyProcessingId]);

  return (
    <div className="flex flex-col items-center relative">
      {/* Thumbnail - OUTSIDE scroll container, positioned via JS */}
      <div className="h-14 relative w-full">
        {currentPhoto && thumbnailOffset !== null && (
          <div 
            className="absolute bottom-0 -translate-x-1/2"
            style={{ left: `calc(50% - ${containerWidth / 2}px + ${thumbnailOffset}px)` }}
          >
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shadow-sm">
              <img src={currentPhoto.objectUrl} className="w-full h-full object-cover" />
            </div>
          </div>
        )}
      </div>
      
      {/* Dots scroll container - ref added */}
      <div 
        ref={containerRef}
        className="flex gap-1 overflow-x-auto max-w-xs px-2 scrollbar-hide"
      >
        {photos.map((photo) => {
          const isProcessing = photo.id === currentlyProcessingId;
          // ...
          return (
            <div 
              key={photo.id} 
              ref={isProcessing ? activeRef : null}
              className="flex-shrink-0"
            >
              {/* Dot only - thumbnail moved outside */}
              <div className={cn("w-2 h-2 rounded-full ...", ...)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## Visual Result

```
                [thumbnail]      ← Rendered ABOVE scroll container
                    ↓
←  ●●●●●●●○●●●●●●●●●●●●●●●  →    ← Scroll container (no clipping)
```

The thumbnail follows the active dot's horizontal position via JavaScript calculation, staying perfectly above it even when scrolling.

---

## File Changes Summary

| Location | Change |
|----------|--------|
| Line 1 | Add `useState` import |
| Lines 18-19 | Add `containerRef` and `thumbnailOffset` state |
| Lines 20-35 | Add position calculation effect with scroll listener |
| Lines 43-55 | Move thumbnail to h-14 spacer area with calculated position |
| Line 57 | Add `ref={containerRef}` to scroll container |
| Lines 64-72 | Simplify dot wrapper (remove thumbnail rendering inside) |
