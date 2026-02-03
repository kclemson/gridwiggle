import { CollageSettings as CollageSettingsType } from '@/types/collage';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { RectangleHorizontal, RectangleVertical } from 'lucide-react';

interface CollageSettingsProps {
  settings: CollageSettingsType;
  onUpdate: (updates: Partial<CollageSettingsType>) => void;
}

export function CollageSettings({ settings, onUpdate }: CollageSettingsProps) {
  return (
    <div className="space-y-3 p-3 rounded-xl bg-surface border border-border">
      {/* Orientation */}
      <div className="flex items-center gap-3">
        <Label className="text-xs font-medium shrink-0">Orientation</Label>
        <RadioGroup
          value={settings.orientation}
          onValueChange={(value) => onUpdate({ orientation: value as 'portrait' | 'landscape' })}
          className="flex gap-2"
        >
          <label className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-border bg-surface-elevated cursor-pointer hover:border-primary/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/10">
            <RadioGroupItem value="landscape" id="landscape" className="sr-only" />
            <RectangleHorizontal className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs">Landscape</span>
          </label>
          <label className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-border bg-surface-elevated cursor-pointer hover:border-primary/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/10">
            <RadioGroupItem value="portrait" id="portrait" className="sr-only" />
            <RectangleVertical className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs">Portrait</span>
          </label>
        </RadioGroup>
      </div>

      {/* Gap Color & Spacing in one row */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium">Color</Label>
          <input
            type="color"
            value={settings.gapColor}
            onChange={(e) => onUpdate({ gapColor: e.target.value })}
            className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
          />
        </div>
        <div className="flex items-center gap-2 flex-1">
          <Label className="text-xs font-medium shrink-0">Gap</Label>
          <Slider
            value={[settings.gapSize]}
            onValueChange={([value]) => onUpdate({ gapSize: value })}
            min={0}
            max={32}
            step={2}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground w-8">{settings.gapSize}px</span>
        </div>
      </div>
    </div>
  );
}
