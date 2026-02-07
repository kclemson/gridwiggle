import { useMemo } from 'react';
import { PhotoItem } from '@/types/collage';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, AlertCircle, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhotoProcessingViewProps {
  photos: PhotoItem[];
  currentlyProcessingId: string | null;
  progress: number;
  status: string;
}

export function PhotoProcessingView({
  photos,
  currentlyProcessingId,
  progress,
  status,
}: PhotoProcessingViewProps) {
  const stats = useMemo(() => {
    const completed = photos.filter(p => !p.isProcessing && !p.error).length;
    const errors = photos.filter(p => p.error).length;
    const processing = photos.filter(p => p.isProcessing).length;
    return { completed, errors, processing, total: photos.length };
  }, [photos]);

  const currentPhoto = currentlyProcessingId 
    ? photos.find(p => p.id === currentlyProcessingId) 
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-2 text-primary">
          <Wand2 className="h-5 w-5 animate-pulse" />
          <h3 className="text-lg font-medium">Processing Photos</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {stats.completed} of {stats.total} photos processed
        </p>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-muted-foreground text-center">
          {status}
        </p>
      </div>

      {/* Current photo thumbnail */}
      {currentPhoto && (
        <div className="flex justify-center">
          <div className="relative w-32 h-32 rounded-lg overflow-hidden bg-muted">
            <img
              src={currentPhoto.objectUrl}
              alt=""
              className="w-full h-full object-cover"
            />
            {/* Spinner overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="flex justify-center gap-6 text-sm">
        <div className="flex items-center gap-1.5 text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          <span>{stats.completed} ready</span>
        </div>
        {stats.errors > 0 && (
          <div className="flex items-center gap-1.5 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{stats.errors} failed</span>
          </div>
        )}
      </div>

      {/* Processing queue preview - small dots */}
      <div className="flex justify-center gap-1 flex-wrap max-w-xs mx-auto">
        {photos.map((photo) => {
          const isProcessing = photo.id === currentlyProcessingId;
          const isComplete = !photo.isProcessing && !photo.error;
          const hasError = !!photo.error;
          
          return (
            <div
              key={photo.id}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                isProcessing && "bg-primary animate-pulse",
                isComplete && "bg-green-500",
                hasError && "bg-destructive",
                !isProcessing && !isComplete && !hasError && "bg-muted-foreground/30"
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
