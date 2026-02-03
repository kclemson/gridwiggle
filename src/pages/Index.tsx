import { useState, useCallback } from 'react';
import { useCollageState } from '@/hooks/useCollageState';
import { PhotoUploader } from '@/components/PhotoUploader';
import { PhotoGrid } from '@/components/PhotoGrid';
import { CollageSettings } from '@/components/CollageSettings';
import { CropEditor } from '@/components/CropEditor';
import { CollagePreview } from '@/components/CollagePreview';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { getSmartCrop } from '@/services/smartCropService';
import { generateCollageLayout, swapPhotosInLayout } from '@/lib/collageLayout';
import { exportCollageAsPng, downloadBlob } from '@/lib/exportCollage';
import { PhotoItem, CropRegion } from '@/types/collage';
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
          photo.originalDataUrl,
          photo.originalWidth,
          photo.originalHeight,
          (status) => setProcessingStatus(status)
        );
        
        updatePhoto(photo.id, {
          smartCrop: result.crop,
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

  const handlePhotosAdded = useCallback((newPhotos: PhotoItem[]) => {
    addPhotos(newPhotos);
    // Process smart crops in event handler, not useEffect
    processSmartCrops(newPhotos);
  }, [addPhotos, processSmartCrops]);

  const handleRemovePhoto = useCallback((photoId: string) => {
    removePhoto(photoId);
  }, [removePhoto]);

  const handleSaveCrop = useCallback((photoId: string, crop: CropRegion) => {
    updatePhoto(photoId, { manualCrop: crop });
    setEditingPhotoId(null);
  }, [updatePhoto]);

  const handleCreateCollage = useCallback(() => {
    const layout = generateCollageLayout(state.photos, state.settings);
    setLayout(layout);
  }, [state.photos, state.settings, setLayout]);

  const handleSwapPhotos = useCallback((photoId1: string, photoId2: string) => {
    if (state.layout) {
      const newLayout = swapPhotosInLayout(state.layout, photoId1, photoId2);
      setLayout(newLayout);
    }
  }, [state.layout, setLayout]);

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
      downloadBlob(blob, `collage-${timestamp}.png`);
    } catch (error) {
      console.error('Export failed:', error);
      setExportError('Failed to export collage. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [state.photos, state.layout, state.settings.gapColor]);

  const handleRegenerateLayout = useCallback(() => {
    const layout = generateCollageLayout(state.photos, state.settings);
    setLayout(layout);
    setExportError(null);
  }, [state.photos, state.settings, setLayout]);

  const photosWithSmartCrop = state.photos.filter((p) => p.smartCrop || p.manualCrop);
  const isProcessing = isProcessingSmartCrop || state.photos.some((p) => p.isProcessing);
  const canCreateCollage = photosWithSmartCrop.length >= 2 && !isProcessing;

  const editingPhoto = editingPhotoId 
    ? state.photos.find((p) => p.id === editingPhotoId) 
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
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

      <main className="container py-3 space-y-4">
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

            {/* Original photos grid */}
            <PhotoGrid
              photos={state.photos}
              onRemove={handleRemovePhoto}
              title="Original Photos"
            />

            {/* Smart cropped photos grid */}
            {photosWithSmartCrop.length > 0 && (
              <PhotoGrid
                photos={photosWithSmartCrop}
                onRemove={handleRemovePhoto}
                onPhotoClick={setEditingPhotoId}
                showCropped
                title="Smart Cropped (tap to adjust)"
              />
            )}

            {/* Settings */}
            <CollageSettings
              settings={state.settings}
              onUpdate={updateSettings}
            />

            {/* Create collage button */}
            <div className="flex justify-center">
              <Button
                size="default"
                className="gap-2"
                disabled={!canCreateCollage}
                onClick={handleCreateCollage}
              >
                <Wand2 className="h-5 w-5" />
                Create Collage
                {isProcessing && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              </Button>
            </div>

            {!canCreateCollage && state.photos.length > 0 && (
              <p className="text-center text-sm text-muted-foreground">
                {isProcessing 
                  ? 'Please wait while AI analyzes your photos...'
                  : 'Add at least 2 photos to create a collage'
                }
              </p>
            )}

            {/* Collage preview - appears below when layout exists */}
            {state.layout && (
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <p className="text-sm text-muted-foreground">
                    Drag photos to rearrange • Tap to adjust crop
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerateLayout}
                      className="gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Regenerate
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleExport}
                      disabled={isExporting}
                      className="gap-2"
                    >
                      {isExporting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      Download PNG
                    </Button>
                  </div>
                </div>
                {exportError && (
                  <p className="text-sm text-destructive flex items-center gap-1">
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
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </main>

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
