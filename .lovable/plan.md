

## Fix Three Settings Row Issues

### Issues Identified

1. **Invisible separators** - The separator divs exist but may not be rendering visibly. Will increase opacity and add a fallback approach.

2. **Color swatch too round** - `rounded-md` (6px) on a 24x24px element creates nearly circular appearance. Need smaller radius.

3. **Slider track too dark** - `bg-secondary` is `hsl(240 5% 15%)` which is nearly invisible against `bg-surface` (`hsl(240 8% 8%)`).

### Solution

**1. Make separators visible**
Change from `bg-muted-foreground/30` to `bg-muted-foreground/50` (50% opacity for more visibility), or use a solid lighter color.

**2. Less rounded color swatch**
Change from `rounded-md` to `rounded-sm` (2px radius) for a square with subtle rounded corners.

**3. Lighter slider track**
Override the slider track's background with a visible color like `bg-muted-foreground/30` or `bg-border`.

### Technical Changes

**File: `src/components/CollageSettings.tsx`**

**Separators (lines 50, 65):**
```tsx
// Before
<div className="w-px h-6 bg-muted-foreground/30" />

// After - higher contrast
<div className="w-px h-6 bg-muted-foreground/50" />
```

**Color input (line 59):**
```tsx
// Before
className="w-6 h-6 rounded-md cursor-pointer appearance-none border-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-md [&::-moz-color-swatch]:border-0"

// After - less rounded (rounded-sm = 2px instead of rounded-md = 6px)
className="w-6 h-6 rounded-sm cursor-pointer appearance-none border-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-sm [&::-moz-color-swatch]:border-0"
```

**Slider (lines 70-77):**
```tsx
// Before
<Slider
  value={[settings.gapSize]}
  onValueChange={([value]) => onUpdate({ gapSize: value })}
  min={0}
  max={32}
  step={2}
  className="w-20"
/>

// After - with custom lighter track via CSS override
<Slider
  value={[settings.gapSize]}
  onValueChange={([value]) => onUpdate({ gapSize: value })}
  min={0}
  max={32}
  step={2}
  className="w-20 [&>span:first-child]:bg-muted-foreground/30"
/>
```

The `[&>span:first-child]:bg-muted-foreground/30` targets the Track element and gives it a visible lighter gray background.

### Visual Result

Before:
```
Orientation: Landscape  Portrait  Background: (●)  Gap: ──●── 12px
             (no separators)        (circle)        (invisible track)
```

After:
```
Orientation: Landscape  Portrait │ Background: [■] │ Gap: ──●── 12px
                                 ↑             ↑           ↑
                           visible pipe  square-ish   visible track
```

### Files to Modify

| File | Change |
|------|--------|
| `src/components/CollageSettings.tsx` | Increase separator opacity, reduce color swatch rounding, add visible slider track |

