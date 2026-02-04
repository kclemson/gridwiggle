import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useCollageState } from '@/hooks/useCollageState';
import { PhotoUploader } from '@/components/PhotoUploader';
import { PhotoGrid } from '@/components/PhotoGrid';
import { CollageSettings } from '@/components/CollageSettings';
import { CropEditor } from '@/components/CropEditor';
import { CollagePreview } from '@/components/CollagePreview';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getSmartCrop } from '@/services/smartCropService';
import { generateCollageLayout, reflowAfterSwap } from '@/lib/collageLayout';
import { exportCollageAsPng, shareOrDownload } from '@/lib/exportCollage';
import { PhotoItem, CropRegion, CollageSettings as CollageSettingsType, PhotoPriority } from '@/types/collage';
import { cn } from '@/lib/utils';
import { 
  Wand2, 
  Grid3X3, 
  Download, 
  Loader2,
  Trash2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

export default function Index() {
  const {
    state,
    isLoading,
    addPhotos,
    removePhoto,
    updatePhoto,
    updateSettings,
    setLayout,
    updateLayoutCells,
    clearAll,
  } = useCollageState();

  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [smartCropProgress, setSmartCropProgress] = useState(0);
  const [isProcessingSmartCrop, setIsProcessingSmartCrop] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('Detecting faces and subjects...');
  

  // Ref to access latest photos (avoids stale closure in async callbacks)
  const photosRef = useRef<PhotoItem[]>(state.photos);
  photosRef.current = state.photos;

  // Options for regenerating the collage layout
  interface RegenerateOptions {
    /** Use specific photos instead of current state (for removal before state updates) */
    photos?: PhotoItem[];
    /** Use specific settings instead of current state */
    settings?: CollageSettingsType;
    /** Override a single photo's priority before state updates */
    priorityOverride?: { photoId: string; priority: PhotoPriority };
    /** Override a single photo's crop before state updates */
    cropOverride?: { photoId: string; crop: CropRegion };
    /** Shuffle for variety (refresh button) */
    randomize?: boolean;
  }

  // Centralized collage regeneration - all triggers use this
  const regenerateCollage = useCallback((options: RegenerateOptions = {}) => {
    const {
      photos = photosRef.current,
      settings = state.settings,
      priorityOverride,
      cropOverride,
      randomize = false,
    } = options;
    
    // Apply crop override to get correct dimensions immediately (avoids stale state)
    let photosToUse = photos;
    if (cropOverride) {
      photosToUse = photos.map(p => 
        p.id === cropOverride.photoId 
          ? { ...p, manualCrop: cropOverride.crop }
          : p
      );
    }
    
    // Need at least 2 photos for a collage
    if (photosToUse.length < 2) {
      setLayout(null);
      return;
    }
    
    // Build weights from priorities (with optional override for pending state updates)
    const photoWeights: Record<string, number> = {};
    for (const photo of photosToUse) {
      const effectivePriority = priorityOverride?.photoId === photo.id 
        ? priorityOverride.priority 
        : photo.priority;
      photoWeights[photo.id] = effectivePriority === 1 ? 2.0 : 1.0;
    }
    
    try {
      const layout = generateCollageLayout(photosToUse, settings, { 
        photoWeights,
        randomize,
      });
      setLayout(layout);
    } catch (error) {
      console.error('Layout generation failed:', error);
      toast.error('Failed to generate collage. Try again.');
      // Don't call setLayout(null) - keep button visible for retry
    }
  }, [state.settings, setLayout]);

  // Process smart crops for photos - called directly from event handler
  const processSmartCrops = useCallback(async (photos: PhotoItem[]) => {
    if (photos.length === 0) return;
    
    setIsProcessingSmartCrop(true);
    setSmartCropProgress(0);
    
    let completed = 0;
    const total = photos.length;

    for (const photo of photos) {
      try {
        const result = await getSmartCrop(
          photo.objectUrl,
          photo.blob,
          photo.originalWidth,
          photo.originalHeight,
          (status) => setProcessingStatus(status)
        );
        
        // Only apply smart crop if model is confident enough
        // Low confidence (< 0.6) typically means cartoons, memes, screenshots
        const smartCropToApply = result.skipCrop ? null : result.crop;
        
        console.log(
          `Smart crop for ${photo.filename || photo.id}: confidence=${result.confidence.toFixed(2)}, ` +
          `subjects="${result.subjects}", skipCrop=${result.skipCrop}`
        );
        
        updatePhoto(photo.id, {
          smartCrop: smartCropToApply,
          isProcessing: false,
        });
      } catch (error) {
        console.error('Smart crop failed for photo:', photo.id, error);
        updatePhoto(photo.id, {
          isProcessing: false,
          error: error instanceof Error ? error.message : 'Failed to process',
        });
      }
      
      completed++;
      setSmartCropProgress((completed / total) * 100);
    }
    
    setIsProcessingSmartCrop(false);
    setSmartCropProgress(0);
  }, [updatePhoto]);

  const handleRemovePhoto = useCallback((photoId: string) => {
    removePhoto(photoId);
    if (state.layout) {
      const remainingPhotos = state.photos.filter(p => p.id !== photoId);
      regenerateCollage({ photos: remainingPhotos });
    }
  }, [removePhoto, state.layout, state.photos, regenerateCollage]);

  const handleSaveCrop = useCallback((photoId: string, crop: CropRegion, priority: PhotoPriority) => {
    updatePhoto(photoId, { manualCrop: crop, priority });
    setEditingPhotoId(null);
    if (state.layout) {
      regenerateCollage({ 
        priorityOverride: { photoId, priority },
        cropOverride: { photoId, crop },  // Pass crop immediately to avoid stale state
      });
    }
  }, [updatePhoto, state.layout, regenerateCollage]);

  const handleToggleHero = useCallback((photoId: string) => {
    const photo = state.photos.find(p => p.id === photoId);
    if (!photo) return;
    
    const newPriority: PhotoPriority = photo.priority === 1 ? 3 : 1;
    updatePhoto(photoId, { priority: newPriority });
    
    if (state.layout) {
      regenerateCollage({ priorityOverride: { photoId, priority: newPriority } });
    }
  }, [state.photos, state.layout, updatePhoto, regenerateCollage]);

  const handleCreateCollage = useCallback(() => {
    regenerateCollage({ randomize: state.layout !== null });
  }, [state.layout, regenerateCollage]);

  const handlePhotosAdded = useCallback(async (newPhotos: PhotoItem[]) => {
    const { succeeded } = await addPhotos(newPhotos);
    
    if (succeeded.length === 0) {
      return;
    }

    const wasLayoutEmpty = state.layout === null;

    try {
      await processSmartCrops(succeeded);
    } catch (error) {
      console.error('Smart crop processing failed:', error);
      toast.error('AI processing failed. Please try again.');
    }

    // Always regenerate - first batch without randomization, subsequent with
    regenerateCollage({ randomize: !wasLayoutEmpty });
  }, [addPhotos, processSmartCrops, state.layout, regenerateCollage]);

  const handleUpdateSettings = useCallback((updates: Partial<CollageSettingsType>) => {
    updateSettings(updates);
    if (state.layout && ('gapSize' in updates || 'orientation' in updates)) {
      const newSettings = { ...state.settings, ...updates };
      regenerateCollage({ settings: newSettings });
    }
  }, [updateSettings, state.layout, state.settings, regenerateCollage]);

  const handleSwapPhotos = useCallback((photoId1: string, photoId2: string) => {
    if (state.layout) {
      const newLayout = reflowAfterSwap(
        state.layout,
        state.photos,
        photoId1,
        photoId2,
        state.settings.gapSize
      );
      setLayout(newLayout);
    }
  }, [state.layout, state.photos, state.settings.gapSize, setLayout]);

  const handleExport = useCallback(async () => {
    if (!state.layout) return;

    setIsExporting(true);
    setExportError(null);
    try {
      const blob = await exportCollageAsPng(
        state.photos,
        state.layout,
        state.settings.gapColor,
        2 // 2x scale for higher resolution
      );
      
      const timestamp = new Date().toISOString().split('T')[0];
      await shareOrDownload(blob, `collage-${timestamp}.png`);
    } catch (error) {
      console.error('Export failed:', error);
      setExportError('Failed to export collage. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [state.photos, state.layout, state.settings.gapColor]);

  // Show loading state while initializing from IndexedDB
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isProcessing = isProcessingSmartCrop || state.photos.some((p) => p.isProcessing);

  const editingPhoto = editingPhotoId 
    ? state.photos.find((p) => p.id === editingPhotoId) 
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Single wrapper constrains ALL content to 512px */}
      <div className="max-w-lg mx-auto w-full">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center justify-between px-4">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Grid3X3 className="h-5 w-5 text-primary" />
            Smart Collage
          </h1>

          {state.photos.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={clearAll}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>
        </header>

        <main className="py-3 space-y-4 px-4">
        {/* Progress bar for smart cropping */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wand2 className="h-4 w-4 animate-pulse-soft text-primary" />
              <span>{processingStatus}</span>
            </div>
            {smartCropProgress > 0 && (
              <Progress value={smartCropProgress} className="h-2" />
            )}
          </div>
        )}

        {/* Upload prompt when no photos */}
        {state.photos.length === 0 && (
          <PhotoUploader 
            onPhotosAdded={handlePhotosAdded}
            hasPhotos={false}
          />
        )}

        {/* Review UI when photos exist */}
        {state.photos.length > 0 && (
          <div className="space-y-4">
            {/* Add more photos button */}
            <div className="flex justify-center">
              <PhotoUploader 
                onPhotosAdded={handlePhotosAdded}
                hasPhotos={true}
              />
            </div>

            {/* Photos grid - shows all photos with processing/error/cropped states */}
            <PhotoGrid
              photos={state.photos}
              onRemove={handleRemovePhoto}
              onPhotoClick={(photoId) => {
                const photo = state.photos.find(p => p.id === photoId);
                if (photo && (photo.smartCrop || photo.manualCrop)) {
                  setEditingPhotoId(photoId);
                }
              }}
              showCropped
              title="Photos"
              hint="tap to adjust crop"
            />

            {/* Settings */}
            <CollageSettings
              settings={state.settings}
              onUpdate={handleUpdateSettings}
            />

            {/* Generate button or Collage preview - always visible when 2+ photos */}
            {state.photos.length >= 2 && (
              <div className="space-y-2 pt-4 border-t border-border">
                {!state.layout ? (
                  // No layout yet - show Generate button
                  <Button 
                    onClick={handleCreateCollage}
                    className="w-full"
                  >
                    <Grid3X3 className="h-4 w-4 mr-2" />
                    Generate Collage
                  </Button>
                ) : (
                  // Layout exists - show collage preview with shuffle/download
                  <>
                    {/* Header row with title, centered hint, and action icons */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
                        Collage
                      </h3>
                      <span className="text-xs text-muted-foreground font-normal italic">
                        — Drag to rearrange • Tap ★ to feature
                      </span>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8" 
                          onClick={handleCreateCollage}
                          title="Shuffle layout"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8" 
                          onClick={handleExport}
                          disabled={isExporting}
                          title="Download PNG"
                        >
                          {isExporting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    
                    {exportError && (
                      <p className="text-sm text-destructive flex items-center gap-1 px-1">
                        <AlertCircle className="h-4 w-4" />
                        {exportError}
                      </p>
                    )}

                    <div className="rounded-xl overflow-hidden border border-border bg-surface p-4">
                      <CollagePreview
                        photos={state.photos}
                        layout={state.layout}
                        gapColor={state.settings.gapColor}
                        onSwapPhotos={handleSwapPhotos}
                        onCellClick={setEditingPhotoId}
                        onToggleHero={handleToggleHero}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          )}
        </main>
      </div>

      {/* Crop Editor - Conditional rendering so component unmounts on close */}
      {editingPhotoId && editingPhoto && (
        <CropEditor
          photo={editingPhoto}
          onClose={() => setEditingPhotoId(null)}
          onSave={handleSaveCrop}
        />
      )}
    </div>
  );
}
