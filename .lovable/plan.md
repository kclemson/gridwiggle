
# Collapsed Photos Section with Progress Dots

## Goal
Replace the jarring auto-collapse behavior with a better UX: the photos section starts collapsed by default, but shows progress dots in the header so users can see processing status without expanding.

---

## Design

### User Experience
- **Fresh upload**: Photos section stays collapsed, but header shows progress dots filling in
- **Click to expand**: Full carousel UI with all controls, just like today
- **Processing visible**: Dots in header turn green as photos complete, one pulses during active processing
- **No jarring transitions**: Nothing collapses on you unexpectedly

### Header When Collapsed (During Processing)
```
PHOTOS (5)  [●●○○○○○○○○]  ▼
            ↑ green = ready, pulse = processing, gray = pending
```

---

## Technical Changes

### 1. Create Progress Dots Component
**New file: `src/components/PhotoProgressDots.tsx`**

A small, reusable component showing the dot indicators:
- Green dot: photo ready (not processing, no error)
- Pulsing primary dot: currently processing
- Red dot: error
- Gray dot: pending

This extracts the existing dots logic from `PhotoProcessingView` into a reusable piece.

### 2. Update `src/pages/Index.tsx`

**A. Change default state (line 63-66)**
```tsx
// Before: defaults to true (open)
return saved !== null ? saved === 'true' : true;

// After: defaults to false (collapsed)
return saved !== null ? saved === 'true' : false;
```

**B. Remove auto-collapse useEffect (lines 341-353)**
Delete the entire effect that watches `isProcessing` and triggers collapse.

Also remove the `wasProcessingRef` (line 68-69) since it's no longer needed.

**C. Update collapsible trigger to show progress dots (lines 427-440)**

Instead of showing `PhotoProcessingView` separately OR the collapsible, always show the collapsible. The header includes:
- "PHOTOS (count)" label
- Progress dots (when photos exist and any are processing)
- Chevron

```tsx
<CollapsibleTrigger asChild>
  <button className="flex items-center justify-between w-full ...">
    <h3 className="text-xs font-medium ...">
      Photos ({state.photos.length})
    </h3>
    
    {/* Show progress dots when processing */}
    {isProcessing && (
      <PhotoProgressDots 
        photos={state.photos}
        currentlyProcessingId={currentlyProcessingId}
      />
    )}
    
    <ChevronDown ... />
  </button>
</CollapsibleTrigger>
```

**D. Show full UI when expanded during processing**

When expanded (`carouselOpen === true`), show the full `PhotoProcessingView` or carousel inside the content area, just like today.

**E. Remove the hint text (lines 491-493)**
```tsx
// Delete this:
<span className="text-xs text-muted-foreground font-normal italic">
  Drag to rearrange • Tap ★ to feature
</span>
```

---

## File Summary

| File | Change |
|------|--------|
| `src/components/PhotoProgressDots.tsx` | **New** - Extracted dots component |
| `src/pages/Index.tsx` | Default to collapsed, remove auto-collapse, add dots to header, remove hint text |
| `src/components/PhotoProcessingView.tsx` | Import and use `PhotoProgressDots` (optional refactor) |

---

## Result
- No jarring collapse transition
- Progress always visible in header dots
- Expand for full details anytime
- Cleaner collage section without instruction text
