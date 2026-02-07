
# Quick UX Fixes for V3Test

## Changes

### 1. Default `showRejected` to `true`

**File:** `src/pages/V3Test.tsx` (line 189)

Change from:
```tsx
const [showRejected, setShowRejected] = useState(false);
```
To:
```tsx
const [showRejected, setShowRejected] = useState(true);
```

### 2. Remove all `animate-pulse-soft` classes

**File:** `src/pages/V3Test.tsx`

- Line 252: Remove from the header REJECTED badge
- Line 324: Remove from the canvas ring around rejected layout

### 3. Make "Showing Rejected" button red when viewing a rejected layout

**File:** `src/pages/V3Test.tsx` (lines 259-267)

Change the button to use destructive variant when both `showRejected` is true AND we're viewing a rejected layout (`!layout && rejectedLayout`):

```tsx
<Button 
  onClick={() => setShowRejected(s => !s)}
  variant={showRejected && !layout && rejectedLayout ? "destructive" : showRejected ? "default" : "outline"}
  size="sm"
  className="gap-2"
>
```

---

## Summary

| Change | Location |
|--------|----------|
| Default `showRejected` to `true` | Line 189 |
| Remove pulse from header badge | Line 252 |
| Remove pulse from canvas ring | Line 324 |
| Red button when viewing rejection | Lines 259-267 |
