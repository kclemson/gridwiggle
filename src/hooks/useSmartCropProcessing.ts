import { useState, useCallback, useRef } from 'react';
import { getSmartCrop } from '@/services/smartCropService';
import { getImageDimensions, createDisplayPreview } from '@/lib/imageUtils';
import { remoteLogger } from '@/lib/remoteLogger';
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

  // Process smart crops for photos - called directly from event handler
  // Also loads dimensions + creates display previews (moved here for instant UI feedback)
  const processSmartCrops = useCallback(async (photosToProcess: PhotoItem[]): Promise<ProcessedDims[]> => {
    if (photosToProcess.length === 0) return [];

    const processedDims: ProcessedDims[] = [];

    setIsProcessingSmartCrop(true);
    setSmartCropProgress(0);

    let completed = 0;
    const total = photosToProcess.length;

    for (const photo of photosToProcess) {
      // Track currently processing photo for the ProcessingView
      setCurrentlyProcessingId(photo.id);
      remoteLogger.info('smartcrop', 'Phase: start', { photoId: photo.id });

      try {
        // Get fresh photo data from state (dimensions may have been updated)
        const currentPhoto = photosRef.current.find(p => p.id === photo.id);
        let width = currentPhoto?.originalWidth || photo.originalWidth;
        let height = currentPhoto?.originalHeight || photo.originalHeight;

        // Load dimensions if not yet known (moved from PhotoUploader for instant feedback)
        if (width === 0 || height === 0) {
          remoteLogger.info('smartcrop', 'Phase: loading dimensions', { photoId: photo.id });

          const dimensions = await getImageDimensions(photo.objectUrl);
          width = dimensions.width;
          height = dimensions.height;

          remoteLogger.info('smartcrop', 'Phase: creating previews', {
            photoId: photo.id,
            width,
            height,
          });

          // Create both preview sizes in parallel
          const [preview, thumbnail] = await Promise.all([
            createDisplayPreview(photo.blob, 1200),  // For crop editor
            createDisplayPreview(photo.blob, 480),   // For collage canvas
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

        remoteLogger.info('smartcrop', 'Phase: running detection', { photoId: photo.id });

        const result = await getSmartCrop(
          photo.objectUrl,
          photo.blob,
          width,
          height,
          (status) => setProcessingStatus(status)
        );

        // Only apply smart crop if model is confident enough
        // Low confidence (< 0.6) typically means cartoons, memes, screenshots
        const smartCropToApply = result.skipCrop ? null : result.crop;

        remoteLogger.info('smartcrop', 'Phase: complete', {
          photoId: photo.id,
          skipCrop: result.skipCrop,
          confidence: result.confidence,
        });

        updatePhoto(photo.id, {
          smartCrop: smartCropToApply,
          smartCropAttempted: true,
          isProcessing: false,
        });

        // Collect dimensions for caller (bypasses stale React state)
        processedDims.push({ id: photo.id, width, height });
      } catch (error) {
        console.error('Smart crop failed for photo:', photo.id, error);
        remoteLogger.error('smartcrop', 'Phase: failed', {
          photoId: photo.id,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        updatePhoto(photo.id, {
          isProcessing: false,
          error: error instanceof Error ? error.message : 'Failed to process',
        });
      }

      completed++;
      setSmartCropProgress((completed / total) * 100);

      // Give browser time to GC between photos (critical for iOS Safari)
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
