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

  // For cropped images, we need to:
  // 1. Scale the image so the crop region fits within the container
  // 2. Position the image so the crop region is centered
  // 3. NEVER distort the image's natural aspect ratio
  
  // The image's natural aspect ratio
  const imageAR = originalWidth / originalHeight;
  
  // The crop region's aspect ratio
  const cropAR = crop.width / crop.height;
  
  // We'll render the image at its natural aspect ratio, then use transform: scale()
  // to size it so the crop region matches the container size.
  // 
  // Strategy: 
  // - Set the image to a base size where we can calculate everything
  // - Use transform: scale() to make the crop region fill the container
  // - Use transform: translate() to position the crop region at origin
  // - Center the result if crop AR doesn't match container AR
  
  // For "contain" behavior: the crop region should fit entirely within container
  // For "cover" behavior: the crop region should cover the entire container
  
  // We use a 100% width base, then calculate scale factors
  // If image is 1000x750 (AR = 1.33) and we set width=100%, height would be 75%
  // relative to a square container
  
  // Scale needed to make crop region fit container (assuming square container for now)
  // We want: crop.width * scale = containerWidth, crop.height * scale = containerHeight
  // For contain in square: scale = 1 / max(crop.width/originalWidth, crop.height/originalHeight) * 100
  // Simplified: we want the crop region to be 100% of container
  
  // Let's think in terms of: 
  // - Base image at width=100% (of container), height=auto (preserves AR)
  // - Then scale so crop region becomes 100% of container
  
  // If container is 100x100, image is 1000x750, crop is 500x375:
  // Base image at width=100 -> height = 100 * (750/1000) = 75
  // Crop region at this base scale: (500/1000)*100 = 50 wide, (375/750)*75 = 37.5 tall
  // To make crop fill container: scale = 100/50 = 2 for width, 100/37.5 = 2.67 for height
  // For contain: use min scale = 2 -> crop becomes 100x75, centered vertically
  // For cover: use max scale = 2.67 -> crop becomes 133x100, clipped horizontally
  
  // Calculate the scale factor to make the crop region fit/fill the container
  // Using relative units: crop as fraction of original image
  const cropXFrac = crop.width / originalWidth;  // e.g., 0.5
  const cropYFrac = crop.height / originalHeight; // e.g., 0.5
  
  // For a square container with the image at 100% width:
  // Image renders at: width=100%, height=(100% / imageAR)
  // Crop region renders at: width=(cropXFrac * 100)%, height=(cropYFrac * 100% / imageAR)
  // But we want crop to be 100% of container
  
  // Scale factor for X: 1 / cropXFrac (to make crop width = container width)
  // Scale factor for Y: 1 / cropYFrac (to make crop height = container height)
  
  const scaleForWidth = 1 / cropXFrac;   // scale to make crop width = container width
  const scaleForHeight = 1 / cropYFrac;  // scale to make crop height = container height
  
  // For contain: use smaller scale (crop fits inside)
  // For cover: use larger scale (crop covers container)
  const scaleFactor = fit === 'contain' 
    ? Math.min(scaleForWidth, scaleForHeight)
    : Math.max(scaleForWidth, scaleForHeight);
  
  // After scaling, position the image so the crop region aligns with container origin
  // The crop's top-left corner (as fraction of image) should move to container origin
  const cropXPosFrac = crop.x / originalWidth;  // e.g., 0.25
  const cropYPosFrac = crop.y / originalHeight; // e.g., 0.25
  
  // IMPORTANT: translate() percentages are relative to the ELEMENT's size, not the container!
  // Since the element is already scaled (width = scaleFactor * 100% of container),
  // we only need to translate by the crop position as a percentage of the image.
  // The scaleFactor is already "baked in" to the element's dimensions.
  const translateX = -cropXPosFrac * 100;
  const translateY = -cropYPosFrac * 100;
  
  // Calculate centering offset (in container units)
  // After scale, crop region size (as % of container):
  const scaledCropWidth = cropXFrac * scaleFactor * 100;  // should be 100% for the fit dimension
  const scaledCropHeight = cropYFrac * scaleFactor * 100; // might be < or > 100%
  
  // For contain: center the smaller dimension
  // For cover: center the larger dimension (it will be clipped)
  // These offsets need to be converted to element-relative percentages for translate()
  const centerOffsetX = (100 - scaledCropWidth) / (2 * scaleFactor);
  const centerOffsetY = (100 - scaledCropHeight) / (2 * scaleFactor);
  
  return (
    <div className={cn('relative overflow-hidden w-full h-full', className)}>
      <img
        src={src}
        alt=""
        style={{
          position: 'absolute',
          width: `${scaleFactor * 100}%`,
          height: 'auto', // Preserve aspect ratio!
          transform: `translate(${translateX + centerOffsetX}%, ${translateY + centerOffsetY}%)`,
          transformOrigin: 'top left',
        }}
        draggable={false}
      />
    </div>
  );
}
