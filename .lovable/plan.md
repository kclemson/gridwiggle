

# Show Default Values in Balance Control Inputs

## Overview

Add visual indication of default values for the three balance tuning parameters (`maxBesideFraction`, `minContentPhotos`, `minPhotosPerRow`) so users can easily see what the recommended defaults are while experimenting.

## Approach

Extend the `TuningInput` component to accept an optional `defaultValue` prop, then display it in the label (e.g., "Max Beside % (0.6)"). This keeps the UI clean while providing the reference.

## Implementation

### Update TuningInput Component

Add `defaultValue` prop and display it in the label:

```tsx
interface TuningInputProps {
  label: string;
  tooltip: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  defaultValue?: number;  // NEW
}

function TuningInput({ label, tooltip, value, onChange, step = 1, min, max, defaultValue }: TuningInputProps) {
  return (
    <div className="flex flex-col gap-1" title={tooltip}>
      <Label className="text-[10px] text-muted-foreground font-normal">
        {label}
        {defaultValue !== undefined && (
          <span className="text-muted-foreground/60 ml-1">({defaultValue})</span>
        )}
      </Label>
      {/* ... rest unchanged ... */}
    </div>
  );
}
```

### Update Balance Control Inputs

Pass the default values from `DEFAULT_TUNING`:

```tsx
import { LayoutTuning, DEFAULT_TUNING } from '@/types/collage';

// ... in Row 3: Balance controls ...
<TuningInput
  label="Max Beside %"
  tooltip="Hero row can consume at most this fraction of total photos (0.6 = 60%)"
  value={tuning.maxBesideFraction}
  onChange={(v) => onTuningChange('maxBesideFraction', v)}
  step={0.05}
  min={0.3}
  max={0.9}
  defaultValue={DEFAULT_TUNING.maxBesideFraction}
/>
<TuningInput
  label="Min Content"
  tooltip="Always reserve at least this many photos for content rows"
  value={tuning.minContentPhotos}
  onChange={(v) => onTuningChange('minContentPhotos', v)}
  min={0}
  max={10}
  defaultValue={DEFAULT_TUNING.minContentPhotos}
/>
<TuningInput
  label="Min/Row"
  tooltip="Content rows must have at least this many photos"
  value={tuning.minPhotosPerRow}
  onChange={(v) => onTuningChange('minPhotosPerRow', v)}
  min={1}
  max={4}
  defaultValue={DEFAULT_TUNING.minPhotosPerRow}
/>
```

## Files to Modify

1. `src/components/TuningSection.tsx` - Add `defaultValue` prop to `TuningInput` and pass it for the three balance controls

