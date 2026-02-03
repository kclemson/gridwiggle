

## Fix Settings Row Visibility & Color Swatch Styling

### Issues Identified

1. **Invisible separators** - The `bg-border` color (`hsl(240 5% 18%)`) is too close to `bg-surface` (`hsl(240 8% 8%)`) making the pipe dividers nearly invisible

2. **Color swatch double-border** - The `<input type="color">` has browser default styling that creates a white/gray inner border, plus we're adding our own border - resulting in an awkward double-box effect

### Solution

**1. Make separators visible**
- Change from `bg-border` to `bg-muted-foreground/30` (white at 30% opacity)
- This ensures visibility against any background while staying subtle

**2. Fix color swatch styling**
- Remove the outer border
- Use `appearance-none` to remove browser default chrome
- Apply `rounded-md` directly to a filled swatch
- Use CSS to target the color-swatch pseudo-element to ensure the color fills edge-to-edge

### Technical Changes

**File: `src/components/CollageSettings.tsx`**

**Separators (lines 50, 65):**
```tsx
// Before
<div className="w-px h-6 bg-border" />

// After - more visible
<div className="w-px h-6 bg-muted-foreground/30" />
```

**Color input (lines 55-61):**
```tsx
// Before
<input
  type="color"
  value={settings.gapColor}
  onChange={(e) => onUpdate({ gapColor: e.target.value })}
  className="w-8 h-8 aspect-square rounded border border-border cursor-pointer bg-transparent"
  aria-label="Background color"
/>

// After - rounded filled swatch, no double border
<input
  type="color"
  value={settings.gapColor}
  onChange={(e) => onUpdate({ gapColor: e.target.value })}
  className="w-6 h-6 rounded-md cursor-pointer appearance-none border-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-md [&::-moz-color-swatch]:border-0"
  aria-label="Background color"
/>
```

Key CSS applied:
- `appearance-none` - removes browser default styling
- `border-0` - no outer border
- `[&::-webkit-color-swatch-wrapper]:p-0` - removes internal padding in Chrome/Safari
- `[&::-webkit-color-swatch]:rounded-md` - rounds the actual color swatch
- `[&::-webkit-color-swatch]:border-0` - removes inner border
- Same for Firefox with `::-moz-color-swatch`

### Visual Result

Before:
```
Orientation: Landscape  Portrait    Background: [┌──┐]    Gap: ──●── 12px
                                                 │██│
                        (invisible)              └──┘ (double border)
```

After:
```
Orientation: Landscape  Portrait │ Background: ██ │ Gap: ──●── 12px
                  ̲̲̲̲̲̲̲̲̲̲̲                          ↑                ↑
                              visible pipe    rounded color only
```

### Files to Modify

| File | Change |
|------|--------|
| `src/components/CollageSettings.tsx` | Update separator color, fix color input to be a clean rounded swatch |

