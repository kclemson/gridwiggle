

## Improve Color Swatch Appearance

### Current Issue
The color picker is `w-6 h-6` (24x24px) which appears small and slightly rectangular compared to the toggle buttons and slider controls.

### Changes

**File: `src/components/CollageSettings.tsx`**

1. **Increase swatch size** - Change from `w-6 h-6` to `w-8 h-8` (32x32px) to better match the visual weight of the toggle buttons

2. **Ensure square aspect ratio** - Add `aspect-square` class to guarantee it stays square

3. **Change label** - Update "Color:" to "Background:"

4. **Update aria-label** - Change from "Gap color" to "Background color" for accessibility

### Code Change

Line 42:
```diff
- <span className="text-xs text-muted-foreground">Color:</span>
+ <span className="text-xs text-muted-foreground">Background:</span>
```

Lines 43-49:
```diff
  <input
    type="color"
    value={settings.gapColor}
    onChange={(e) => onUpdate({ gapColor: e.target.value })}
-   className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent"
-   aria-label="Gap color"
+   className="w-8 h-8 aspect-square rounded border border-border cursor-pointer bg-transparent"
+   aria-label="Background color"
  />
```

### Visual Result

Before:
```
Color: [■]  (24x24px, slightly small)
```

After:
```
Background: [██]  (32x32px, visually balanced with toggles)
```

### Files to Modify

| File | Change |
|------|--------|
| `src/components/CollageSettings.tsx` | Resize color swatch to 32x32px, rename label to "Background:" |

