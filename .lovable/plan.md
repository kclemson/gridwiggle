
# Simplify Carousel Hero Indicator

## Overview

Two quick changes to clean up the carousel UI and prevent button size jumps when toggling hero status.

---

## Changes

### 1. Remove On-Photo Hero Badge

**Current** (lines 133-139):
```tsx
{/* Hero badge */}
{isHero && (
  <div className="absolute top-2 left-2 bg-yellow-500 text-yellow-950 px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1">
    <Star className="h-3 w-3 fill-current" />
    Hero
  </div>
)}
```

**Change**: Delete this entire block. The purple button below already indicates hero status clearly.

---

### 2. Use Consistent Button Text

**Current** (line 164):
```tsx
{photo.priority === 1 ? 'Hero' : 'Mark as hero (larger)'}
```

**Change**: Always show "Hero" regardless of state:
```tsx
Hero
```

The button's visual styling (default/purple vs outline) already communicates the toggled state, so the text doesn't need to change.

---

## Files Summary

| File | Lines | Change |
|------|-------|--------|
| `src/components/PhotoCarousel.tsx` | 133-139 | Remove hero badge overlay |
| `src/components/PhotoCarousel.tsx` | 164 | Change to static "Hero" text |

---

## Result

- Cleaner photo display without redundant badge
- Button stays consistent size when toggling hero on/off
- Purple fill + filled star still clearly indicates hero status
