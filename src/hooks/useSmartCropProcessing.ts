import { useState, useCallback, useRef } from 'react';
import { getSmartCrop, getSmartCropBatch, SmartCropInput } from '@/services/smartCropService';
import { getImageDimensions, createDisplayPreview } from '@/lib/imageUtils';
import { remoteLogger } from '@/lib/remoteLogger';
import { isMobileDevice } from '@/lib/platform';
import { PhotoItem, CollageLayout } from '@/types/collage';

// ============================================================================
// Types
// ============================================================================

export interface ProcessedDims {
  id: string;
  width: number;
  height: number;
}

// ============================================================================
// Hook
// ============================================================================

export function useSmartCropProcessing(deps: {
  photos: PhotoItem[];
  layout: CollageLayout | null;
  updatePhoto: (id: string, updates: Partial<PhotoItem>) => void;
  regenerateCollage: () => void;
}) {
  const { photos, layout, updatePhoto, regenerateCollage } = deps;

  const [smartCropProgress, setSmartCropProgress] = useState(0);
  const [isProcessingSmartCrop, setIsProcessingSmartCrop] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('Detecting faces and subjects...');
  const [currentlyProcessingId, setCurrentlyProcessingId] = useState<string | null>(null);
  const [smartCroppingPhotoId, setSmartCroppingPhotoId] = useState<string | null>(null);

  // Ref to access latest photos (avoids stale closure in async callbacks)
  const photosRef = useRef<PhotoItem[]>(photos);
  photosRef.current = photos;

  // Helper to give browser time to garbage collect between heavy operations
  // Critical for iOS Safari which leaks memory without explicit GC pauses
  const gcDelay = () => new Promise(resolve => setTimeout(resolve, 100));

  // ---- Shared helper: load dims + create previews for a single photo ----
  const preparePhoto = async (photo: PhotoItem): Promise<{ width: number; height: number }> => {
    const currentPhoto = photosRef.current.find(p => p.id === photo.id);
    let width = currentPhoto?.originalWidth || photo.originalWidth;
    let height = currentPhoto?.originalHeight || photo.originalHeight;

    if (width === 0 || height === 0) {
      remoteLogger.info('smartcrop', 'Phase: loading dimensions', { photoId: photo.id });
      const dimensions = await getImageDimensions(photo.objectUrl);
      width = dimensions.width;
      height = dimensions.height;

      remoteLogger.info('smartcrop', 'Phase: creating previews', { photoId: photo.id, width, height });
      const [preview, thumbnail] = await Promise.all([
        createDisplayPreview(photo.blob, 1200),
        createDisplayPreview(photo.blob, 480),
      ]);

      updatePhoto(photo.id, {
        originalWidth: width,
        originalHeight: height,
        previewUrl: preview.url,
        previewBlob: preview.blob,
        thumbnailUrl: thumbnail.url,
        thumbnailBlob: thumbnail.blob,
      });
    }

    return { width, height };
  };

  // Process smart crops for photos - called directly from event handler
  // Also loads dimensions + creates display previews (moved here for instant UI feedback)
  const processSmartCrops = useCallback(async (photosToProcess: PhotoItem[]): Promise<ProcessedDims[]> => {
    if (photosToProcess.length === 0) return [];

    const processedDims: ProcessedDims[] = [];

    setIsProcessingSmartCrop(true);
    setSmartCropProgress(0);

    let completed = 0;
    const total = photosToProcess.length;

    // ---- Mobile path: prepare all previews, then batch inference ----
    if (isMobileDevice()) {
      remoteLogger.info('smartcrop', 'Mobile batch path', { count: total });

      // Prepare previews sequentially (memory-safe on mobile)
      const batchInputs: SmartCropInput[] = [];
      for (const photo of photosToProcess) {
        try {
          const { width, height } = await preparePhoto(photo);
          batchInputs.push({ id: photo.id, objectUrl: photo.objectUrl, blob: photo.blob, width, height });
          processedDims.push({ id: photo.id, width, height });
        } catch (error) {
          console.error('Preview failed for photo:', photo.id, error);
          updatePhoto(photo.id, { isProcessing: false, error: error instanceof Error ? error.message : 'Failed to process' });
        }
        await gcDelay();
      }

      // Run inference concurrently (3 at a time via semaphore)
      await getSmartCropBatch(
        batchInputs,
        (result) => {
          const smartCropToApply = result.skipCrop ? null : result.crop;
          updatePhoto(result.id, { smartCrop: smartCropToApply, smartCropAttempted: true, isProcessing: false });
          completed++;
          setSmartCropProgress((completed / total) * 100);
          setCurrentlyProcessingId(result.id);
        },
        (status) => setProcessingStatus(status),
      );

      setCurrentlyProcessingId(null);
      setIsProcessingSmartCrop(false);
      setSmartCropProgress(0);
      return processedDims;
    }

    // ---- Desktop path: sequential with preview lookahead ----
    // Start preparing the next photo's previews while inference runs on current
    let lookaheadPromise: Promise<{ width: number; height: number }> | null = null;

    for (let i = 0; i < photosToProcess.length; i++) {
      const photo = photosToProcess[i];
      setCurrentlyProcessingId(photo.id);
      remoteLogger.info('smartcrop', 'Phase: start', { photoId: photo.id });

      try {
        // Use lookahead result if available, otherwise prepare inline
        let dims: { width: number; height: number };
        if (lookaheadPromise) {
          dims = await lookaheadPromise;
          lookaheadPromise = null;
        } else {
          dims = await preparePhoto(photo);
        }

        // Kick off lookahead for next photo (overlaps with inference below)
        if (i + 1 < photosToProcess.length) {
          lookaheadPromise = preparePhoto(photosToProcess[i + 1]);
        }

        remoteLogger.info('smartcrop', 'Phase: running detection', { photoId: photo.id });

        const result = await getSmartCrop(
          photo.objectUrl, photo.blob, dims.width, dims.height,
          (status) => setProcessingStatus(status),
        );

        const smartCropToApply = result.skipCrop ? null : result.crop;

        remoteLogger.info('smartcrop', 'Phase: complete', {
          photoId: photo.id, skipCrop: result.skipCrop, confidence: result.confidence,
        });

        updatePhoto(photo.id, { smartCrop: smartCropToApply, smartCropAttempted: true, isProcessing: false });
        processedDims.push({ id: photo.id, width: dims.width, height: dims.height });
      } catch (error) {
        console.error('Smart crop failed for photo:', photo.id, error);
        remoteLogger.error('smartcrop', 'Phase: failed', {
          photoId: photo.id,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        updatePhoto(photo.id, { isProcessing: false, error: error instanceof Error ? error.message : 'Failed to process' });
      }

      completed++;
      setSmartCropProgress((completed / total) * 100);

      if (completed < total) {
        await gcDelay();
      }
    }

    setCurrentlyProcessingId(null);
    setIsProcessingSmartCrop(false);
    setSmartCropProgress(0);

    return processedDims;
  }, [updatePhoto]);

  // Process smart crop for a single photo (mobile manual trigger)
  const handleSingleSmartCrop = useCallback(async (photoId: string) => {
    const photo = photos.find(p => p.id === photoId);
    if (!photo || photo.smartCrop) return;  // Already has crop

    remoteLogger.info('smartcrop-manual', 'Entry', {
      photoId,
      blobSize: photo.blob?.size ?? -1,
      blobType: photo.blob?.type ?? 'none',
      width: photo.originalWidth,
      height: photo.originalHeight,
      hasObjectUrl: !!photo.objectUrl,
    });

    setSmartCroppingPhotoId(photoId);

    try {
      remoteLogger.info('smartcrop-manual', 'Pre-getSmartCrop', { photoId });
      const result = await getSmartCrop(
        photo.objectUrl,
        photo.blob,
        photo.originalWidth,
        photo.originalHeight,
        (status) => {
          remoteLogger.info('smartcrop-manual', 'Status update', { photoId, status });
          setProcessingStatus(status);
        }
      );

      remoteLogger.info('smartcrop-manual', 'Result received', {
        photoId,
        skipCrop: result.skipCrop,
        confidence: result.confidence,
        subjects: result.subjects,
      });

      const smartCropToApply = result.skipCrop ? null : result.crop;

      updatePhoto(photoId, { smartCrop: smartCropToApply, smartCropAttempted: true });

      // Regenerate layout with new crop
      if (layout) {
        regenerateCollage();
      }
    } catch (error) {
      console.error('Smart crop failed:', error);
      remoteLogger.error('smartcrop-manual', 'Failed', {
        photoId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Silent fail - photo still works
    } finally {
      remoteLogger.info('smartcrop-manual', 'Finally', { photoId });
      setSmartCroppingPhotoId(null);
    }
  }, [photos, layout, updatePhoto, regenerateCollage]);

  // Undo smart crop for a single photo (remove AI crop)
  const handleUndoSmartCrop = useCallback((photoId: string) => {
    updatePhoto(photoId, { smartCrop: null, smartCropAttempted: false });

    if (layout) {
      regenerateCollage();
    }
  }, [layout, updatePhoto, regenerateCollage]);

  // Ref for recovery callback (avoids stale closure in useCollageState callback)
  const processSmartCropsRef = useRef<((photos: PhotoItem[]) => Promise<ProcessedDims[] | void>) | null>(null);
  processSmartCropsRef.current = processSmartCrops;

  return {
    isProcessingSmartCrop,
    smartCropProgress,
    processingStatus,
    currentlyProcessingId,
    smartCroppingPhotoId,
    processSmartCrops,
    processSmartCropsRef,
    handleSingleSmartCrop,
    handleUndoSmartCrop,
  };
}
