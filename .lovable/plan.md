

## Refine Settings Row Styling

### Issues to Fix

1. **Underline too wide** - Currently applied to ToggleGroupItem which has padding, making underline wider than text
2. **Vertical gap too large** - Border-bottom has too much space from the text
3. **Border cuts off content** - The outer border doesn't contain the "12px" label
4. **Need subtle separators** - Simple vertical pipes between sections

### Solution

**1. Move underline to the text span** - Apply the border directly to the inner `<span>` instead of the ToggleGroupItem, so it matches text width exactly

**2. Reduce vertical gap** - Use `pb-0.5` (2px padding) on the span to bring underline closer to text

**3. Remove outer border** - Remove `border border-border` from the container, keep just `bg-surface` for subtle distinction

**4. Keep separators** - The existing `<div className="w-px h-6 bg-border" />` separators are already simple pipes - they'll remain

### Technical Changes

**File: `src/components/CollageSettings.tsx`**

**Container (line 19):**
```tsx
// Before
<div className="flex items-center gap-3 p-2 rounded-lg bg-surface border border-border">

// After - remove border, keep subtle background
<div className="flex items-center gap-3 p-2 rounded-lg bg-surface">
```

**Toggle Items - move underline to inner span:**
```tsx
// Before
<ToggleGroupItem 
  value="landscape" 
  size="sm"
  className="data-[state=on]:bg-transparent data-[state=on]:text-foreground data-[state=on]:border-b-2 data-[state=on]:border-foreground data-[state=on]:rounded-b-none data-[state=off]:text-muted-foreground"
>
  <span className="text-xs">Landscape</span>
</ToggleGroupItem>

// After - underline on span, not toggle item
<ToggleGroupItem 
  value="landscape" 
  size="sm"
  className="data-[state=on]:bg-transparent data-[state=off]:bg-transparent hover:bg-transparent"
>
  <span className={`text-xs pb-0.5 ${settings.orientation === 'landscape' ? 'text-foreground border-b border-foreground' : 'text-muted-foreground'}`}>
    Landscape
  </span>
</ToggleGroupItem>
```

Using conditional class based on `settings.orientation` since we can't use `data-[state=on]` on the inner span.

### Visual Result

Before:
```
┌─────────────────────────────────────────────────────────┐
│ Orientation: [Landscape̲̲̲̲̲̲̲̲̲̲]  Portrait │ Background: [■] │ Gap: ──●── 12px
└─────────────────────────────────────────────────────────┘
                  ↑ wide underline                              ↑ cut off
```

After:
```
  Orientation: Landscape  Portrait │ Background: [■] │ Gap: ──●── 12px
                  ̲̲̲̲̲̲̲̲̲̲̲
              ↑ tight underline    ↑ simple pipe separators, no outer border
```

### Files to Modify

| File | Change |
|------|--------|
| `src/components/CollageSettings.tsx` | Remove outer border, move underline to inner span with tighter spacing |

