

## Add Labels to Settings Controls

### Current State (too minimal)
```
SETTINGS
[🔲|🔳] | [■] | Gap [--slider--] 8px
```

### Proposed Layout
```
SETTINGS
Orientation: [Landscape] [Portrait] | Color: [■] | Gap: [--slider--] 8px
```

### Changes

**File: `src/components/CollageSettings.tsx`**

1. **Replace icon toggle with text buttons** - Use "Landscape" and "Portrait" text instead of icons

2. **Add labels before each control**:
   - "Orientation:" before the toggle group
   - "Color:" before the color picker  
   - "Gap:" (with colon) before the slider

3. **Keep compact layout** - All still fits on one row with the narrower slider

### Updated Structure

```tsx
<div className="flex items-center gap-3 p-2 rounded-lg bg-surface border border-border">
  {/* Orientation with label */}
  <div className="flex items-center gap-2">
    <span className="text-xs text-muted-foreground">Orientation:</span>
    <ToggleGroup type="single" value={settings.orientation} onValueChange={...}>
      <ToggleGroupItem value="landscape" size="sm">
        <span className="text-xs">Landscape</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="portrait" size="sm">
        <span className="text-xs">Portrait</span>
      </ToggleGroupItem>
    </ToggleGroup>
  </div>
  
  {/* Separator */}
  <div className="w-px h-6 bg-border" />
  
  {/* Color with label */}
  <div className="flex items-center gap-2">
    <span className="text-xs text-muted-foreground">Color:</span>
    <input type="color" className="w-6 h-6 ..." />
  </div>
  
  {/* Separator */}
  <div className="w-px h-6 bg-border" />
  
  {/* Gap with colon */}
  <div className="flex items-center gap-2">
    <span className="text-xs text-muted-foreground">Gap:</span>
    <Slider className="w-20" ... />
    <span className="text-xs text-muted-foreground w-6">{gapSize}px</span>
  </div>
</div>
```

### Visual Result

Before:
```
SETTINGS
┌─────────────────────────────────────────────────────────┐
│ [🔲|🔳]  │  [■]  │  Gap [━━●━━] 8px                     │
└─────────────────────────────────────────────────────────┘
```

After:
```
SETTINGS
┌──────────────────────────────────────────────────────────────────────────┐
│ Orientation: [Landscape] [Portrait]  │  Color: [■]  │  Gap: [━━●━━] 8px  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Import Changes

Remove the Lucide icons since we're using text now:
```diff
- import { RectangleHorizontal, RectangleVertical } from 'lucide-react';
```

### Files to Modify

| File | Change |
|------|--------|
| `src/components/CollageSettings.tsx` | Add text labels, replace icons with text in toggle buttons |

