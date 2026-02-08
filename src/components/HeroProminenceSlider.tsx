import { Slider } from '@/components/ui/slider';

interface HeroProminenceSliderProps {
  /** Current scale factor (1.0 = default) */
  value: number;
  /** Called on every drag movement for live preview */
  onChange: (scale: number) => void;
  /** Called when user releases slider - commit the scale */
  onCommit?: (scale: number) => void;
  disabled?: boolean;
}

/**
 * Slider for adjusting hero scale (relative size).
 * Range: 70% to 130% — makes hero bigger/smaller relative to other photos.
 * Now uses synchronous reflow for instant feedback.
 */
export function HeroProminenceSlider({ 
  value, 
  onChange, 
  onCommit,
  disabled = false,
}: HeroProminenceSliderProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Hero</span>
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
