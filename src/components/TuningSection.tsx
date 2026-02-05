import { LayoutTuning, DEFAULT_TUNING } from '@/types/collage';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Settings2, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface TuningSectionProps {
  tuning: LayoutTuning;
  onTuningChange: (key: keyof LayoutTuning, value: number) => void;
  heroPct: string | null;
}

interface TuningInputProps {
  label: string;
  tooltip: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  defaultValue?: number;
}

function TuningInput({ label, tooltip, value, onChange, step = 1, min, max, defaultValue }: TuningInputProps) {
  return (
    <div className="flex flex-col gap-1" title={tooltip}>
      <Label className="text-[10px] text-muted-foreground font-normal">
        {label}
        {defaultValue !== undefined && (
          <span className="text-muted-foreground/60 ml-1">({defaultValue})</span>
        )}
      </Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => {
          const parsed = parseFloat(e.target.value);
          if (!isNaN(parsed)) {
            onChange(parsed);
          }
        }}
        step={step}
        min={min}
        max={max}
        className="h-7 text-xs px-2 w-full font-mono"
      />
    </div>
  );
}

export function TuningSection({ tuning, onTuningChange, heroPct }: TuningSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b border-border/50">
      <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Settings2 className="h-3.5 w-3.5" />
          <span>Tuning</span>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? '' : '-rotate-90'}`} />
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="px-3 pb-3 space-y-3">
          {/* Row 1: Hero beside packing */}
          <div className="grid grid-cols-4 gap-2">
            <TuningInput
              label="3-Row Max"
              tooltip="Max photos packed beside hero when using 3-row mode"
              value={tuning.maxBeside3Row}
              onChange={(v) => onTuningChange('maxBeside3Row', v)}
              min={3}
              max={20}
            />
            <TuningInput
              label="2-Row Max"
              tooltip="Max photos packed beside hero when using 2-row mode"
              value={tuning.maxBeside2Row}
              onChange={(v) => onTuningChange('maxBeside2Row', v)}
              min={2}
              max={10}
            />
            <TuningInput
              label="3-Row At"
              tooltip="Use 3-row mode when this many photos are beside hero"
              value={tuning.threeRowThreshold}
              onChange={(v) => onTuningChange('threeRowThreshold', v)}
              min={2}
              max={20}
            />
            <TuningInput
              label="Per Block"
              tooltip="Photos per standard content row"
              value={tuning.contentPhotosPerBlock}
              onChange={(v) => onTuningChange('contentPhotosPerBlock', v)}
              min={1}
              max={10}
            />
          </div>
          
          {/* Row 2: Hero fractions */}
          <div className="grid grid-cols-4 gap-2">
            <TuningInput
              label="Min Frac"
              tooltip="Minimum hero width as fraction of canvas (0.3 = 30%)"
              value={tuning.heroMinFraction}
              onChange={(v) => onTuningChange('heroMinFraction', v)}
              step={0.05}
              min={0.1}
              max={0.5}
            />
            <TuningInput
              label="Max Frac"
              tooltip="Maximum hero width as fraction of canvas (0.6 = 60%)"
              value={tuning.heroMaxFraction}
              onChange={(v) => onTuningChange('heroMaxFraction', v)}
              step={0.05}
              min={0.3}
              max={0.9}
            />
            <TuningInput
              label="Scale Low"
              tooltip="Reject layouts where photos shrink below this (0.75 = 75%)"
              value={tuning.scaleToleranceLow}
              onChange={(v) => onTuningChange('scaleToleranceLow', v)}
              step={0.05}
              min={0.5}
              max={1.0}
            />
            <TuningInput
              label="Sc High"
              tooltip="Reject layouts where photos grow above this (1.25 = 125%)"
              value={tuning.scaleToleranceHigh}
              onChange={(v) => onTuningChange('scaleToleranceHigh', v)}
              step={0.05}
              min={1.0}
              max={2.0}
            />
          </div>
          
          {/* Row 3: Balance controls */}
          <div className="grid grid-cols-3 gap-2">
            <TuningInput
              label="Max Beside %"
              tooltip="Hero row can consume at most this fraction of total photos (0.6 = 60%)"
              value={tuning.maxBesideFraction}
              onChange={(v) => onTuningChange('maxBesideFraction', v)}
              step={0.05}
              min={0.3}
              max={0.9}
              defaultValue={DEFAULT_TUNING.maxBesideFraction}
            />
            <TuningInput
              label="Min Content"
              tooltip="Always reserve at least this many photos for content rows"
              value={tuning.minContentPhotos}
              onChange={(v) => onTuningChange('minContentPhotos', v)}
              min={0}
              max={10}
              defaultValue={DEFAULT_TUNING.minContentPhotos}
            />
            <TuningInput
              label="Min/Row"
              tooltip="Content rows must have at least this many photos"
              value={tuning.minPhotosPerRow}
              onChange={(v) => onTuningChange('minPhotosPerRow', v)}
              min={1}
              max={4}
              defaultValue={DEFAULT_TUNING.minPhotosPerRow}
            />
          </div>
          
          {/* Hero percentage readout */}
          {heroPct && (
            <div className="flex items-center gap-2 pt-1 border-t border-border/30">
              <span className="text-[10px] text-muted-foreground">Hero Area:</span>
              <span className="text-xs font-mono font-medium text-primary">{heroPct}</span>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
