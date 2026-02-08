import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RefreshCw, Download, Loader2 } from 'lucide-react';

interface CollageHeaderProps {
  onShuffle: () => void;
  onDownload?: () => void;
  isShuffling: boolean;
  isDownloading?: boolean;
  showDownload?: boolean;
}

export function CollageHeader({ 
  onShuffle, 
  onDownload, 
  isShuffling, 
  isDownloading,
  showDownload = true,
}: CollageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
        Collage
      </h3>
      <div className="flex items-center gap-1">
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
