

# Add Always-Visible Generate Button

## Problem

The "Generate Collage" / "Shuffle" button is currently only visible when `state.layout` exists (line 326). If layout generation fails or returns null for any reason, the user is stuck with no way to retry.

From the screenshot: 18 photos are loaded, settings are visible, but there's no collage and no button to generate one.

## Solution

Add a "Generate Collage" button that appears when:
- There are 2+ photos AND
- No collage layout exists yet (or layout generation failed)

This gives users a way to manually trigger collage generation as a recovery mechanism.

## Technical Changes

### File: `src/pages/Index.tsx`

Move the generate button outside the `{state.layout && ...}` conditional, with logic to show either:
1. **"Generate Collage"** - when there's no layout but 2+ photos
2. **"Shuffle"** - when layout already exists (current behavior)

```tsx
{/* Generate/Shuffle button - ALWAYS visible when 2+ photos */}
{state.photos.length >= 2 && (
  <div className="pt-4 border-t border-border">
    {!state.layout ? (
      // No layout yet - show Generate button
      <Button 
        onClick={handleCreateCollage}
        className="w-full"
      >
        <Grid3X3 className="h-4 w-4 mr-2" />
        Generate Collage
      </Button>
    ) : (
      // Layout exists - show collage preview with shuffle/download
      <div className="space-y-2">
        {/* ...existing header row with Shuffle + Download buttons... */}
        {/* ...existing CollagePreview... */}
      </div>
    )}
  </div>
)}
```

### Button States

| Condition | Button Shown |
|-----------|--------------|
| 0-1 photos | No button (need 2+ for collage) |
| 2+ photos, no layout | "Generate Collage" button (full-width) |
| 2+ photos, layout exists | Shuffle icon + Download icon (current UI) |

## Visual Placement

The button will appear below the Configure section, in the same position where the collage preview normally shows. This keeps the UI consistent - there's always something actionable in that spot when conditions are met.

## Edge Case: Error Recovery

If `generateCollageLayout` throws an error, wrap it in try/catch to show a toast and keep the button visible:

```tsx
const regenerateCollage = useCallback((options: RegenerateOptions = {}) => {
  // ... existing setup ...
  
  try {
    const layout = generateCollageLayout(photos, settings, { 
      photoWeights,
      randomize,
    });
    setLayout(layout);
  } catch (error) {
    console.error('Layout generation failed:', error);
    toast.error('Failed to generate collage. Try again.');
    // Don't call setLayout(null) - keep button visible
  }
}, [state.settings, setLayout]);
```

## Files Modified

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Restructure JSX to show Generate button when no layout exists; add try/catch to `regenerateCollage` |

