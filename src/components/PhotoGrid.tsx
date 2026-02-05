import { useMemo } from 'react';
import { PhotoItem } from '@/types/collage';
import { PhotoThumbnail } from './PhotoThumbnail';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PhotoGridProps {
  photos: PhotoItem[];
  onRemove: (photoId: string) => void;
  onPhotoClick?: (photoId: string) => void;
  showCropped?: boolean;
  title: string;
  hint?: string;
  emptyMessage?: string;
}

export function PhotoGrid({ 
  photos, 
  onRemove, 
  onPhotoClick, 
  showCropped, 
  title,
  hint,
  emptyMessage 
}: PhotoGridProps) {
  // Sort by priority (heroes first), preserving original order within same priority
  const sortedPhotos = useMemo(() => {
    return [...photos].sort((a, b) => (a.priority ?? 3) - (b.priority ?? 3));
  }, [photos]);

  // Count photos with smart crop applied
  const smartCroppedCount = useMemo(() => {
    return photos.filter(p => p.smartCrop !== null).length;
  }, [photos]);

  if (photos.length === 0 && emptyMessage) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
        {title} ({photos.length}{smartCroppedCount > 0 && `, ${smartCroppedCount} smartcropped`})
        {hint && (
          <span className="normal-case font-normal italic ml-1">({hint})</span>
        )}
      </h3>
      <ScrollArea className="[&>[data-radix-scroll-area-viewport]]:max-h-60">
        <div className="flex flex-wrap gap-2 pr-2">
          {sortedPhotos.map((photo) => (
            <PhotoThumbnail
              key={photo.id}
              photo={photo}
              onRemove={() => onRemove(photo.id)}
              onClick={onPhotoClick ? () => onPhotoClick(photo.id) : undefined}
              showCropped={showCropped}
              height={80}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
