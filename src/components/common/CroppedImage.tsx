import { memo } from 'react';
import { CropRegion } from '@/types/collage';
import { cn } from '@/lib/utils';

interface CroppedImageProps {
  src: string;
  previewSrc?: string;        // Scaled-down preview for crop editor (~1200px)
  thumbnailSrc?: string;      // Smaller preview for collage canvas (~480px)
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
 * Uses CSS-based cropping with overflow:hidden and transforms.
 * This is significantly faster than SVG viewBox because it uses
 * the browser's native image pipeline with hardware acceleration.
 */
export const CroppedImage = memo(function CroppedImage({
  src,
  previewSrc,
  thumbnailSrc,
  crop,
  originalWidth,
  originalHeight,
  fit = 'contain',
  className,
}: CroppedImageProps) {
  // Use smallest available preview for rendering (lower memory pressure)
  const displaySrc = thumbnailSrc ?? previewSrc ?? src;
  // Defensive: if dimensions are missing, render simple image
  if (!originalWidth || !originalHeight) {
    return (
      <img
        src={displaySrc}
        alt=""
        className={cn(
          'w-full h-full',
          fit === 'contain' ? 'object-contain' : 'object-cover',
          className
        )}
        draggable={false}
        decoding="async"
      />
    );
  }

  // If no crop, render simple image with object-fit
  if (!crop) {
    return (
      <img
        src={displaySrc}
        alt=""
        className={cn(
          'w-full h-full',
          fit === 'contain' ? 'object-contain' : 'object-cover',
          className
        )}
        draggable={false}
        decoding="async"
      />
    );
  }

  // Validate crop dimensions - fall back to uncropped if too small
  if (crop.width < 50 || crop.height < 50) {
    return (
      <img
        src={displaySrc}
        alt=""
        className={cn(
          'w-full h-full',
          fit === 'contain' ? 'object-contain' : 'object-cover',
          className
        )}
        draggable={false}
        decoding="async"
      />
    );
  }

  // CSS-based cropping using overflow:hidden and transforms
  // 
  // The math:
  // - Scale image so crop region fills container: (originalSize / cropSize) * 100%
  // - Translate to position crop at origin: (-cropOffset / cropSize) * 100%
  //
  // Using percentages ensures the crop is accurate regardless of container size.
  
  const scaleX = (originalWidth / crop.width) * 100;
  const scaleY = (originalHeight / crop.height) * 100;
  const translateX = (-crop.x / originalWidth) * 100;
  const translateY = (-crop.y / originalHeight) * 100;

  return (
    <div className={cn('relative overflow-hidden w-full h-full', className)}>
      <img
        src={displaySrc}
        alt=""
        draggable={false}
        decoding="async"
        style={{
          width: `${scaleX}%`,
          height: `${scaleY}%`,
          maxWidth: 'none',
          maxHeight: 'none',
          transform: `translate(${translateX}%, ${translateY}%)`,
          // For contain mode, we need object-fit on the wrapper level
          // For cover mode (default in collages), the scaling handles it
          objectFit: fit === 'contain' ? 'contain' : undefined,
        }}
      />
    </div>
  );
});
