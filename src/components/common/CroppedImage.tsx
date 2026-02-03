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
 * 
 * Uses SVG viewBox for cropped images - this delegates all the complex
 * aspect ratio and positioning math to the browser, which handles it correctly.
 */
export function CroppedImage({
  src,
  crop,
  originalWidth,
  originalHeight,
  fit = 'contain',
  className,
}: CroppedImageProps) {
  // Defensive: if dimensions are missing, render simple image
  if (!originalWidth || !originalHeight) {
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

  // For cropped images, use SVG with viewBox
  // The viewBox defines which portion of the image to show (the crop region)
  // preserveAspectRatio handles contain/cover semantics:
  //   - "xMidYMid meet" = contain (fit entire crop region, may have letterboxing)
  //   - "xMidYMid slice" = cover (fill container, may clip crop region)
  const viewBox = `${crop.x} ${crop.y} ${crop.width} ${crop.height}`;
  const preserveAspectRatio = fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice';

  return (
    <div className={cn('relative overflow-hidden w-full h-full', className)}>
      <svg
        className="w-full h-full block"
        viewBox={viewBox}
        preserveAspectRatio={preserveAspectRatio}
      >
        <image
          href={src}
          x="0"
          y="0"
          width={originalWidth}
          height={originalHeight}
          preserveAspectRatio="none"
        />
      </svg>
    </div>
  );
}
