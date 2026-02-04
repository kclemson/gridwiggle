

# Add Tooltips to Tuning Inputs

## Overview

Add native HTML `title` attribute tooltips to each tuning input, so hovering over the label or input shows a description of what the parameter does.

## Tooltip Descriptions

| Parameter | Label | Tooltip |
|-----------|-------|---------|
| `maxBeside3Row` | 3-Row Max | Max photos packed beside hero when using 3-row mode |
| `maxBeside2Row` | 2-Row Max | Max photos packed beside hero when using 2-row mode |
| `threeRowThreshold` | 3-Row At | Use 3-row mode when this many photos are beside hero |
| `contentPhotosPerBlock` | Per Block | Photos per standard content row |
| `heroMinFraction` | Min Frac | Minimum hero width as fraction of canvas (0.3 = 30%) |
| `heroMaxFraction` | Max Frac | Maximum hero width as fraction of canvas (0.6 = 60%) |
| `scaleToleranceLow` | Scale Low | Reject layouts where photos shrink below this (0.75 = 75%) |
| `scaleToleranceHigh` | Scale High | Reject layouts where photos grow above this (1.25 = 125%) |

## Implementation

### File: `src/components/TuningSection.tsx`

1. **Add `tooltip` prop to `TuningInputProps`** interface
2. **Apply `title` attribute** to the wrapper `div` so both label and input show the tooltip on hover
3. **Pass tooltip strings** to each `TuningInput` call

```typescript
interface TuningInputProps {
  label: string;
  tooltip: string;  // <-- add this
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

function TuningInput({ label, tooltip, value, onChange, step = 1, min, max }: TuningInputProps) {
  return (
    <div className="flex flex-col gap-1" title={tooltip}>
      <Label className="text-[10px] text-muted-foreground font-normal">{label}</Label>
      <Input ... />
    </div>
  );
}
```

This is the simplest approach - native browser tooltips with no extra dependencies. They appear on hover after a short delay and work on both the label and input.

