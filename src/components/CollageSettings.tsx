import { CollageSettings as CollageSettingsType } from '@/types/collage';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { RectangleHorizontal, RectangleVertical } from 'lucide-react';

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
        {/* Orientation toggle - icons only */}
        <ToggleGroup 
          type="single" 
          value={settings.orientation} 
          onValueChange={(value) => value && onUpdate({ orientation: value as 'portrait' | 'landscape' })}
        >
          <ToggleGroupItem value="landscape" size="sm" aria-label="Landscape orientation">
            <RectangleHorizontal className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="portrait" size="sm" aria-label="Portrait orientation">
            <RectangleVertical className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
        
        {/* Separator */}
        <div className="w-px h-6 bg-border" />
        
        {/* Color picker - smaller, no label */}
        <input
          type="color"
          value={settings.gapColor}
          onChange={(e) => onUpdate({ gapColor: e.target.value })}
          className="w-6 h-6 rounded border border-border cursor-pointer bg-transparent"
          aria-label="Gap color"
        />
        
        {/* Separator */}
        <div className="w-px h-6 bg-border" />
        
        {/* Gap slider - narrower */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Gap</span>
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
