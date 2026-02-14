

# HTML Tooltip on Disabled Shape Slider

## What changes

Replace the planned Radix Tooltip import with a simple `title` attribute on the shape control wrapper. This provides native browser hover tooltips on desktop and long-press tooltips on mobile, with zero extra imports or components.

## Technical change

**`src/components/CollageSettings.tsx`** (line ~38-42): Add a `title` attribute to the shape control's wrapper `div`, conditionally set when disabled.

```tsx
<div
  className={cn(
    "flex items-center justify-center gap-1.5",
    shapeDisabled && "opacity-40 pointer-events-none"
  )}
  title={shapeDisabled ? `Shape requires ${MIN_PHOTOS_FOR_SHAPE_SLIDER}+ photos` : undefined}
>
```

One line added, no new imports. The `pointer-events-none` class needs to be removed (since it blocks hover/tap from reaching the element for the title to show). Instead, rely solely on the `disabled` prop on the Slider and the `opacity-40` for visual indication.

Updated approach:

```tsx
<div
  className={cn(
    "flex items-center justify-center gap-1.5",
    shapeDisabled && "opacity-40"
  )}
  title={shapeDisabled ? `Shape requires ${MIN_PHOTOS_FOR_SHAPE_SLIDER}+ photos` : undefined}
>
```

This way the `title` tooltip works on hover, while the slider's own `disabled` prop prevents interaction.

