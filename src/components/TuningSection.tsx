import { LayoutTuning } from '@/types/collage';
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
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
}

function TuningInput({ label, value, onChange, step = 1, min, max }: TuningInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[10px] text-muted-foreground font-normal">{label}</Label>
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
              value={tuning.maxBeside3Row}
              onChange={(v) => onTuningChange('maxBeside3Row', v)}
              min={3}
              max={20}
            />
            <TuningInput
              label="2-Row Max"
              value={tuning.maxBeside2Row}
              onChange={(v) => onTuningChange('maxBeside2Row', v)}
              min={2}
              max={10}
            />
            <TuningInput
              label="3-Row At"
              value={tuning.threeRowThreshold}
              onChange={(v) => onTuningChange('threeRowThreshold', v)}
              min={2}
              max={20}
            />
            <TuningInput
              label="Per Block"
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
              value={tuning.heroMinFraction}
              onChange={(v) => onTuningChange('heroMinFraction', v)}
              step={0.05}
              min={0.1}
              max={0.5}
            />
            <TuningInput
              label="Max Frac"
              value={tuning.heroMaxFraction}
              onChange={(v) => onTuningChange('heroMaxFraction', v)}
              step={0.05}
              min={0.3}
              max={0.9}
            />
            <TuningInput
              label="Scale Low"
              value={tuning.scaleToleranceLow}
              onChange={(v) => onTuningChange('scaleToleranceLow', v)}
              step={0.05}
              min={0.5}
              max={1.0}
            />
            <TuningInput
              label="Scale High"
              value={tuning.scaleToleranceHigh}
              onChange={(v) => onTuningChange('scaleToleranceHigh', v)}
              step={0.05}
              min={1.0}
              max={2.0}
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
