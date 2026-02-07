
# Inline Settings Row

## What Changes

Replace the collapsible "Configure" section with a simple inline row showing both settings side by side.

**Current:**
```
┌─────────────────────────────────────────┐
│  [Collage Preview]                      │
├─────────────────────────────────────────┤
│  CONFIGURE                          ▼   │  ← collapsible header
│  Background              [color picker] │  ← hidden by default
│  Spacing                     [slider]   │
└─────────────────────────────────────────┘
```

**Proposed:**
```
┌─────────────────────────────────────────┐
│  [Collage Preview]                      │
├─────────────────────────────────────────┤
│  Background [🎨]     Spacing [──●──]    │  ← always visible, single row
└─────────────────────────────────────────┘
```

---

## Technical Changes

### File: `src/components/CollageSettings.tsx`

**Complete rewrite** - remove collapsible, show inline row:

```tsx
import { CollageSettings as CollageSettingsType } from '@/types/collage';
import { Slider } from '@/components/ui/slider';

interface CollageSettingsProps {
  settings: CollageSettingsType;
  onUpdate: (updates: Partial<CollageSettingsType>) => void;
}

export function CollageSettings({ settings, onUpdate }: CollageSettingsProps) {
  return (
    <div className="flex items-center justify-between gap-6 py-2 px-1">
      {/* Background color */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Background</span>
        <input
          type="color"
          value={settings.gapColor}
          onChange={(e) => onUpdate({ gapColor: e.target.value })}
          className="w-8 h-6 rounded cursor-pointer border border-muted-foreground/30 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded [&::-moz-color-swatch]:border-0"
          aria-label="Background color"
        />
      </div>
      
      {/* Spacing */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Spacing</span>
        <Slider
          value={[settings.gapSize]}
          onValueChange={([value]) => onUpdate({ gapSize: value })}
          min={0}
          max={100}
          step={5}
          className="w-20 [&>span:first-child]:bg-muted-foreground/30"
        />
      </div>
    </div>
  );
}
```

**Removed:**
- `useState` hook for collapsible state
- `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger` imports
- `ChevronDown` icon import
- `cn` utility import
- `STORAGE_KEY` constant
- `handleOpenChange` function
- All collapsible wrapper JSX

**Simplified styling:**
- Color picker: `w-8 h-6` (smaller, more compact)
- Slider: `w-20` (slightly narrower)
- Row layout: `flex items-center justify-between gap-6`

---

## Result

- Settings are always visible (no hidden state)
- Controls are closer to their labels
- Less vertical space used
- Simpler component with no state management
- localStorage key `collage-settings-open` becomes unused (can be cleaned up later if desired)

---

## Summary

| File | Change |
|------|--------|
| `src/components/CollageSettings.tsx` | Remove collapsible wrapper, show inline row with both settings |
