import { CollageSettings as CollageSettingsType, CollageLayout } from '@/types/collage';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { LabelPositionPicker } from '@/components/LabelPositionPicker';
import type { ShapePreference } from '@/lib/shapePreference';
import { cn } from '@/lib/utils';
import { Calendar, Hash, Pencil, X, Sparkles, RectangleVertical, Square, RectangleHorizontal } from 'lucide-react';

interface CollageSettingsProps {
  settings: CollageSettingsType;
  layout: CollageLayout | null;
  photoCount: number;
  hasAnyLabel: boolean;
  hasAnyExifDate: boolean;
  onLabelAction: (action: 'date' | 'number' | 'custom' | 'clear') => void;
  onUpdate: (updates: Partial<CollageSettingsType>) => void;
}

export function CollageSettings({ settings, hasAnyLabel, hasAnyExifDate, onLabelAction, onUpdate }: CollageSettingsProps) {
  const labelsVisible = hasAnyLabel || settings.showLabelPlaceholders;

  const stripeActive = settings.singleColumn || settings.singleRow;
  const shapeDisabled = stripeActive;

  const shapeOptions: { value: ShapePreference; icon: React.ReactNode; title: string }[] = [
    { value: 'auto', icon: <Sparkles className="h-3.5 w-3.5" />, title: 'Auto shape' },
    { value: 'portrait', icon: <RectangleVertical className="h-3.5 w-3.5" />, title: 'Prefer portrait' },
    { value: 'square', icon: <Square className="h-3.5 w-3.5" />, title: 'Prefer square' },
    { value: 'landscape', icon: <RectangleHorizontal className="h-3.5 w-3.5" />, title: 'Prefer landscape' },
  ];

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
              "flex flex-col items-center gap-1",
              shapeDisabled && "opacity-40"
            )}
            title={
              shapeDisabled
                ? 'Shape is disabled while single column/row is on'
                : undefined
            }
          >
            <div role="radiogroup" aria-label="Canvas shape" className="flex items-center gap-0.5">
              {shapeOptions.map((opt) => {
                const selected = settings.shapePreference === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={shapeDisabled}
                    onClick={() => onUpdate({ shapePreference: opt.value })}
                    title={opt.title}
                    aria-label={opt.title}
                    className={cn(
                      'h-6 w-7 flex items-center justify-center transition-colors',
                      'border',
                      selected
                        ? 'border-primary text-primary bg-primary/10'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                      shapeDisabled && 'cursor-not-allowed',
                    )}
                  >
                    {opt.icon}
                  </button>
                );
              })}
            </div>
            <span className="text-[10px] text-muted-foreground select-none">Shape</span>
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
                {labelsVisible ? (
                  <LabelActionButton
                    icon={<X className="h-3.5 w-3.5" />}
                    onClick={() => onLabelAction('clear')}
                    title="Clear all labels"
                  />
                ) : (
                  <LabelActionButton
                    icon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={() => onLabelAction('custom')}
                    title="Custom labels — tap any photo to edit"
                  />
                )}
              </div>
              {labelsVisible && (
                <LabelPositionPicker
                  value={settings.labelPosition}
                  onChange={(labelPosition) => onUpdate({ labelPosition })}
                />
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
