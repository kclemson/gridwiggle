import { supabase } from '@/integrations/supabase/client';
import { CropRegion } from '@/types/collage';
import { dataUrlToBase64 } from '@/lib/imageUtils';

interface SmartCropResult {
  crop: CropRegion;
  confidence: number;
  subjects: string;
}

export async function getSmartCrop(
  imageDataUrl: string,
  width: number,
  height: number
): Promise<SmartCropResult> {
  const imageBase64 = dataUrlToBase64(imageDataUrl);

  const { data, error } = await supabase.functions.invoke('smart-crop', {
    body: { imageBase64, width, height },
  });

  if (error) {
    console.error('Smart crop error:', error);
    throw new Error(error.message || 'Failed to get smart crop');
  }

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}
