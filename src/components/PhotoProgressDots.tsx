import { useRef, useEffect } from 'react';
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
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        inline: 'center',
        block: 'nearest' 
      });
    }
  }, [currentlyProcessingId]);

  return (
    <div className={cn("flex flex-col items-center", className)}>
      {/* Reserve space for thumbnail above */}
      <div className="h-14" />
      
      <div className="flex gap-1 overflow-x-auto max-w-xs px-2 scrollbar-hide">
        {photos.map((photo) => {
          const isProcessing = photo.id === currentlyProcessingId;
          const isComplete = !photo.isProcessing && !photo.error;
          const hasError = !!photo.error;
          
          return (
            <div 
              key={photo.id} 
              ref={isProcessing ? activeRef : null}
              className="relative flex-shrink-0"
            >
              {/* Thumbnail floating above active dot */}
              {isProcessing && currentPhoto && (
                <div className="absolute -top-14 left-1/2 -translate-x-1/2">
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
    </div>
  );
}
