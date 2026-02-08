import { CollageSettings as CollageSettingsType } from '@/types/collage';
import { Slider } from '@/components/ui/slider';
import { HeroScaleSlider } from '@/components/HeroScaleSlider';

interface CollageSettingsProps {
  settings: CollageSettingsType;
  onUpdate: (updates: Partial<CollageSettingsType>) => void;
  /** Hero scale factor for live adjustment (1.0 = default) */
  heroScale?: number;
  /** Called on every slider drag for live preview */
  onHeroScaleChange?: (scale: number) => void;
  /** Called when user releases slider - commit the scale */
  onHeroScaleCommit?: () => void;
  /** Whether a hero photo exists in the current layout */
  hasHero?: boolean;
}

export function CollageSettings({ 
  settings, 
  onUpdate,
  heroScale,
  onHeroScaleChange,
  onHeroScaleCommit,
  hasHero = false,
}: CollageSettingsProps) {
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
      
      {/* Hero size - only shown when hero exists */}
      {hasHero && heroScale !== undefined && onHeroScaleChange && (
        <HeroScaleSlider
          value={heroScale}
          onChange={onHeroScaleChange}
          onCommit={onHeroScaleCommit}
        />
      )}
      
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
