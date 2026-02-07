import { PhotoItem } from '@/types/collage';
import { cn } from '@/lib/utils';

interface PhotoProgressDotsProps {
  photos: PhotoItem[];
  currentlyProcessingId: string | null;
  className?: string;
}

export function PhotoProgressDots({
  photos,
  currentlyProcessingId,
  className,
}: PhotoProgressDotsProps) {
  return (
    <div className={cn("flex gap-1 flex-wrap justify-center", className)}>
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
              isComplete && "bg-emerald-500",
              hasError && "bg-destructive",
              !isProcessing && !isComplete && !hasError && "bg-muted-foreground/30"
            )}
          />
        );
      })}
    </div>
  );
}
