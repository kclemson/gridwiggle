import { useRef, useEffect, useState } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const [thumbnailOffset, setThumbnailOffset] = useState<number | null>(null);

  // Update thumbnail position when active dot changes or scroll happens
  useEffect(() => {
    const updatePosition = () => {
      if (activeRef.current && containerRef.current) {
        const dotRect = activeRef.current.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        // Center of dot relative to container's left edge
        const offset = dotRect.left - containerRect.left + dotRect.width / 2;
        setThumbnailOffset(offset);
      } else {
        setThumbnailOffset(null);
      }
    };
    
    updatePosition();
    
    // Also update on scroll
    const container = containerRef.current;
    container?.addEventListener('scroll', updatePosition);
    return () => container?.removeEventListener('scroll', updatePosition);
  }, [currentlyProcessingId]);

  // Auto-scroll to active dot
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
      {/* Thumbnail - OUTSIDE scroll container, positioned via JS */}
      <div className="h-14 relative w-full flex justify-center">
        <div className="relative max-w-xs w-full px-2">
          {currentPhoto && thumbnailOffset !== null && (
            <div 
              className="absolute bottom-0 -translate-x-1/2 z-10"
              style={{ left: thumbnailOffset }}
            >
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shadow-sm">
                <img
                  src={currentPhoto.objectUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Dots scroll container */}
      <div 
        ref={containerRef}
        className="flex gap-1 overflow-x-auto max-w-xs px-2 scrollbar-hide"
      >
        {photos.map((photo) => {
          const isProcessing = photo.id === currentlyProcessingId;
          const isComplete = !photo.isProcessing && !photo.error;
          const hasError = !!photo.error;
          
          return (
            <div 
              key={photo.id} 
              ref={isProcessing ? activeRef : null}
              className="flex-shrink-0"
            >
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
