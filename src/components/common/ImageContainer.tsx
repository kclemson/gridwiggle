import { cn } from '@/lib/utils';

interface ImageContainerProps {
  aspectRatio?: 'square' | 'original' | number;
  originalWidth?: number;
  originalHeight?: number;
  className?: string;
  children: React.ReactNode;
}

/**
 * Flexible container for images with consistent sizing and aspect ratio control.
 * Separates layout concerns from image rendering.
 */
export function ImageContainer({
  aspectRatio = 'square',
  originalWidth,
  originalHeight,
  className,
  children,
}: ImageContainerProps) {
  // Calculate padding-bottom for aspect ratio trick
  let paddingBottom: string;
  
  if (aspectRatio === 'square') {
    paddingBottom = '100%';
  } else if (aspectRatio === 'original' && originalWidth && originalHeight) {
    paddingBottom = `${(originalHeight / originalWidth) * 100}%`;
  } else if (typeof aspectRatio === 'number') {
    paddingBottom = `${(1 / aspectRatio) * 100}%`;
  } else {
    paddingBottom = '100%'; // fallback to square
  }

  return (
    <div 
      className={cn('relative w-full', className)}
      style={{ paddingBottom }}
    >
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        {children}
      </div>
    </div>
  );
}
