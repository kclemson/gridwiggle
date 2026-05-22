import { useState } from 'react';
import { CollageSettings as CollageSettingsType, CollageLayout, MIN_PHOTOS_FOR_SHAPE_SLIDER } from '@/types/collage';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { LabelPositionPicker } from '@/components/LabelPositionPicker';
import { arToSliderPosition } from '@/lib/shapeSlider';
import { cn } from '@/lib/utils';

interface CollageSettingsProps {
  settings: CollageSettingsType;
  layout: CollageLayout | null;
  photoCount: number;
  onUpdate: (updates: Partial<CollageSettingsType>) => void;
}

export function CollageSettings({ settings, layout, photoCount, onUpdate }: CollageSettingsProps) {
  const [draggingValue, setDraggingValue] = useState<number | null>(null);

  // Slider always reflects the current layout AR (truthful display)
  const displayPosition = layout
    ? arToSliderPosition(layout.width / layout.height)
    : 50; // Default to center when no layout

  const stripeActive = settings.singleColumn || settings.singleRow;
  const shapeDisabled = stripeActive || photoCount < MIN_PHOTOS_FOR_SHAPE_SLIDER;
  const shapeValue = draggingValue ?? displayPosition;

  return (
    <div className="space-y-3 py-2 px-1">
      {/* ─── Structure ─── */}
      <section className="space-y-1">
        <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground/70 px-1">
          Structure
        </h3>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col items-start gap-1.5">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
              <Checkbox
                checked={settings.singleColumn}
                onCheckedChange={(checked) =>
                  onUpdate({ singleColumn: !!checked, singleRow: false })
                }
              />
              Single column
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
              <Checkbox
                checked={settings.singleRow}
                onCheckedChange={(checked) =>
                  onUpdate({ singleRow: !!checked, singleColumn: false })
                }
              />
              Single row
            </label>
          </div>

          <div
            className={cn(
              "flex flex-col gap-1",
              shapeDisabled && "opacity-40"
            )}
            title={
              stripeActive
                ? 'Shape is disabled while single column/row is on'
                : shapeDisabled
                  ? `Shape requires ${MIN_PHOTOS_FOR_SHAPE_SLIDER}+ photos`
                  : undefined
            }
          >
            <Slider
              value={[shapeValue]}
              onValueChange={([value]) => setDraggingValue(value)}
              onValueCommit={([value]) => {
                setDraggingValue(null);
                onUpdate({ shapeSlider: value });
              }}
              disabled={shapeDisabled}
              min={0}
              max={100}
              step={5}
              className="w-36 [&>span:first-child]:bg-muted-foreground/30"
            />
            <div className="flex justify-between text-[11px] text-muted-foreground select-none">
              <span>Tall <span aria-hidden="true">▯</span></span>
              <span><span aria-hidden="true">▭</span> Wide</span>
            </div>
          </div>
        </div>
      </section>

      <div className="h-px bg-muted-foreground/15" />

      {/* ─── Style ─── */}
      <section className="space-y-1">
        <h3 className="text-[10px] uppercase tracking-wide text-muted-foreground/70 px-1">
          Style
        </h3>
        <div className="flex items-end justify-between gap-x-4 gap-y-2 flex-wrap">
          <div className="flex flex-col items-center gap-0.5">
            <input
              type="color"
              value={settings.gapColor}
              onChange={(e) => onUpdate({ gapColor: e.target.value })}
              className="w-8 h-6 rounded cursor-pointer border border-muted-foreground/30 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded [&::-moz-color-swatch]:border-0"
              aria-label="Background color"
            />
            <span className="text-[10px] text-muted-foreground">Background</span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <div className="h-6 flex items-center">
              <Slider
                value={[settings.gapSize]}
                onValueChange={([value]) => onUpdate({ gapSize: value })}
                min={0}
                max={100}
                step={5}
                className="w-14 [&>span:first-child]:bg-muted-foreground/30"
              />
            </div>
            <span className="text-[10px] text-muted-foreground">Spacing</span>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <div className="h-6 flex items-center gap-2">
              <Switch
                checked={settings.labelsEnabled}
                onCheckedChange={(checked) => onUpdate({ labelsEnabled: !!checked })}
                aria-label="Labels"
              />
              {settings.labelsEnabled && (
                <LabelPositionPicker
                  value={settings.labelPosition}
                  onChange={(labelPosition) => onUpdate({ labelPosition })}
                />
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">Labels</span>
          </div>
        </div>
      </section>
    </div>
  );
}
