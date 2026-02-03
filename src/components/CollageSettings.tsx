import { CollageSettings as CollageSettingsType } from '@/types/collage';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface CollageSettingsProps {
  settings: CollageSettingsType;
  onUpdate: (updates: Partial<CollageSettingsType>) => void;
}

export function CollageSettings({ settings, onUpdate }: CollageSettingsProps) {
  return (
    <div className="space-y-2">
      {/* Header - matching PhotoGrid style */}
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
        Settings
      </h3>
      
      {/* All settings in one row */}
      <div className="flex items-center gap-3 p-2 rounded-lg bg-surface border border-border">
        {/* Orientation with label */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Orientation:</span>
          <ToggleGroup 
            type="single" 
            value={settings.orientation} 
            onValueChange={(value) => value && onUpdate({ orientation: value as 'portrait' | 'landscape' })}
          >
            <ToggleGroupItem 
              value="landscape" 
              size="sm"
              className="data-[state=on]:bg-transparent data-[state=on]:text-foreground data-[state=on]:border-b-2 data-[state=on]:border-foreground data-[state=on]:rounded-b-none data-[state=off]:text-muted-foreground"
            >
              <span className="text-xs">Landscape</span>
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="portrait" 
              size="sm"
              className="data-[state=on]:bg-transparent data-[state=on]:text-foreground data-[state=on]:border-b-2 data-[state=on]:border-foreground data-[state=on]:rounded-b-none data-[state=off]:text-muted-foreground"
            >
              <span className="text-xs">Portrait</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        
        {/* Separator */}
        <div className="w-px h-6 bg-border" />
        
        {/* Color with label */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Background:</span>
          <input
            type="color"
            value={settings.gapColor}
            onChange={(e) => onUpdate({ gapColor: e.target.value })}
            className="w-8 h-8 aspect-square rounded border border-border cursor-pointer bg-transparent"
            aria-label="Background color"
          />
        </div>
        
        {/* Separator */}
        <div className="w-px h-6 bg-border" />
        
        {/* Gap with colon */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Gap:</span>
          <Slider
            value={[settings.gapSize]}
            onValueChange={([value]) => onUpdate({ gapSize: value })}
            min={0}
            max={32}
            step={2}
            className="w-20"
          />
          <span className="text-xs text-muted-foreground w-6">{settings.gapSize}px</span>
        </div>
      </div>
    </div>
  );
}
