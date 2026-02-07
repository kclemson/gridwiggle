

# Redesign Header Typography

## Problem
The current header with the pixelated emoji icon and "gridwiggle.com" text feels disconnected from the app's modern, minimal dark-mode aesthetic.

---

## Design Direction

The app's vibe is:
- **Dark, modern, and minimal** - charcoal backgrounds, subtle borders
- **Purple accent color** - used for CTAs and focus states
- **Playful product name** - "gridwiggle" suggests creative, fun energy

The header should feel like a modern creative tool, not a corporate site.

---

## Proposed Header Design

**Remove:**
- The favicon.png icon

**Typography approach:**
```text
grid wiggle
└──┘ └────┘
gray purple
```

- Split the name visually: "grid" in muted gray, "wiggle" in purple accent
- Use slightly lighter font weight and tracking for elegance
- Drop the ".com" - cleaner, more app-like

This creates a subtle "logo" effect using only typography and color.

---

## Technical Changes

### File: `src/pages/Index.tsx`

**Lines 388-392**: Replace the current header content

```tsx
// Before:
<h1 className="text-lg font-semibold flex items-center gap-2">
  <img src="/favicon.png" alt="" className="h-5 w-5" />
  gridwiggle.com
</h1>

// After:
<h1 className="text-lg font-medium tracking-wide">
  <span className="text-muted-foreground">grid</span>
  <span className="text-primary">wiggle</span>
</h1>
```

**Design details:**
- `font-medium` instead of `font-semibold` - more elegant
- `tracking-wide` - adds subtle letter-spacing for a refined feel
- "grid" uses `text-muted-foreground` (gray) - subtle, recedes
- "wiggle" uses `text-primary` (purple) - pops, memorable

---

## Visual Result

The header will display:

```text
┌────────────────────────────────────────┐
│  gridwiggle              [Clear All]   │
│   ↑    ↑                               │
│  gray purple                           │
└────────────────────────────────────────┘
```

This approach:
- Removes the mismatched icon
- Creates a memorable typographic identity
- Uses the app's existing color palette
- Feels modern and tool-like rather than "website-y"

---

## Summary

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Remove favicon img, split name into "grid" (gray) + "wiggle" (purple), adjust typography classes |

