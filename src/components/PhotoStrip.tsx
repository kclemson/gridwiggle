import { PhotoItem } from '@/types/collage';
import { Button } from '@/components/ui/button';
import { Grid3X3 } from 'lucide-react';

interface PhotoStripProps {
  photos: PhotoItem[];
  autoCroppedCount: number;
  onViewAll: () => void;
}

export function PhotoStrip({
  photos,
  autoCroppedCount,
  onViewAll,
}: PhotoStripProps) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
        Photos ({photos.length})
        {autoCroppedCount > 0 && (
          <>
            <span className="mx-2 text-muted-foreground/50 normal-case">·</span>
            <span className="text-primary/80 normal-case font-normal tracking-normal">
              {autoCroppedCount} auto-cropped
            </span>
          </>
        )}
      </h3>

      {/* Photo strip - overflow hidden, not scrollable */}
      <div className="h-14 overflow-hidden rounded-lg bg-muted/30">
        <div className="flex h-full gap-0.5">
          {photos.map((photo) => (
            <img
              key={photo.id}
              src={photo.thumbnailUrl ?? photo.previewUrl ?? photo.objectUrl}
              alt=""
              className="h-full w-auto flex-shrink-0 object-cover"
            />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center">
        <Button variant="outline" size="sm" onClick={onViewAll}>
          <Grid3X3 className="h-4 w-4 mr-1.5" />
          View All
        </Button>
      </div>
    </div>
  );
}
