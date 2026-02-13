

# Add Export Size Preset to Settings Row

## What Users Get

A new "Size" control on the right side of the settings bar -- a compact segmented toggle with three options controlling PNG download resolution:

- **S** -- 1x scale (~1000px wide, messaging/quick share)
- **M** -- 1.5x scale (~1500px wide, social/screens)
- **L** -- 2x scale (~2000px wide, prints/high-res)

The settings row becomes a balanced three-column layout:

```text
|  Background [#]    Spacing [===]    Size [S|M|L]  |
```

## Technical Changes

### 1. Update type -- `src/types/collage.ts`

Add `exportScale: 1 | 1.5 | 2` to the `CollageSettings` interface.

### 2. Update default -- `src/hooks/useCollageState.ts`

Add `exportScale: 1` to the `defaultSettings` object.

### 3. Rebuild settings row -- `src/components/CollageSettings.tsx`

- Three equal `flex-1` columns (left-align / center / right-align)
- New right-aligned "Size" segmented toggle: three small buttons (S, M, L)
- Active button gets a filled background; inactive are ghost-style
- Styled consistently with existing labels (`text-sm text-muted-foreground`)

### 4. Wire into export -- `src/pages/Index.tsx`

Pass `state.settings.exportScale` to `exportCollageAsPng` as the `scale` argument.

### 5. No new dependencies

Plain Tailwind-styled buttons for the toggle.

