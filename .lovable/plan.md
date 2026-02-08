
# Fix: Mobile Touch Scroll vs Drag-and-Drop Detection

## What Users Experience Now

When you touch the collage canvas on mobile:
- Your finger immediately triggers drag-and-drop mode
- You can't scroll the page by swiping over the collage
- Even a tap-and-hold (common scroll gesture) activates the drag preview

## What Users Should Experience

| Gesture | Expected Behavior |
|---------|-------------------|
| Quick swipe | Page scrolls normally |
| Tap and hold (~300ms) then move | Drag-and-drop activates |
| Tap on star button | Toggle hero (already working) |

## The Solution

Implement a **hold-to-drag** pattern with a time threshold:

1. On `touchstart`: Record the touch position and start a timer
2. On `touchmove` (before threshold): Cancel the timer if finger moves too far (user is scrolling)
3. On timer complete (300ms): Activate drag mode
4. Allow normal scrolling unless drag mode is active

---

## Technical Changes

### File: `src/components/CollagePreview.tsx`

**Add state for pending drag detection:**
```typescript
const [pendingDragId, setPendingDragId] = useState<string | null>(null);
const [touchStartPos, setTouchStartPos] = useState({ x: 0, y: 0 });
const holdTimerRef = useRef<number | null>(null);

const HOLD_THRESHOLD_MS = 300;  // Time to hold before drag activates
const MOVE_THRESHOLD_PX = 10;   // Movement tolerance during hold
```

**Update `handleTouchStart`:**
```typescript
const handleTouchStart = useCallback((e: React.TouchEvent, photoId: string) => {
  // Don't start drag if touching an interactive element
  const target = e.target as HTMLElement;
  if (target.closest('button')) return;
  
  const touch = e.touches[0];
  const startPos = { x: touch.clientX, y: touch.clientY };
  
  // Set up pending drag - don't activate immediately
  setPendingDragId(photoId);
  setTouchStartPos(startPos);
  
  // Start hold timer - only activate drag after threshold
  holdTimerRef.current = window.setTimeout(() => {
    setTouchDragId(photoId);
    setTouchPosition(startPos);
    // Haptic feedback if available
    if (navigator.vibrate) navigator.vibrate(50);
  }, HOLD_THRESHOLD_MS);
}, []);
```

**Update `handleTouchMove`:**
```typescript
const handleTouchMove = useCallback((e: React.TouchEvent) => {
  const touch = e.touches[0];
  const currentPos = { x: touch.clientX, y: touch.clientY };
  
  // If still pending (not yet activated), check if user moved too much
  if (pendingDragId && !touchDragId) {
    const dx = Math.abs(currentPos.x - touchStartPos.x);
    const dy = Math.abs(currentPos.y - touchStartPos.y);
    
    if (dx > MOVE_THRESHOLD_PX || dy > MOVE_THRESHOLD_PX) {
      // User is scrolling - cancel pending drag
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      setPendingDragId(null);
      return; // Allow normal scroll
    }
  }
  
  // If drag is active, update position
  if (touchDragId) {
    setTouchPosition(currentPos);
  }
}, [pendingDragId, touchDragId, touchStartPos]);
```

**Update `handleTouchEnd`:**
```typescript
const handleTouchEnd = useCallback((e: React.TouchEvent) => {
  // Clean up pending state
  if (holdTimerRef.current) {
    clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  }
  setPendingDragId(null);
  
  // If no active drag, nothing to do
  if (!touchDragId) return;
  
  // ... existing swap logic ...
  setTouchDragId(null);
}, [touchDragId, onSwapPhotos]);
```

**Add cleanup on unmount:**
```typescript
useEffect(() => {
  return () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }
  };
}, []);
```

---

## User-Facing Behavior After Fix

| Action | Result |
|--------|--------|
| Swipe across collage | Page scrolls normally |
| Hold finger on photo for 300ms | Drag mode activates (with haptic feedback) |
| Hold briefly then scroll | Scroll works (drag cancelled) |
| Tap star button | Hero toggle (unchanged) |

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/CollagePreview.tsx` | Add hold-to-drag detection with timer and movement threshold |

---

## Why This Pattern

This matches iOS/Android native drag behavior:
- iOS Springboard (home screen) requires hold-to-rearrange
- Android home screens work the same way
- It's the expected mobile UX for distinguishing scroll from drag
