import { useState } from 'react';
import { CollageSettings as CollageSettingsType, CollageLayout, MIN_PHOTOS_FOR_SHAPE_SLIDER } from '@/types/collage';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { LabelPositionPicker } from '@/components/LabelPositionPicker';
import { arToSliderPosition } from '@/lib/shapeSlider';
import { cn } from '@/lib/utils';
import { Calendar, Hash, Pencil } from 'lucide-react';

interface CollageSettingsProps {
  settings: CollageSettingsType;
  layout: CollageLayout | null;
  photoCount: number;
  hasAnyLabel: boolean;
  hasAnyExifDate: boolean;
  onLabelAction: (action: 'date' | 'number' | 'custom' | 'clear') => void;
  onUpdate: (updates: Partial<CollageSettingsType>) => void;
}

export function CollageSettings({ settings, layout, photoCount, hasAnyLabel, hasAnyExifDate, onLabelAction, onUpdate }: CollageSettingsProps) {
  const labelsVisible = hasAnyLabel || settings.showLabelPlaceholders;
  const canClear = labelsVisible;
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
      <section>
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
              "flex flex-col gap-2",
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
            <div className="flex justify-between text-xs text-muted-foreground select-none">
              <span>Tall <span aria-hidden="true">▯</span></span>
              <span><span aria-hidden="true">▭</span> Wide</span>
            </div>
          </div>
        </div>
      </section>

      <div className="h-px bg-muted-foreground/15" />

      {/* ─── Style ─── */}
      <section>
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
              <div className="flex items-center gap-0.5">
                {hasAnyExifDate && (
                  <LabelActionButton
                    icon={<Calendar className="h-3.5 w-3.5" />}
                    onClick={() => onLabelAction('date')}
                    title="Use photo dates"
                  />
                )}
                <LabelActionButton
                  icon={<Hash className="h-3.5 w-3.5" />}
                  onClick={() => onLabelAction('number')}
                  title="Number photos"
                />
                <LabelActionButton
                  icon={<Pencil className="h-3.5 w-3.5" />}
                  onClick={() => onLabelAction('custom')}
                  title="Custom labels — tap any photo to edit"
                />
              </div>
              {labelsVisible && (
                <LabelPositionPicker
                  value={settings.labelPosition}
                  onChange={(labelPosition) => onUpdate({ labelPosition })}
                />
              )}
              {canClear && (
                <button
                  type="button"
                  onClick={() => onLabelAction('clear')}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  title="Clear all labels"
                >
                  Clear
                </button>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">Add labels</span>
          </div>
        </div>
      </section>
    </div>
  );
}

interface LabelActionButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  title: string;
}

function LabelActionButton({ icon, onClick, title }: LabelActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "h-6 w-6 flex items-center justify-center transition-colors",
        "border border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
    </button>
  );
}
