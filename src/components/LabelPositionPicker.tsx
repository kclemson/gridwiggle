import { LabelPosition } from '@/types/collage';
import { cn } from '@/lib/utils';

const POSITIONS: LabelPosition[] = ['tl', 'tc', 'tr', 'bl', 'bc', 'br'];

interface LabelPositionPickerProps {
  value: LabelPosition;
  onChange: (p: LabelPosition) => void;
  className?: string;
}

/** 3×2 dot grid for choosing one of six label anchor positions. */
export function LabelPositionPicker({ value, onChange, className }: LabelPositionPickerProps) {
  return (
    <div
      className={cn('grid grid-cols-3 gap-0.5 shrink-0', className)}
      role="radiogroup"
      aria-label="Label position"
    >
      {POSITIONS.map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={value === p}
          aria-label={`Label position ${p}`}
          onClick={() => onChange(p)}
          className={cn(
            'h-3 w-3 border border-muted-foreground/40 transition-colors',
            value === p ? 'bg-foreground' : 'bg-transparent hover:bg-muted-foreground/20',
          )}
        />
      ))}
    </div>
  );
}