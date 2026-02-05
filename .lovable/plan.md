
# Fix: Touch Events Triggering Drag on Star Button Tap

## Problem

When tapping the star button on mobile:
1. The cell's `onTouchStart` fires first, setting `touchDragId`
2. This immediately shows a floating 100x100px drag preview thumbnail
3. The star button's `stopPropagation()` is too late to prevent this
4. User sees the original cell PLUS a floating thumbnail at their finger position

The "two stars" appearance is the original hero star badge PLUS the floating drag preview (which shows the photo, potentially with its star visible).

## Root Cause

React's `stopPropagation()` on the star button's `onTouchStart` doesn't prevent the parent's `onTouchStart` from firing because:
- Events bubble from target to ancestors
- The parent handler fires during the bubbling phase
- By the time the child's handler runs, the parent already received the event

## Solution

Modify `handleTouchStart` in `CollagePreview.tsx` to check if the touch target is an interactive element (button) before initiating drag:

```typescript
const handleTouchStart = useCallback((e: React.TouchEvent, photoId: string) => {
  // Don't start drag if touching an interactive element (like the star button)
  const target = e.target as HTMLElement;
  if (target.closest('button')) {
    return;
  }
  
  const touch = e.touches[0];
  setTouchDragId(photoId);
  setTouchPosition({ x: touch.clientX, y: touch.clientY });
}, []);
```

This check ensures:
- Tapping the star button → no drag initiated → just toggles hero
- Tapping anywhere else on the cell → drag works as expected

## Secondary Issue: Duplicate Remove Buttons in PhotoThumbnail

`PhotoThumbnail.tsx` has **two remove buttons** at the same position (lines 77-98):
1. Desktop version with hover opacity
2. Mobile version with `md:hidden`

On mobile, both can be visible due to touch triggering CSS `:hover` states. This should be consolidated to a single button with responsive styling.

### Fix

Replace the two buttons with one that works for both:

```typescript
<button
  onClick={(e) => {
    e.stopPropagation();
    onRemove();
  }}
  className={cn(
    "absolute top-1 right-1 rounded-full bg-background/80 text-foreground transition-all",
    "hover:bg-destructive hover:text-destructive-foreground",
    // Mobile: always visible, touch-friendly size
    "p-2 opacity-100",
    // Desktop: smaller, hover-only
    "md:p-1.5 md:opacity-0 md:group-hover:opacity-100"
  )}
  aria-label="Remove photo"
>
  <X className="h-4 w-4" />
</button>
```

## Files Changed

| File | Change |
|------|--------|
| `src/components/CollagePreview.tsx` | Add `target.closest('button')` check in `handleTouchStart` |
| `src/components/PhotoThumbnail.tsx` | Consolidate two remove buttons into one with responsive styling |

## Summary

- **Primary fix**: 2-line addition to skip drag when touching buttons
- **Secondary fix**: Remove duplicate button, use responsive classes instead
- Both issues stem from mobile touch events behaving differently than desktop pointer events
