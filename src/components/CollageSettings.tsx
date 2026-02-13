import { CollageSettings as CollageSettingsType } from '@/types/collage';
import { Slider } from '@/components/ui/slider';

interface CollageSettingsProps {
  settings: CollageSettingsType;
  onUpdate: (updates: Partial<CollageSettingsType>) => void;
}

const SIZE_OPTIONS: { label: string; value: 1 | 1.5 | 2 }[] = [
  { label: 'S', value: 1 },
  { label: 'M', value: 1.5 },
  { label: 'L', value: 2 },
];

export function CollageSettings({ settings, onUpdate }: CollageSettingsProps) {
  return (
    <div className="flex items-center py-2 px-1">
      {/* Left: Background color */}
      <div className="flex-1 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Background</span>
        <input
          type="color"
          value={settings.gapColor}
          onChange={(e) => onUpdate({ gapColor: e.target.value })}
          className="w-8 h-6 rounded cursor-pointer border border-muted-foreground/30 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded [&::-moz-color-swatch]:border-0"
          aria-label="Background color"
        />
      </div>

      {/* Center: Spacing */}
      <div className="flex-1 flex items-center justify-center gap-2">
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

      {/* Right: Export size */}
      <div className="flex-1 flex items-center justify-end gap-2">
        <span className="text-sm text-muted-foreground">Size</span>
        <div className="flex rounded-md border border-muted-foreground/30 overflow-hidden">
          {SIZE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onUpdate({ exportScale: opt.value })}
              className={`px-2 py-0.5 text-xs font-medium transition-colors ${
                settings.exportScale === opt.value
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label={`Export size ${opt.label}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
