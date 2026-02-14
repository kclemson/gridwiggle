import { CollageSettings as CollageSettingsType, CollageLayout, MIN_PHOTOS_FOR_SHAPE_SLIDER } from '@/types/collage';
import { Slider } from '@/components/ui/slider';
import { ShapeIndicator } from '@/components/ShapeIndicator';
import { arToSliderPosition } from '@/lib/shapeSlider';
import { cn } from '@/lib/utils';

interface CollageSettingsProps {
  settings: CollageSettingsType;
  layout: CollageLayout | null;
  photoCount: number;
  onUpdate: (updates: Partial<CollageSettingsType>) => void;
}

const SIZE_OPTIONS: { label: string; value: 1 | 1.5 | 2 }[] = [
  { label: 'S', value: 1 },
  { label: 'M', value: 1.5 },
  { label: 'L', value: 2 },
];

export function CollageSettings({ settings, layout, photoCount, onUpdate }: CollageSettingsProps) {
  // Slider always reflects the current layout AR (truthful display)
  const displayPosition = layout
    ? arToSliderPosition(layout.width / layout.height)
    : 50; // Default to center when no layout

  const shapeDisabled = photoCount < MIN_PHOTOS_FOR_SHAPE_SLIDER;

  return (
    <div className="grid grid-cols-4 gap-x-3 py-2 px-1">
      {/* Row 1: Controls */}
      <div className="flex items-center justify-center">
        <input
          type="color"
          value={settings.gapColor}
          onChange={(e) => onUpdate({ gapColor: e.target.value })}
          className="w-8 h-6 rounded cursor-pointer border border-muted-foreground/30 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded [&::-moz-color-swatch]:border-0"
          aria-label="Background color"
        />
      </div>

      <div className={cn(
        "flex items-center justify-center gap-1.5",
        shapeDisabled && "opacity-40 pointer-events-none"
      )}>
        <ShapeIndicator position={displayPosition} />
        <Slider
          value={[displayPosition]}
          onValueChange={([value]) => onUpdate({ shapeSlider: value })}
          disabled={shapeDisabled}
          min={0}
          max={100}
          step={5}
          className="w-16 [&>span:first-child]:bg-muted-foreground/30"
        />
      </div>

      <div className="flex items-center justify-center">
        <Slider
          value={[settings.gapSize]}
          onValueChange={([value]) => onUpdate({ gapSize: value })}
          min={0}
          max={100}
          step={5}
          className="w-14 [&>span:first-child]:bg-muted-foreground/30"
        />
      </div>

      <div className="flex items-center justify-center">
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

      {/* Row 2: Labels */}
      <span className="text-[10px] text-muted-foreground text-center">Background</span>
      <span className="text-[10px] text-muted-foreground text-center">Shape</span>
      <span className="text-[10px] text-muted-foreground text-center">Spacing</span>
      <span className="text-[10px] text-muted-foreground text-center">Size</span>
    </div>
  );
}
