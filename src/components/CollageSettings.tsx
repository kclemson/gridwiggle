import { useState } from 'react';
import { CollageSettings as CollageSettingsType, MIN_PHOTOS_FOR_SHAPE_CONTROL, isShapeAvailable } from '@/types/collage';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollageSettingsProps {
  settings: CollageSettingsType;
  onUpdate: (updates: Partial<CollageSettingsType>) => void;
  photoCount: number;
  hasHeroes: boolean;
}

const STORAGE_KEY = 'collage-settings-open';

export function CollageSettings({ settings, onUpdate, photoCount, hasHeroes }: CollageSettingsProps) {
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

  const canControlShape = photoCount >= MIN_PHOTOS_FOR_SHAPE_CONTROL;
  
  // Per-shape availability
  const canLandscape = isShapeAvailable('landscape', photoCount);
  const canPortrait = isShapeAvailable('portrait', photoCount);
  const canSquare = isShapeAvailable('square', photoCount);
  
  // Shape is disabled when heroes present OR not enough photos
  const shapeDisabled = hasHeroes || !canControlShape;
  const shapeHint = hasHeroes 
    ? "(heroes use auto)" 
    : !canControlShape 
      ? "(6+ photos)" 
      : null;
  
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
            <span className="text-sm text-muted-foreground">Background color</span>
            <input
              type="color"
              value={settings.gapColor}
              onChange={(e) => onUpdate({ gapColor: e.target.value })}
              className="w-7 h-7 rounded cursor-pointer appearance-none border-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:rounded [&::-moz-color-swatch]:border-0"
              aria-label="Background color"
            />
          </div>
          
          {/* Gap row */}
          <div className="flex items-center justify-between px-1">
            <span className="text-sm text-muted-foreground">Gap</span>
            <div className="flex items-center gap-2">
              <Slider
                value={[settings.gapSize]}
                onValueChange={([value]) => onUpdate({ gapSize: value })}
                min={0}
                max={32}
                step={2}
                className="w-24 [&>span:first-child]:bg-muted-foreground/30"
              />
              <span className="text-xs text-muted-foreground w-8 text-right">{settings.gapSize}px</span>
            </div>
          </div>
          
          {/* Shape row */}
          <div 
            className="flex items-center justify-between px-1"
            title={hasHeroes ? "Shape is set to Auto when photos are marked as heroes" : undefined}
          >
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">Shape</span>
              {shapeHint && (
                <span className="text-xs text-muted-foreground/60 italic">{shapeHint}</span>
              )}
            </div>
            <Select
              value={settings.shape}
              onValueChange={(value) => onUpdate({ shape: value as CollageSettingsType['shape'] })}
              disabled={shapeDisabled}
            >
              <SelectTrigger className="h-7 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                {canLandscape && <SelectItem value="landscape">Landscape</SelectItem>}
                {canPortrait && <SelectItem value="portrait">Portrait</SelectItem>}
                {canSquare && <SelectItem value="square">Square-ish</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
