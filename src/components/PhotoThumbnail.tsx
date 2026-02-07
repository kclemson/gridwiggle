import { memo } from 'react';
import { X, Loader2, AlertCircle, Star } from 'lucide-react';
import { PhotoItem } from '@/types/collage';
import { CroppedImage } from '@/components/common/CroppedImage';
import { getDisplayCrop } from '@/lib/cropUtils';
import { cn } from '@/lib/utils';

interface PhotoThumbnailProps {
  photo: PhotoItem;
  onRemove: () => void;
  onClick?: () => void;
  showCropped?: boolean;
  height?: number;
  className?: string;
}

export const PhotoThumbnail = memo(function PhotoThumbnail({ 
  photo, 
  onRemove, 
  onClick, 
  showCropped, 
  height = 80,
  className 
}: PhotoThumbnailProps) {
  // Use centralized crop utility for consistent validation
  const activeCrop = showCropped ? getDisplayCrop(photo) : null;
  
  // Calculate width based on aspect ratio
  // If cropped: use crop's aspect ratio
  // If not cropped: use original image's aspect ratio
  const aspectRatio = activeCrop 
    ? activeCrop.width / activeCrop.height 
    : photo.originalWidth / photo.originalHeight;
  
  const width = Math.round(height * aspectRatio);

  return (
    <div
      className={cn(
        "relative group overflow-hidden bg-surface-elevated shrink-0",
        onClick && "cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all",
        className
      )}
      style={{ width, height }}
      onClick={onClick}
    >
      <CroppedImage
        src={photo.objectUrl}
        crop={showCropped ? activeCrop : null}
        originalWidth={photo.originalWidth}
        originalHeight={photo.originalHeight}
        fit="cover"
      />

      {/* Processing overlay */}
      {photo.isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
        </div>
      )}

      {/* Error overlay */}
      {photo.error && (
        <div className="absolute inset-0 flex items-center justify-center bg-destructive/20 backdrop-blur-sm">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
      )}

      {/* Hero badge */}
      {photo.priority === 1 && (
        <div className="absolute top-1 left-1 p-1 rounded-full bg-amber-500 text-white shadow-sm">
          <Star className="h-3 w-3 fill-current" />
        </div>
      )}


      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className={cn(
          "absolute top-1 right-1 rounded-full bg-background/80 text-foreground transition-all",
          "hover:bg-destructive hover:text-destructive-foreground",
          // Mobile: always visible, touch-friendly size
          "p-2 opacity-100",
          // Desktop: smaller, hover-only
          "md:p-1.5 md:opacity-0 md:group-hover:opacity-100"
        )}
        aria-label="Remove photo"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
});
