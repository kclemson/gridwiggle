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
    <div className="space-y-6 p-4 rounded-xl bg-surface border border-border">
      <div className="space-y-3">
        <Label className="text-sm font-medium">Orientation</Label>
        <RadioGroup
          value={settings.orientation}
          onValueChange={(value) => onUpdate({ orientation: value as 'portrait' | 'landscape' })}
          className="flex gap-4"
        >
          <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface-elevated cursor-pointer hover:border-primary/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/10">
            <RadioGroupItem value="landscape" id="landscape" />
            <RectangleHorizontal className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm">Landscape</span>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface-elevated cursor-pointer hover:border-primary/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/10">
            <RadioGroupItem value="portrait" id="portrait" />
            <RectangleVertical className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm">Portrait</span>
          </label>
        </RadioGroup>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Gap Color</Label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={settings.gapColor}
            onChange={(e) => onUpdate({ gapColor: e.target.value })}
            className="w-12 h-10 rounded-lg border border-border cursor-pointer bg-transparent"
          />
          <span className="text-sm text-muted-foreground font-mono">
            {settings.gapColor.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Spacing</Label>
          <span className="text-sm text-muted-foreground">{settings.gapSize}px</span>
        </div>
        <Slider
          value={[settings.gapSize]}
          onValueChange={([value]) => onUpdate({ gapSize: value })}
          min={0}
          max={32}
          step={2}
          className="w-full"
        />
      </div>
    </div>
  );
}
