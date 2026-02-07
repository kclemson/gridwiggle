import { CropRegion } from '@/types/collage';

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  const img = await loadImage(src);
  return { width: img.width, height: img.height };
}

export function getCroppedImageDataUrl(
  originalSrc: string,
  crop: CropRegion
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const img = await loadImage(originalSrc);
      const canvas = document.createElement('canvas');
      canvas.width = crop.width;
      canvas.height = crop.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(
        img,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height
      );
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    } catch (e) {
      reject(e);
    }
  });
}


/**
 * Convert a Blob to a base64 data URL.
 * Used when we need base64 for APIs (e.g., smart crop edge function).
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Extract base64 string from a data URL.
 */
export function dataUrlToBase64(dataUrl: string): string {
  const base64Index = dataUrl.indexOf('base64,');
  if (base64Index !== -1) {
    return dataUrl.substring(base64Index + 7);
  }
  return dataUrl;
}

/**
 * Create a display-resolution preview of an image for UI rendering.
 * Scales down large images to reduce memory pressure and improve performance.
 * 
 * @param blob - Original image blob
 * @param maxSize - Maximum dimension (longest edge), default 1200px
 * @returns Promise with preview blob and object URL
 */
export async function createDisplayPreview(
  blob: Blob,
  maxSize: number = 1200
): Promise<{ blob: Blob; url: string }> {
  // Load the image to get dimensions
  const objectUrl = URL.createObjectURL(blob);
  
  try {
    const img = await loadImage(objectUrl);
    const { width, height } = img;
    
    // If image is already small enough, return the original
    if (width <= maxSize && height <= maxSize) {
      return { blob, url: objectUrl };
    }
    
    // Calculate scaled dimensions
    const scale = maxSize / Math.max(width, height);
    const newWidth = Math.round(width * scale);
    const newHeight = Math.round(height * scale);
    
    // Use OffscreenCanvas if available (better for memory), fallback to regular canvas
    let canvas: HTMLCanvasElement | OffscreenCanvas;
    let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    
    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(newWidth, newHeight);
      ctx = canvas.getContext('2d');
    } else {
      canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      ctx = canvas.getContext('2d');
    }
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    
    // Draw scaled image
    ctx.drawImage(img, 0, 0, newWidth, newHeight);
    
    // Convert to blob
    let previewBlob: Blob;
    if (canvas instanceof OffscreenCanvas) {
      previewBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
    } else {
      previewBlob = await new Promise<Blob>((resolve, reject) => {
        (canvas as HTMLCanvasElement).toBlob(
          (b) => b ? resolve(b) : reject(new Error('Failed to create blob')),
          'image/jpeg',
          0.85
        );
      });
    }
    
    // Clean up original URL since we're returning a new one
    URL.revokeObjectURL(objectUrl);
    
    const previewUrl = URL.createObjectURL(previewBlob);
    return { blob: previewBlob, url: previewUrl };
  } catch (error) {
    // On error, return original
    return { blob, url: objectUrl };
  }
}
