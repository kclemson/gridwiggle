
## Auto-Regenerate Collage on Settings Change

### Problem Analysis

**Issue 1: Gap slider doesn't auto-regenerate**
- Background color updates live because CollagePreview just uses it as CSS (`backgroundColor: gapColor`)
- Gap size requires layout regeneration because cell positions are calculated based on gap in `calculateLayout()`
- Currently, changing gap size only marks layout as "stale" requiring manual button click

**Issue 2: Orientation not being applied**
- Orientation affects `targetAspect` and row distribution in `findBestRowSplit()`
- Same problem - changing orientation marks layout stale but doesn't regenerate
- The screenshot shows "Landscape" selected but a portrait-shaped collage (generated before the orientation change)

### Solution

Auto-regenerate the collage whenever gap size OR orientation changes (when a layout already exists).

**Key principle:** Settings that only affect CSS (gapColor) update instantly. Settings that affect layout geometry (gapSize, orientation) trigger regeneration.

### Technical Changes

**File: `src/pages/Index.tsx`**

Modify `handleUpdateSettings` to auto-regenerate when layout-affecting settings change:

```tsx
const handleUpdateSettings = useCallback((updates: Partial<CollageSettingsType>) => {
  updateSettings(updates);
  
  // Auto-regenerate collage for layout-affecting settings
  if (state.layout && ('gapSize' in updates || 'orientation' in updates)) {
    // Create new settings with updates applied
    const newSettings = { ...state.settings, ...updates };
    const newLayout = generateCollageLayout(state.photos, newSettings);
    setLayout(newLayout);
  }
  // gapColor updates don't need regeneration - CollagePreview uses it directly as CSS
}, [updateSettings, state.layout, state.settings, state.photos, setLayout]);
```

This approach:
- Only regenerates when necessary (gapSize or orientation changes)
- Uses the updated settings to generate the new layout immediately
- gapColor still updates instantly without regeneration (CSS-only change)
- Removes the need for layoutStale flag for these settings

**Optional refinement:** If the user is actively dragging the slider, we could debounce the regeneration to avoid excessive recalculations. However, since `generateCollageLayout` is synchronous and fast, immediate regeneration should feel responsive.

### Visual Result

Before:
```
User changes gap: 8px → 12px
Layout marked "stale" with ring around button
User must click "Regenerate Collage"
```

After:
```
User changes gap: 8px → 12px
Collage immediately regenerates with 12px gaps
No manual button click needed
```

Same for orientation:
```
User clicks "Portrait"
Collage immediately regenerates with portrait aspect ratio
```

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Update `handleUpdateSettings` to auto-regenerate for gapSize/orientation changes |

