import { CollageSettings as CollageSettingsType } from '@/types/collage';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CollageSettingsProps {
  settings: CollageSettingsType;
  onUpdate: (updates: Partial<CollageSettingsType>) => void;
}

export function CollageSettings({ settings, onUpdate }: CollageSettingsProps) {
  return (
    <div className="space-y-2">
      {/* Header - matching PhotoGrid style */}
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
        Configure
      </h3>
      
      {/* All settings in one row */}
      <div className="flex items-center gap-3 p-2 rounded-lg bg-surface flex-wrap">
        {/* Shape dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Shape:</span>
          <Select
            value={settings.shape}
            onValueChange={(value) => onUpdate({ shape: value as CollageSettingsType['shape'] })}
          >
            <SelectTrigger className="h-7 w-24 text-xs border-0 bg-transparent focus:ring-0 focus:ring-offset-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="landscape">Landscape</SelectItem>
              <SelectItem value="portrait">Portrait</SelectItem>
              <SelectItem value="square">Square</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Separator */}
        <div className="w-px h-6 bg-muted-foreground/50" />
        
        {/* Color with label */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Background:</span>
          <input
            type="color"
            value={settings.gapColor}
            onChange={(e) => onUpdate({ gapColor: e.target.value })}
            className="w-6 h-6 rounded-sm cursor-pointer appearance-none border-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-sm [&::-moz-color-swatch]:border-0"
            aria-label="Background color"
          />
        </div>
        
        {/* Separator */}
        <div className="w-px h-6 bg-muted-foreground/50" />
        
        {/* Gap with colon */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Gap:</span>
          <Slider
            value={[settings.gapSize]}
            onValueChange={([value]) => onUpdate({ gapSize: value })}
            min={0}
            max={32}
            step={2}
            className="w-20 [&>span:first-child]:bg-muted-foreground/30"
          />
          <span className="text-xs text-muted-foreground w-6">{settings.gapSize}px</span>
        </div>
      </div>
    </div>
  );
}
