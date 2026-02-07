import { useState, useEffect, useCallback } from 'react';
import { PhotoItem } from '@/types/collage';
import { getDisplayCrop } from '@/lib/cropUtils';
import { CroppedImage } from './common/CroppedImage';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Star, Crop } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThumbnailNavigatorProps {
  photos: PhotoItem[];
  currentIndex: number;
  onSelect: (photoId: string) => void;
  onClose: () => void;
}

const BATCH_SIZE = 8;
const THUMBNAIL_SIZE = 85; // px

export function ThumbnailNavigator({
  photos,
  currentIndex,
  onSelect,
  onClose,
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

      {/* Thumbnail Grid */}
      <ScrollArea className="flex-1 p-4">
        <div 
          className="grid gap-3 p-2"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${THUMBNAIL_SIZE}px, 1fr))`,
          }}
        >
          {photos.map((photo, index) => {
            const isLoaded = loadedIds.has(photo.id);
            const isSelected = index === currentIndex;
            const isHero = photo.priority === 1;
            const crop = getDisplayCrop(photo);
            
            return (
              <button
                key={photo.id}
                onClick={() => handleSelect(photo.id)}
                className={cn(
                  "relative aspect-square transition-all",
                  "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                  isSelected && isLoaded && "ring-2 ring-primary ring-offset-2"
                )}
                style={{ 
                  minHeight: THUMBNAIL_SIZE,
                  minWidth: THUMBNAIL_SIZE,
                }}
              >
                {isLoaded ? (
                  <>
                    <div className="w-full h-full rounded overflow-hidden">
                      {crop ? (
                        <CroppedImage
                          src={photo.objectUrl}
                          crop={crop}
                          originalWidth={photo.originalWidth}
                          originalHeight={photo.originalHeight}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={photo.objectUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    
                    {/* Hero badge */}
                    {isHero && (
                      <div className="absolute top-0.5 left-0.5 bg-yellow-500 rounded-full p-0.5">
                        <Star className="h-2.5 w-2.5 fill-yellow-950 text-yellow-950" />
                      </div>
                    )}

                    {/* Crop indicator - shows if photo has any cropping applied */}
                    {(photo.smartCrop || photo.manualCrop) && (
                      <div className="absolute bottom-0.5 left-0.5 p-0.5 rounded bg-primary/80 text-white shadow-sm">
                        <Crop className="h-2 w-2" />
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
