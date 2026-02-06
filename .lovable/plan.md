

# Fix: Layout Rating Tool Shape Display for Hero Layouts

## Problem

The Layout Rating Tool shows explicit shapes (PORTRAIT, LANDSCAPE, SQUARE) in the banner even when there's a hero photo. This is confusing because:

1. **In the real app**: When any photo is marked as hero, the shape dropdown is forced to "Auto" and disabled
2. **In the test tool**: Test cases are generated with explicit shapes + heroes - a combination users can never trigger
3. **Visual confusion**: A banner saying "PORTRAIT (50)" for a hero layout implies we're testing a real user scenario, but we're not

## Solution

Two-part fix to align the test tool with real app behavior:

### Part 1: Update Test Case Generation

When generating test cases WITH a hero, always use `shape: 'auto'` to match real app behavior:

```typescript
// In generateTestBatch():
for (const photoCount of TEST_PHOTO_COUNTS) {
  const hasHero = Math.random() < 0.8;
  
  if (hasHero) {
    // Hero layouts ALWAYS use 'auto' (matches app UX constraint)
    cases.push({
      photos: generatePhotoSet(photoCount, distribution, true),
      shape: 'auto',
      hasHero: true,
      distribution,
    });
  } else {
    // No-hero layouts can test all shapes
    const shapes = ['auto', 'landscape', 'portrait', 'square'].filter(
      s => s === 'auto' || isShapeAvailable(s, photoCount)
    );
    for (const shape of shapes) {
      cases.push({...});
    }
  }
}
```

### Part 2: Update Banner Display

Show more informative labels that distinguish:
- Hero layouts: Show "AUTO + HERO (50)" instead of just shape
- Non-hero layouts: Show the actual shape being tested

Also show the **resulting** canvas aspect category for hero layouts, since that's what we're actually evaluating:

```tsx
// Banner content logic:
if (hasHero) {
  // Show "AUTO + HERO" since that's what's being tested
  // Also show resulting aspect: "(50) → landscape"
  const resultAspect = canvasAspect > 1.2 ? 'landscape' 
                     : canvasAspect < 0.85 ? 'portrait' 
                     : 'square-ish';
  label = `AUTO + HERO (${photoCount}) → ${resultAspect}`;
} else {
  // No hero: show explicit shape being tested
  label = `${shape.toUpperCase()} (${photoCount})`;
}
```

## Visual Design

Current confusing banner:
```
┌────────────────────────────────────────┐
│         PORTRAIT (50)                  │  ← Implies we're testing portrait constraint
└────────────────────────────────────────┘
```

Proposed clearer banner:
```
┌────────────────────────────────────────┐
│   AUTO + HERO (50) → portrait          │  ← Shows: input (auto), output (portrait result)
└────────────────────────────────────────┘
```

Or for non-hero:
```
┌────────────────────────────────────────┐
│         LANDSCAPE (50)                 │  ← Testing explicit landscape constraint
└────────────────────────────────────────┘
```

## Files Modified

| File | Changes |
|------|---------|
| `src/test/layout/layoutAdapter.ts` | Hero layouts always use `shape: 'auto'`; non-hero layouts test explicit shapes |
| `src/pages/LayoutRating.tsx` | Banner shows "AUTO + HERO (N) → result" for hero layouts |

## Testing Impact

This change means:
- **Hero layouts** (80% of cases): Only test `auto` shape since that's what users can actually do
- **Non-hero layouts** (20% of cases): Continue testing all shapes for regression coverage
- The resulting canvas aspect is shown as the "output" rather than the "input shape"

This aligns the test tool with real app behavior and makes the banner informative about what's actually being evaluated.

