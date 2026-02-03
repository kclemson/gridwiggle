

## Compact Settings Row Redesign

### Current Layout (2 rows)
```
Row 1: [Orientation label] [Landscape btn] [Portrait btn]
Row 2: [Color label] [picker] [Gap label] [--slider---] [8px]
```

### New Layout (header + 1 row)
```
SETTINGS                              (styled like photo grid headers)
[🔲|🔳 toggle] [■ picker] [Gap] [--slider--] [8px]
```

### Changes

**File: `src/components/CollageSettings.tsx`**

1. **Add SETTINGS header** - Match PhotoGrid styling: `text-xs font-medium text-muted-foreground uppercase tracking-wide`

2. **Replace RadioGroup with ToggleGroup** - More compact, just icons, no labels needed

3. **Combine all controls in one row**:
   - Orientation toggle (landscape/portrait icons only, no text)
   - Color picker (smaller, no label)
   - Gap slider (narrower, constrained with `max-w-[120px]`)

### New Structure

```tsx
<div className="space-y-2">
  {/* Header - matching PhotoGrid style */}
  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
    Settings
  </h3>
  
  {/* All settings in one row */}
  <div className="flex items-center gap-3 p-2 rounded-lg bg-surface border border-border">
    {/* Orientation toggle - icons only */}
    <ToggleGroup type="single" value={orientation} onValueChange={...}>
      <ToggleGroupItem value="landscape" size="sm">
        <RectangleHorizontal className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="portrait" size="sm">
        <RectangleVertical className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
    
    {/* Separator */}
    <div className="w-px h-6 bg-border" />
    
    {/* Color picker - smaller, no label */}
    <input type="color" className="w-6 h-6 rounded ..." />
    
    {/* Separator */}
    <div className="w-px h-6 bg-border" />
    
    {/* Gap slider - narrower */}
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Gap</span>
      <Slider className="w-20" ... />
      <span className="text-xs text-muted-foreground w-6">{gapSize}px</span>
    </div>
  </div>
</div>
```

### Visual Result

Before:
```
┌─────────────────────────────────────────────────┐
│ Orientation  [□ Landscape] [□ Portrait]         │
│ Color [■]    Gap [━━━━━━━━━●━━━━━━━━━━━━] 8px   │
└─────────────────────────────────────────────────┘
```

After:
```
SETTINGS
┌─────────────────────────────────────────────────┐
│ [🔲|🔳]  │  [■]  │  Gap [━━●━━] 8px             │
└─────────────────────────────────────────────────┘
```

### Import Changes

```diff
- import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
+ import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
```

### Files to Modify

| File | Change |
|------|--------|
| `src/components/CollageSettings.tsx` | Redesign to compact single-row layout with header |

