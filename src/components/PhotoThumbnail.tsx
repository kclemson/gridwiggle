import { X, Loader2, AlertCircle, Check } from 'lucide-react';
import { PhotoItem, CropRegion } from '@/types/collage';
import { cn } from '@/lib/utils';

interface PhotoThumbnailProps {
  photo: PhotoItem;
  onRemove: () => void;
  onClick?: () => void;
  showCropped?: boolean;
  className?: string;
}

function getCroppedStyle(crop: CropRegion, originalWidth: number, originalHeight: number): React.CSSProperties {
  const scaleX = 100 / crop.width;
  const scaleY = 100 / crop.height;
  const scale = Math.min(scaleX, scaleY);
  
  return {
    objectFit: 'none' as const,
    objectPosition: `${-crop.x}px ${-crop.y}px`,
    width: originalWidth,
    height: originalHeight,
    transform: `scale(${scale * crop.width / originalWidth})`,
    transformOrigin: 'top left',
  };
}

export function PhotoThumbnail({ photo, onRemove, onClick, showCropped, className }: PhotoThumbnailProps) {
  const activeCrop = showCropped ? (photo.manualCrop || photo.smartCrop) : null;
  const aspectRatio = activeCrop 
    ? activeCrop.width / activeCrop.height 
    : photo.originalWidth / photo.originalHeight;

  return (
    <div
      className={cn(
        "relative group rounded-lg overflow-hidden bg-surface-elevated",
        onClick && "cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all",
        className
      )}
      style={{ aspectRatio }}
      onClick={onClick}
    >
      {/* Image container with overflow hidden */}
      <div className="absolute inset-0 overflow-hidden">
        {activeCrop ? (
          <div
            className="relative"
            style={{
              width: '100%',
              height: '100%',
            }}
          >
            <img
              src={photo.originalDataUrl}
              alt=""
              className="absolute"
              style={{
                width: `${(photo.originalWidth / activeCrop.width) * 100}%`,
                height: `${(photo.originalHeight / activeCrop.height) * 100}%`,
                left: `${(-activeCrop.x / activeCrop.width) * 100}%`,
                top: `${(-activeCrop.y / activeCrop.height) * 100}%`,
              }}
            />
          </div>
        ) : (
          <img
            src={photo.originalDataUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        )}
      </div>

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

      {/* Smart crop success indicator */}
      {showCropped && activeCrop && !photo.isProcessing && (
        <div className="absolute bottom-1 left-1 rounded-full bg-success p-1">
          <Check className="h-3 w-3 text-success-foreground" />
        </div>
      )}

      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-1 right-1 p-1.5 rounded-full bg-background/80 text-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground transition-all touch-target md:min-h-0 md:min-w-0"
        aria-label="Remove photo"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Touch-friendly remove button overlay for mobile */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-1 right-1 p-2 rounded-full bg-background/80 text-foreground md:hidden"
        aria-label="Remove photo"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
