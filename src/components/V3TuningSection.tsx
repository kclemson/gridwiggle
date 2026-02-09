import { V3Tuning, DEFAULT_V3_TUNING } from '@/lib/v3/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Settings2, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface V3TuningSectionProps {
  tuning: V3Tuning;
  onTuningChange: (key: keyof V3Tuning, value: number) => void;
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

function TuningInput({ label, tooltip, value, onChange, step = 0.1, min, max, defaultValue }: TuningInputProps) {
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

export function V3TuningSection({ tuning, onTuningChange, heroPct }: V3TuningSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b border-border/50">
      <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Settings2 className="h-3.5 w-3.5" />
          <span>V3 Tuning</span>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? '' : '-rotate-90'}`} />
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="px-3 pb-3 space-y-3">
          {/* Row 1: Hero prominence */}
          <div className="grid grid-cols-2 gap-2">
            <TuningInput
              label="Target Prominence"
              tooltip="How much bigger hero should be vs next largest photo (1.5 = 50% larger)"
              value={tuning.hero_targetProminence}
              onChange={(v) => onTuningChange('hero_targetProminence', v)}
              step={0.1}
              min={1.0}
              max={3.0}
              defaultValue={DEFAULT_V3_TUNING.hero_targetProminence}
            />
            <TuningInput
              label="Min Prominence"
              tooltip="Floor for layout rejection - reject if hero isn't this prominent (0.7 = hero 70% of top content)"
              value={tuning.hero_minProminence}
              onChange={(v) => onTuningChange('hero_minProminence', v)}
              step={0.05}
              min={0.3}
              max={2.0}
              defaultValue={DEFAULT_V3_TUNING.hero_minProminence}
            />
          </div>
          
          {/* Row 2: Canvas AR limits */}
          <div className="grid grid-cols-2 gap-2">
            <TuningInput
              label="Min Canvas AR"
              tooltip="Most portrait canvas allowed (0.5 = 1:2 portrait)"
              value={tuning.canvas_minAR}
              onChange={(v) => onTuningChange('canvas_minAR', v)}
              step={0.05}
              min={0.3}
              max={1.0}
              defaultValue={DEFAULT_V3_TUNING.canvas_minAR}
            />
            <TuningInput
              label="Max Canvas AR"
              tooltip="Most landscape canvas allowed (2.25 = 9:4 landscape)"
              value={tuning.canvas_maxAR}
              onChange={(v) => onTuningChange('canvas_maxAR', v)}
              step={0.1}
              min={1.0}
              max={3.0}
              defaultValue={DEFAULT_V3_TUNING.canvas_maxAR}
            />
          </div>
          
          {/* Row 3: Row distribution */}
          <div className="grid grid-cols-2 gap-2">
            <TuningInput
              label="Row Jitter"
              tooltip="AR budget jitter for organic variation (0.6 = ±60%)"
              value={tuning.row_arBudgetJitter}
              onChange={(v) => onTuningChange('row_arBudgetJitter', v)}
              step={0.1}
              min={0}
              max={1.0}
              defaultValue={DEFAULT_V3_TUNING.row_arBudgetJitter}
            />
            <TuningInput
              label="Prominence Top %"
              tooltip="Fraction of top content photos used for prominence comparison (0.25 = top 25%)"
              value={tuning.hero_prominenceTopFraction}
              onChange={(v) => onTuningChange('hero_prominenceTopFraction', v)}
              step={0.05}
              min={0.1}
              max={0.5}
              defaultValue={DEFAULT_V3_TUNING.hero_prominenceTopFraction}
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
