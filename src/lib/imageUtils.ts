import { CropRegion } from '@/types/collage';

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  const img = await loadImage(dataUrl);
  return { width: img.width, height: img.height };
}

export function getCroppedImageDataUrl(
  originalDataUrl: string,
  crop: CropRegion
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const img = await loadImage(originalDataUrl);
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

export function getActiveCrop(photo: { smartCrop: CropRegion | null; manualCrop: CropRegion | null }): CropRegion | null {
  return photo.manualCrop || photo.smartCrop;
}

export function dataUrlToBase64(dataUrl: string): string {
  // Remove the data:image/...;base64, prefix
  const base64Index = dataUrl.indexOf('base64,');
  if (base64Index !== -1) {
    return dataUrl.substring(base64Index + 7);
  }
  return dataUrl;
}
