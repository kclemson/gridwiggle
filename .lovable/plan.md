

# Streamline Progress Display and Fix Z-Index

## Problems

1. **Duplicate progress info**: Progress dots appear both in header AND expanded carousel
2. **Redundant count**: During processing, showing both "(51)" and "X of 51 ready" is noisy
3. **Z-index bug**: Error overlay appears behind star buttons

---

## Design

### Header States

**During processing:**
```
PHOTOS  ·  7 of 51 ready  ▼
```
- No "(51)" in parentheses - the "of 51" already conveys the total
- Emerald colored progress text

**After processing complete:**
```
PHOTOS (51)  ▼
```
- Normal count in parentheses
- No progress text

---

## Technical Changes

### 1. File: `src/pages/Index.tsx`

**A. Update header to conditionally show count vs progress (lines 408-423)**

```tsx
<CollapsibleTrigger asChild>
  <button className="flex items-center justify-between w-full px-1 py-2 text-left hover:bg-muted/50 rounded-lg transition-colors">
    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
      {isProcessing ? (
        // During processing: "PHOTOS · X of Y ready"
        <>
          Photos
          <span className="mx-2 text-muted-foreground/50">·</span>
          <span className="text-emerald-600 normal-case tracking-normal">
            {state.photos.filter(p => !p.isProcessing && !p.error).length} of {state.photos.length} ready
          </span>
        </>
      ) : (
        // After complete: "PHOTOS (Y)"
        `Photos (${state.photos.length})`
      )}
    </h3>
    
    {/* Remove the PhotoProgressDots from header entirely */}
    
    <ChevronDown ... />
  </button>
</CollapsibleTrigger>
```

**B. Fix error overlay z-index (line 533)**

```tsx
// Add z-20 to be above z-10 star buttons
<div className="absolute inset-0 ... z-20">
```

---

### 2. File: `src/components/PhotoProcessingView.tsx`

**Remove the "X ready" stats line** - this info is now in the header

Keep:
- Current photo thumbnail with spinner
- Progress dots (centered below thumbnail)
- Error count only (if any failures)

Remove:
- The "X ready" text and its container

---

## File Summary

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Conditional header text (processing vs complete), remove dots, add z-20 to error overlay |
| `src/components/PhotoProcessingView.tsx` | Remove "X ready" stats, keep dots and error count |

---

## Result

- **Clean header**: Shows progress OR count, never both
- **No duplication**: Ready count in header only, dots in expanded carousel only
- **Fixed z-index**: Error overlay properly covers star buttons

