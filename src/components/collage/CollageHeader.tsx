import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RefreshCw, Download, Loader2 } from 'lucide-react';

const SIZE_OPTIONS: { label: string; value: 1 | 1.5 | 2 }[] = [
  { label: 'S', value: 1 },
  { label: 'M', value: 1.5 },
  { label: 'L', value: 2 },
];

interface CollageHeaderProps {
  onShuffle: () => void;
  onDownload?: () => void;
  isShuffling: boolean;
  isDownloading?: boolean;
  showDownload?: boolean;
  exportScale?: 1 | 1.5 | 2;
  onExportScaleChange?: (value: 1 | 1.5 | 2) => void;
}

export function CollageHeader({ 
  onShuffle, 
  onDownload, 
  isShuffling, 
  isDownloading,
  showDownload = true,
  exportScale,
  onExportScaleChange,
}: CollageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
        Collage
      </h3>
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8" 
          onClick={onShuffle}
          disabled={isShuffling}
          title="Shuffle layout"
        >
          <RefreshCw className={cn("h-4 w-4", isShuffling && "animate-spin")} />
        </Button>
        {showDownload && exportScale !== undefined && onExportScaleChange && (
          <div
            className="flex rounded-md border border-muted-foreground/30 overflow-hidden h-6"
            title="Export size"
          >
            {SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onExportScaleChange(opt.value)}
                className={cn(
                  "px-2 text-xs font-medium transition-colors",
                  exportScale === opt.value
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                aria-label={`Export size ${opt.label}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn(
            "h-8 w-8",
            !showDownload && "invisible"
          )}
          onClick={onDownload}
          disabled={isDownloading || !showDownload}
          title="Download PNG"
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
