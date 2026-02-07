
# Three Changes: Thumbnail Navigator, Carousel Loop, V3 Default

## Overview

Three targeted changes to improve UX and promote V3 to production.

---

## 1. Remove White Outline on Unloaded Thumbnails

**Problem**: In the "View All" navigator, the current carousel position shows a white/purple ring outline even when the thumbnail hasn't loaded yet, appearing as an empty box with just an outline (looks buggy).

**Solution**: Only show the ring when the thumbnail is actually loaded.

**File**: `src/components/ThumbnailNavigator.tsx`

**Change** (line 119):
```tsx
// Before
isSelected && "ring-2 ring-primary ring-offset-2"

// After - only show ring when both selected AND loaded
isSelected && isLoaded && "ring-2 ring-primary ring-offset-2"
```

---

## 2. Enable Carousel Looping

**Problem**: When the user reaches the last photo and clicks the right arrow, nothing happens. They expect it to loop back to the first photo.

**Solution**: Enable Embla's built-in loop option.

**File**: `src/components/PhotoCarousel.tsx`

**Change** (line 38):
```tsx
// Before
loop: false,

// After
loop: true,
```

This automatically makes the navigation arrows always active and enables infinite scrolling in both directions.

---

## 3. Make V3 the Default Algorithm in Production

**Problem**: V3 is ready for production, but the algorithm selection is tied to the dev-only DebugPanel. Need to ensure V3 is always used regardless of environment.

**Solution**: Change the generateLayout function to always use V3, removing the conditional branch.

**File**: `src/pages/Index.tsx`

**Current** (lines 118-129):
```tsx
// Use v1 or v3 algorithm based on selection
const layout = algorithmVersion === 'v3'
  ? generateCollageLayoutV3(photosToUse, settings, { 
      photoWeights,
      randomize,
      tuning: tuningOverride,
    })
  : generateCollageLayout(photosToUse, settings, { 
      photoWeights,
      randomize,
      tuning: DEFAULT_TUNING,
    });
```

**After**:
```tsx
// V3 is the production algorithm
// In dev mode, algorithmVersion toggle in DebugPanel can override
const useV3 = !import.meta.env.DEV || algorithmVersion === 'v3';

const layout = useV3
  ? generateCollageLayoutV3(photosToUse, settings, { 
      photoWeights,
      randomize,
      tuning: tuningOverride,
    })
  : generateCollageLayout(photosToUse, settings, { 
      photoWeights,
      randomize,
      tuning: DEFAULT_TUNING,
    });
```

This ensures:
- **Production**: Always uses V3 (no toggle available)
- **Development**: Respects the DebugPanel toggle for A/B testing during development

---

## Files Summary

| File | Change |
|------|--------|
| `src/components/ThumbnailNavigator.tsx` | Show ring only when thumbnail is loaded |
| `src/components/PhotoCarousel.tsx` | Enable `loop: true` for infinite scrolling |
| `src/pages/Index.tsx` | Make V3 the default, with dev-only fallback toggle |
