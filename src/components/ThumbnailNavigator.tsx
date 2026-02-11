import { useState, useEffect, useCallback } from 'react';
import { PhotoItem } from '@/types/collage';
import { getDisplayCrop } from '@/lib/cropUtils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Star, Crop, Undo2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThumbnailNavigatorProps {
  photos: PhotoItem[];
  onSelect: (photoId: string) => void;
  onClose: () => void;
  onSmartCrop?: (photoId: string) => void;
  onUndoSmartCrop?: (photoId: string) => void;
  smartCroppingPhotoId?: string | null;
}

const BATCH_SIZE = 8;
const THUMBNAIL_HEIGHT = 85; // px
const MIN_THUMBNAIL_WIDTH = 50; // px

export function ThumbnailNavigator({
  photos,
  onSelect,
  onClose,
  onSmartCrop,
  onUndoSmartCrop,
  smartCroppingPhotoId,
}: ThumbnailNavigatorProps) {
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());

  // Progressive loading: load thumbnails in batches
  useEffect(() => {
    let cancelled = false;
    let currentBatch = 0;

    const loadNextBatch = () => {
      if (cancelled) return;
      
      const start = currentBatch * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, photos.length);
      
      setLoadedIds(prev => {
        const next = new Set(prev);
        for (let i = start; i < end; i++) {
          next.add(photos[i].id);
        }
        return next;
      });
      
      currentBatch++;
      
      if (end < photos.length) {
        // Use requestIdleCallback if available, otherwise setTimeout
        if ('requestIdleCallback' in window) {
          requestIdleCallback(loadNextBatch, { timeout: 100 });
        } else {
          setTimeout(loadNextBatch, 16);
        }
      }
    };
    
    // Start loading immediately
    loadNextBatch();
    
    return () => {
      cancelled = true;
    };
  }, [photos]);

  const handleSelect = useCallback((photoId: string) => {
    onSelect(photoId);
  }, [onSelect]);

  const loadedCount = loadedIds.size;
  const totalCount = photos.length;
  const isLoading = loadedCount < totalCount;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex justify-center">
      <div className="flex flex-col w-full max-w-lg sm:max-w-xl md:max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">Select Photo</h2>
            {isLoading && (
              <p className="text-sm text-muted-foreground">
                Loading {loadedCount} of {totalCount}...
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Thumbnail Grid - Flex layout with natural aspect ratios */}
        <ScrollArea className="flex-1 p-3">
          <div className="flex flex-wrap gap-2 justify-start">
            {photos.map((photo, index) => {
              const isLoaded = loadedIds.has(photo.id);
              const isHero = photo.priority === 1;
              const crop = getDisplayCrop(photo);
              const hasSmartCrop = photo.smartCrop !== null;
              const isProcessing = smartCroppingPhotoId === photo.id;
              
              // Always use full-image aspect ratio (we show the whole photo now)
              const aspectRatio = photo.originalWidth / photo.originalHeight || 1;
              const calculatedWidth = Math.max(
                MIN_THUMBNAIL_WIDTH, 
                Math.round(THUMBNAIL_HEIGHT * aspectRatio)
              );

              // Crop overlay percentages
              const topPct = crop ? (crop.y / photo.originalHeight) * 100 : 0;
              const leftPct = crop ? (crop.x / photo.originalWidth) * 100 : 0;
              const widthPct = crop ? (crop.width / photo.originalWidth) * 100 : 100;
              const heightPct = crop ? (crop.height / photo.originalHeight) * 100 : 100;

              return (
                <div 
                  key={photo.id}
                  className="flex flex-col items-center gap-1"
                  style={{ width: calculatedWidth }}
                >
                  {/* Photo thumbnail */}
                  <button
                    onClick={() => handleSelect(photo.id)}
                    className={cn(
                      "relative transition-all overflow-hidden rounded",
                      "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    )}
                    style={{ 
                      height: THUMBNAIL_HEIGHT,
                      width: calculatedWidth,
                    }}
                  >
                    {isLoaded ? (
                      <>
                        <img
                          src={photo.thumbnailUrl ?? photo.previewUrl ?? photo.objectUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          draggable={false}
                        />

                        {/* Crop boundary overlay - dims area outside crop */}
                        {crop && (
                          <>
                            {/* Top strip */}
                            <div className="absolute left-0 right-0 top-0 bg-black/50" style={{ height: `${topPct}%` }} />
                            {/* Bottom strip */}
                            <div className="absolute left-0 right-0 bottom-0 bg-black/50" style={{ height: `${100 - topPct - heightPct}%` }} />
                            {/* Left strip */}
                            <div className="absolute bg-black/50" style={{ top: `${topPct}%`, left: 0, width: `${leftPct}%`, height: `${heightPct}%` }} />
                            {/* Right strip */}
                            <div className="absolute bg-black/50" style={{ top: `${topPct}%`, right: 0, width: `${100 - leftPct - widthPct}%`, height: `${heightPct}%` }} />
                            {/* Crop border */}
                            <div className="absolute border border-white/60 rounded-sm pointer-events-none" style={{ top: `${topPct}%`, left: `${leftPct}%`, width: `${widthPct}%`, height: `${heightPct}%` }} />
                          </>
                        )}

                        {/* Hero badge */}
                        {isHero && (
                          <div className="absolute top-0.5 left-0.5 bg-yellow-500 rounded-full p-0.5">
                            <Star className="h-2.5 w-2.5 fill-yellow-950 text-yellow-950" />
                          </div>
                        )}

                        {/* Index number */}
                        <div className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[10px] px-1 rounded">
                          {index + 1}
                        </div>
                      </>
                    ) : (
                      <Skeleton className="w-full h-full rounded" />
                    )}
                  </button>
                  
                  {/* Per-photo action button */}
                  {isLoaded && onSmartCrop && onUndoSmartCrop && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 min-h-[44px] min-w-[44px]"
                      disabled={isProcessing}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasSmartCrop) {
                          onUndoSmartCrop(photo.id);
                        } else {
                          onSmartCrop(photo.id);
                        }
                      }}
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : hasSmartCrop ? (
                        <Undo2 className="h-4 w-4" />
                      ) : (
                        <Crop className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Loading progress bar */}
        {isLoading && (
          <div className="p-4 border-t border-border">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(loadedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
