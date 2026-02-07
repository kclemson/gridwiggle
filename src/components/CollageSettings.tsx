import { useState } from 'react';
import { CollageSettings as CollageSettingsType } from '@/types/collage';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollageSettingsProps {
  settings: CollageSettingsType;
  onUpdate: (updates: Partial<CollageSettingsType>) => void;
}

const STORAGE_KEY = 'collage-settings-open';

export function CollageSettings({ settings, onUpdate }: CollageSettingsProps) {
  // Initialize from localStorage, default to collapsed (false)
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'true';
    } catch {
      return false;
    }
  });

  // Persist to localStorage on change - in the event handler, not useEffect
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    try {
      localStorage.setItem(STORAGE_KEY, String(open));
    } catch {
      // Silent - localStorage might be unavailable
    }
  };
  
  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-1 hover:bg-muted/50 rounded transition-colors">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Configure
        </h3>
        <ChevronDown className={cn(
          "h-4 w-4 text-muted-foreground transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="space-y-3 pt-2 pb-1">
          {/* Background color row */}
          <div className="flex items-center justify-between px-1">
            <span className="text-sm text-muted-foreground">Background</span>
            <input
              type="color"
              value={settings.gapColor}
              onChange={(e) => onUpdate({ gapColor: e.target.value })}
              className="w-24 h-7 rounded cursor-pointer border border-muted-foreground/30 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded [&::-moz-color-swatch]:border-0"
              aria-label="Background color"
            />
          </div>
          
          {/* Spacing row */}
          <div className="flex items-center justify-between px-1">
            <span className="text-sm text-muted-foreground">Spacing</span>
            <Slider
              value={[settings.gapSize]}
              onValueChange={([value]) => onUpdate({ gapSize: value })}
              min={0}
              max={100}
              step={5}
              className="w-24 [&>span:first-child]:bg-muted-foreground/30"
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
