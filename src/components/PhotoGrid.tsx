import { PhotoItem } from '@/types/collage';
import { PhotoThumbnail } from './PhotoThumbnail';

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
        {title} ({photos.length})
        {hint && (
          <span className="normal-case font-normal italic ml-1">— {hint}</span>
        )}
      </h3>
      <div className="flex flex-wrap gap-2">
        {photos.map((photo) => (
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
    </div>
  );
}
