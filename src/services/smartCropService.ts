import { CropRegion } from '@/types/collage';

interface SmartCropResult {
  crop: CropRegion;
  confidence: number;
  subjects: string;
}

interface WorkerStatusCallback {
  (status: string): void;
}

// Create worker singleton
let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('../workers/visionWorker.ts', import.meta.url),
      { type: 'module' }
    );
  }
  return worker;
}

// Scale image down to max 640px for performance
function scaleImageForProcessing(
  imageDataUrl: string,
  originalWidth: number,
  originalHeight: number
): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const maxSize = 640;
    
    // Check if scaling needed
    if (originalWidth <= maxSize && originalHeight <= maxSize) {
      resolve({ dataUrl: imageDataUrl, width: originalWidth, height: originalHeight });
      return;
    }
    
    const scale = Math.min(maxSize / originalWidth, maxSize / originalHeight);
    const newWidth = Math.round(originalWidth * scale);
    const newHeight = Math.round(originalHeight * scale);
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      resolve({
        dataUrl: canvas.toDataURL('image/jpeg', 0.85),
        width: newWidth,
        height: newHeight
      });
    };
    img.onerror = reject;
    img.src = imageDataUrl;
  });
}

export async function getSmartCrop(
  imageDataUrl: string,
  width: number,
  height: number,
  onStatus?: WorkerStatusCallback
): Promise<SmartCropResult> {
  // Scale down for performance
  const scaled = await scaleImageForProcessing(imageDataUrl, width, height);
  
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    
    const handleMessage = (e: MessageEvent) => {
      if (e.data.type === 'result') {
        worker.removeEventListener('message', handleMessage);
        resolve({
          crop: e.data.crop,
          confidence: e.data.confidence,
          subjects: e.data.subjects
        });
      } else if (e.data.type === 'error') {
        worker.removeEventListener('message', handleMessage);
        reject(new Error(e.data.error));
      } else if (e.data.type === 'status' && onStatus) {
        onStatus(e.data.message);
      }
    };
    
    worker.addEventListener('message', handleMessage);
    
    worker.postMessage({
      type: 'detect',
      imageDataUrl: scaled.dataUrl,
      originalWidth: width,
      originalHeight: height,
      processedWidth: scaled.width,
      processedHeight: scaled.height
    });
  });
}
