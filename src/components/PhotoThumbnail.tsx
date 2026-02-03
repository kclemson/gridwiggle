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

// Check if crop dimensions are valid for display
function isValidCrop(crop: CropRegion): boolean {
  return crop.width >= 50 && crop.height >= 50;
}

export function PhotoThumbnail({ photo, onRemove, onClick, showCropped, className }: PhotoThumbnailProps) {
  const rawCrop = showCropped ? (photo.manualCrop || photo.smartCrop) : null;
  // Only use crop if it's valid
  const activeCrop = rawCrop && isValidCrop(rawCrop) ? rawCrop : null;

  return (
    <div
      className={cn(
        "relative group rounded-lg overflow-hidden bg-surface-elevated aspect-square",
        onClick && "cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all",
        className
      )}
      onClick={onClick}
    >
      {/* Image container - centered with object-contain for letterbox/pillarbox effect */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        {activeCrop ? (
          // Cropped preview: use transform-based approach for reliable rendering
          (() => {
            const cropAspect = activeCrop.width / activeCrop.height;
            // Determine container dimensions based on crop aspect ratio
            // The container should fit within the square while maintaining crop's aspect ratio
            const containerStyle: React.CSSProperties = cropAspect >= 1
              ? { width: '100%', height: `${100 / cropAspect}%` }
              : { width: `${100 * cropAspect}%`, height: '100%' };
            
            // Scale factor: how much to scale the full image so the crop region fills the container
            const scaleX = 100 / (activeCrop.width / photo.originalWidth * 100);
            const scaleY = 100 / (activeCrop.height / photo.originalHeight * 100);
            const scale = Math.min(scaleX, scaleY);
            
            // Translate to position the crop region at the origin
            const translateX = -(activeCrop.x / photo.originalWidth) * 100 * scale;
            const translateY = -(activeCrop.y / photo.originalHeight) * 100 * scale;
            
            return (
              <div 
                className="relative overflow-hidden flex items-center justify-center"
                style={containerStyle}
              >
                <img
                  src={photo.originalDataUrl}
                  alt=""
                  className="absolute top-0 left-0"
                  style={{
                    width: `${scale * 100}%`,
                    height: `${scale * 100}%`,
                    transform: `translate(${translateX}%, ${translateY}%)`,
                    transformOrigin: 'top left',
                  }}
                />
              </div>
            );
          })()
        ) : (
          <img
            src={photo.originalDataUrl}
            alt=""
            className="max-w-full max-h-full object-contain"
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
