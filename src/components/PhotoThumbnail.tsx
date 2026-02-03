import { X, Loader2, AlertCircle, Check } from 'lucide-react';
import { PhotoItem, CropRegion } from '@/types/collage';
import { CroppedImage } from '@/components/common/CroppedImage';
import { ImageContainer } from '@/components/common/ImageContainer';
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
  
  // Use "cover" when displaying a crop so the cropped region fills the thumbnail
  // Use "contain" for original photos to show the full image
  const fitMode = showCropped && activeCrop ? 'cover' : 'contain';

  return (
    <div
      className={cn(
        "relative group rounded-lg overflow-hidden bg-surface-elevated",
        onClick && "cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all",
        className
      )}
      onClick={onClick}
    >
      <ImageContainer aspectRatio="square">
        <CroppedImage
          src={photo.objectUrl}
          crop={showCropped ? activeCrop : null}
          originalWidth={photo.originalWidth}
          originalHeight={photo.originalHeight}
          fit={fitMode}
        />
      </ImageContainer>

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
