import { useCallback, useEffect } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { PhotoItem } from '@/types/collage';
import { getDisplayCrop } from '@/lib/cropUtils';
import { CroppedImage } from './common/CroppedImage';
import { Button } from '@/components/ui/button';
import { 
  Star, 
  Crop, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  Grid3X3,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhotoCarouselProps {
  photos: PhotoItem[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onPhotoClick: (photoId: string) => void;
  onRemove: (photoId: string) => void;
  onToggleHero: (photoId: string) => void;
  onViewAll: () => void;
  onRefresh: () => void;
}

export function PhotoCarousel({
  photos,
  currentIndex,
  onIndexChange,
  onPhotoClick,
  onRemove,
  onToggleHero,
  onViewAll,
  onRefresh,
}: PhotoCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    startIndex: currentIndex,
    loop: true,
  });

  // Sync currentIndex to embla
  useEffect(() => {
    if (emblaApi && emblaApi.selectedScrollSnap() !== currentIndex) {
      emblaApi.scrollTo(currentIndex, false);
    }
  }, [emblaApi, currentIndex]);

  // Listen to embla scroll events
  useEffect(() => {
    if (!emblaApi) return;
    
    const onSelect = () => {
      const idx = emblaApi.selectedScrollSnap();
      if (idx !== currentIndex) {
        onIndexChange(idx);
      }
    };
    
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, currentIndex, onIndexChange]);

  const scrollPrev = useCallback(() => {
    emblaApi?.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    emblaApi?.scrollNext();
  }, [emblaApi]);

  const canScrollPrev = emblaApi?.canScrollPrev() ?? false;
  const canScrollNext = emblaApi?.canScrollNext() ?? false;

  if (photos.length === 0) {
    return null;
  }

  const currentPhoto = photos[currentIndex];

  return (
    <div className="space-y-3">
      {/* Position indicator - header is now in the collapsible trigger */}
      <div className="flex justify-end px-1">
        <span className="text-sm text-muted-foreground">
          {currentIndex + 1} of {photos.length}
        </span>
      </div>

      {/* Carousel */}
      <div className="relative">
        <div className="overflow-hidden rounded-lg" ref={emblaRef}>
          <div className="flex">
            {photos.map((photo, index) => {
              const crop = getDisplayCrop(photo);
              const isHero = photo.priority === 1;
              
              // Calculate aspect ratio from crop or original dimensions
              const aspectRatio = crop 
                ? crop.width / crop.height 
                : photo.originalWidth / photo.originalHeight;
              
              return (
                <div
                  key={photo.id}
                  className="flex-[0_0_100%] min-w-0 relative"
                >
                  <div 
                    className="h-[180px] bg-muted relative cursor-pointer mx-auto"
                    style={{ width: `${180 * aspectRatio}px`, maxWidth: '100%' }}
                    onClick={() => onPhotoClick(photo.id)}
                  >
                    {crop ? (
                      <CroppedImage
                        src={photo.objectUrl}
                        previewSrc={photo.previewUrl}
                        crop={crop}
                        originalWidth={photo.originalWidth}
                        originalHeight={photo.originalHeight}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src={photo.previewUrl ?? photo.objectUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    )}
                    
                    
                    {/* Tap hint overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20">
                      <span className="text-white text-sm font-medium bg-black/50 px-3 py-1.5 rounded-full">
                        Tap to edit crop
                      </span>
                    </div>
                  </div>
                  
                  {/* Action buttons below photo */}
                  <div className="flex justify-center gap-2 mt-3 flex-wrap">
                    <Button
                      variant={photo.priority === 1 ? "default" : "outline"}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleHero(photo.id);
                      }}
                      className="gap-1.5"
                    >
                      <Star className={cn(
                        "h-4 w-4",
                        photo.priority === 1 && "fill-current"
                      )} />
                      Hero
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPhotoClick(photo.id);
                      }}
                      className="gap-1.5"
                    >
                      <Crop className="h-4 w-4" />
                      Edit
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(photo.id);
                      }}
                      className="text-destructive hover:text-destructive gap-1.5"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewAll();
                      }}
                      className="gap-1.5"
                    >
                      <Grid3X3 className="h-4 w-4" />
                      View All
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRefresh();
                      }}
                      className="gap-1.5"
                      title="Regenerate collage"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Navigation arrows */}
        {photos.length > 1 && (
          <>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm shadow-md",
                !canScrollPrev && "opacity-50 pointer-events-none"
              )}
              onClick={scrollPrev}
              disabled={!canScrollPrev}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm shadow-md",
                !canScrollNext && "opacity-50 pointer-events-none"
              )}
              onClick={scrollNext}
              disabled={!canScrollNext}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
