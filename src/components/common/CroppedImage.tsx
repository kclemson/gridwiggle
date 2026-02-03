import { CropRegion } from '@/types/collage';
import { cn } from '@/lib/utils';

interface CroppedImageProps {
  src: string;
  crop: CropRegion | null;
  originalWidth: number;
  originalHeight: number;
  fit?: 'contain' | 'cover';
  className?: string;
}

/**
 * Unified component for rendering images with optional crop regions.
 * Single source of truth for all crop rendering across the app.
 */
export function CroppedImage({
  src,
  crop,
  originalWidth,
  originalHeight,
  fit = 'contain',
  className,
}: CroppedImageProps) {
  // If no crop, render simple image with object-fit
  if (!crop) {
    return (
      <img
        src={src}
        alt=""
        className={cn(
          'w-full h-full',
          fit === 'contain' ? 'object-contain' : 'object-cover',
          className
        )}
        draggable={false}
      />
    );
  }

  // Validate crop dimensions - fall back to uncropped if too small
  if (crop.width < 50 || crop.height < 50) {
    return (
      <img
        src={src}
        alt=""
        className={cn(
          'w-full h-full',
          fit === 'contain' ? 'object-contain' : 'object-cover',
          className
        )}
        draggable={false}
      />
    );
  }

  // Calculate transform to show cropped region
  // Scale: how much to enlarge the image so crop region fills container
  const scaleX = originalWidth / crop.width;
  const scaleY = originalHeight / crop.height;
  const scale = Math.min(scaleX, scaleY);

  // Translate: position the crop region at origin (as percentage of scaled image)
  const translateX = -(crop.x / originalWidth) * 100 * scale;
  const translateY = -(crop.y / originalHeight) * 100 * scale;

  return (
    <div className={cn('relative overflow-hidden w-full h-full', className)}>
      <img
        src={src}
        alt=""
        className="absolute top-0 left-0"
        style={{
          width: `${scale * 100}%`,
          height: `${scale * 100}%`,
          transform: `translate(${translateX}%, ${translateY}%)`,
          transformOrigin: 'top left',
        }}
        draggable={false}
      />
    </div>
  );
}
