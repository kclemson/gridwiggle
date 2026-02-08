import { Slider } from '@/components/ui/slider';

interface HeroScaleSliderProps {
  /** Current scale factor (1.0 = default) */
  value: number;
  /** Called on every drag movement for live preview */
  onChange: (scale: number) => void;
  /** Called when user releases slider - commit the scale with the value */
  onCommit?: (scale: number) => void;
  disabled?: boolean;
}

/**
 * Slider for adjusting hero photo size.
 * Range: 70% to 130% of default size.
 * Scales the entire layout uniformly to preserve relative positions.
 */
export function HeroScaleSlider({ 
  value, 
  onChange, 
  onCommit,
  disabled = false,
}: HeroScaleSliderProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Size</span>
      <Slider
        value={[value * 100]}
        onValueChange={([v]) => onChange(v / 100)}
        onValueCommit={([v]) => onCommit?.(v / 100)}
        min={70}
        max={130}
        step={5}
        disabled={disabled}
        className="w-20 [&>span:first-child]:bg-muted-foreground/30"
      />
      <span className="text-xs text-muted-foreground tabular-nums w-8">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}
