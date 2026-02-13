import { CropRegion } from '@/types/collage';
import { supabase } from '@/integrations/supabase/client';
import { remoteLogger } from '@/lib/remoteLogger';
import { loadImage } from '@/lib/imageUtils';

interface SmartCropResult {
  crop: CropRegion;
  confidence: number;
  subjects: string;
  skipCrop: boolean;
}

interface WorkerStatusCallback {
  (status: string): void;
}

/**
 * Resize a blob to max `maxSize` px on its longest edge, then return base64 string.
 * Keeps the original dimensions for coordinate mapping (the edge function
 * receives original width/height so it returns pixel coords in original space).
 */
async function resizeAndEncode(blob: Blob, maxSize: number = 800): Promise<string> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await loadImage(objectUrl);
    const { width, height } = img;

    // If already small enough, just encode directly
    const scale = Math.min(1, maxSize / Math.max(width, height));
    const newW = Math.round(width * scale);
    const newH = Math.round(height * scale);

    let canvas: HTMLCanvasElement | OffscreenCanvas;
    let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(newW, newH);
      ctx = canvas.getContext('2d');
    } else {
      canvas = document.createElement('canvas');
      canvas.width = newW;
      canvas.height = newH;
      ctx = canvas.getContext('2d');
    }

    if (!ctx) throw new Error('Could not get canvas context');
    ctx.drawImage(img, 0, 0, newW, newH);

    // Get base64
    let dataUrl: string;
    if (canvas instanceof OffscreenCanvas) {
      const resizedBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.80 });
      dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(resizedBlob);
      });
    } else {
      dataUrl = canvas.toDataURL('image/jpeg', 0.80);
    }

    // Strip the data URL prefix to get raw base64
    const base64Index = dataUrl.indexOf('base64,');
    return base64Index !== -1 ? dataUrl.substring(base64Index + 7) : dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Server-side smart crop using the smart-crop edge function.
 * Used for mobile devices where on-device ONNX inference crashes Safari.
 *
 * The edge function uses Gemini Flash vision to detect subjects and return
 * optimal crop coordinates — same SmartCropResult interface as the on-device path.
 */
export async function getServerSmartCrop(
  _objectUrl: string,
  blob: Blob,
  width: number,
  height: number,
  onStatus?: WorkerStatusCallback,
): Promise<SmartCropResult> {
  remoteLogger.info('server-crop', 'Entry', { blobSize: blob.size, width, height });
  onStatus?.('Uploading to server for analysis...');

  try {
    // Resize client-side to keep upload small (~200-500KB)
    const imageBase64 = await resizeAndEncode(blob, 800);

    onStatus?.('Analyzing subjects...');

    const { data, error } = await supabase.functions.invoke('smart-crop', {
      body: { imageBase64, width, height },
    });

    if (error) {
      remoteLogger.error('server-crop', 'Edge function error', { error: String(error) });
      throw error;
    }

    if (data?.error) {
      remoteLogger.error('server-crop', 'Server returned error', { error: data.error });
      throw new Error(data.error);
    }

    const { crop, confidence, subjects } = data;

    remoteLogger.info('server-crop', 'Result', { crop, confidence, subjects });

    return {
      crop,
      confidence: confidence ?? 0.7,
      subjects: subjects ?? 'server analysis',
      skipCrop: data.skipCrop ?? false,
    };
  } catch (error) {
    remoteLogger.error('server-crop', 'Failed, falling back to full image', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Graceful fallback — photo still works, just without smart crop
    return {
      crop: { x: 0, y: 0, width, height },
      confidence: 0,
      subjects: 'Server unavailable',
      skipCrop: true,
    };
  }
}
