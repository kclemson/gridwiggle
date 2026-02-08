import { PhotoItem } from '@/types/collage';
import { cn } from '@/lib/utils';

interface PhotoProgressDotsProps {
  photos: PhotoItem[];
  currentlyProcessingId: string | null;
  currentPhoto?: PhotoItem | null;
  className?: string;
}

export function PhotoProgressDots({
  photos,
  currentlyProcessingId,
  currentPhoto,
  className,
}: PhotoProgressDotsProps) {
  return (
    <div className={cn("flex gap-1 flex-wrap justify-center", className)}>
      {photos.map((photo) => {
        const isProcessing = photo.id === currentlyProcessingId;
        const isComplete = !photo.isProcessing && !photo.error;
        const hasError = !!photo.error;
        
        return (
          <div key={photo.id} className="relative">
            {/* Thumbnail floating above active dot */}
            {isProcessing && currentPhoto && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shadow-sm">
                  <img
                    src={currentPhoto.objectUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}
            
            {/* The dot */}
            <div
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                isProcessing && "bg-primary animate-pulse",
                isComplete && "bg-emerald-500",
                hasError && "bg-destructive",
                !isProcessing && !isComplete && !hasError && "bg-muted-foreground/30"
              )}
            />
          </div>
        );
      })}
    </div>
  );
}
