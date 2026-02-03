import { PhotoItem } from '@/types/collage';
import { PhotoThumbnail } from './PhotoThumbnail';

interface PhotoGridProps {
  photos: PhotoItem[];
  onRemove: (photoId: string) => void;
  onPhotoClick?: (photoId: string) => void;
  showCropped?: boolean;
  title: string;
  emptyMessage?: string;
}

export function PhotoGrid({ 
  photos, 
  onRemove, 
  onPhotoClick, 
  showCropped, 
  title,
  emptyMessage 
}: PhotoGridProps) {
  if (photos.length === 0 && emptyMessage) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide px-1">
        {title}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map((photo) => (
          <PhotoThumbnail
            key={photo.id}
            photo={photo}
            onRemove={() => onRemove(photo.id)}
            onClick={onPhotoClick ? () => onPhotoClick(photo.id) : undefined}
            showCropped={showCropped}
          />
        ))}
      </div>
    </div>
  );
}
