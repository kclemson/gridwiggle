import { useState, useCallback, useRef } from 'react';
import { useCollageState } from '@/hooks/useCollageState';
import { useCollageGeneration } from '@/hooks/useCollageGeneration';
import { useSmartCropProcessing } from '@/hooks/useSmartCropProcessing';
import { useCollageExport } from '@/hooks/useCollageExport';
import { PhotoUploader } from '@/components/PhotoUploader';
import { ThumbnailNavigator } from '@/components/ThumbnailNavigator';
import { PhotoProcessingView } from '@/components/PhotoProcessingView';
import { PhotoStrip } from '@/components/PhotoStrip';
import { CollageSettings } from '@/components/CollageSettings';
import { CropEditor } from '@/components/CropEditor';
import { CollagePreview } from '@/components/CollagePreview';
import { DebugPanel } from '@/components/DebugPanel';
import { Button } from '@/components/ui/button';
import { reflowAfterSwap } from '@/lib/layoutUtils';
import { LayoutInfoPanel } from '@/components/debug';
import { CollageHeader } from '@/components/collage/CollageHeader';
import { SampleGallery } from '@/components/SampleGallery';
import { PhotoItem, CropRegion, CollageSettings as CollageSettingsType, PhotoPriority } from '@/types/collage';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { 
  Loader2,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

export default function Index() {
  // ---- Core state ----
  const processSmartCropsRef = useRef<((photos: PhotoItem[]) => Promise<{ id: string; width: number; height: number }[] | void>) | null>(null);

  const {
    state,
    isLoading,
    addPhotos,
    removePhoto,
    updatePhoto,
    updateSettings,
    setLayout,
    clearAll,
  } = useCollageState({
    onNeedsRecovery: (photos) => {
      queueMicrotask(() => {
        processSmartCropsRef.current?.(photos);
      });
    },
  });

  // ---- Extracted hooks ----
  const {
    isGenerating,
    layoutError,
    setLayoutError,
    softRejection,
    layoutMeta,
    debugLogs,
    lastDurationMs,
    v3Tuning,
    regenerateCollage,
    handleV3TuningChange,
  } = useCollageGeneration({
    photos: state.photos,
    settings: state.settings,
    layout: state.layout,
    setLayout,
  });

  const {
    isProcessingSmartCrop,
    currentlyProcessingId,
    smartCroppingPhotoId,
    processSmartCrops,
    processSmartCropsRef: smartCropRef,
    handleSingleSmartCrop,
    handleUndoSmartCrop,
  } = useSmartCropProcessing({
    photos: state.photos,
    layout: state.layout,
    updatePhoto,
    regenerateCollage,
  });

  // Wire recovery ref to smart crop hook's ref
  processSmartCropsRef.current = smartCropRef.current;

  const {
    isExporting,
    exportError,
    handleExport,
  } = useCollageExport({
    photos: state.photos,
    layout: state.layout,
    settings: state.settings,
  });

  // ---- UI state ----
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ref to access latest photos (for patching dimensions in handlePhotosAdded)
  const photosRef = useRef<PhotoItem[]>(state.photos);
  photosRef.current = state.photos;

  // ---- Handlers ----
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
    if (priority === 1 && state.settings.shape !== 'auto') {
      updateSettings({ shape: 'auto' });
    }
    if (state.layout) {
      regenerateCollage({
        priorityOverride: { photoId, priority },
        cropOverride: { photoId, crop },
        settings: priority === 1 ? { ...state.settings, shape: 'auto' } : undefined,
      });
    }
  }, [updatePhoto, state.layout, state.settings, updateSettings, regenerateCollage]);

  const handleToggleHero = useCallback((photoId: string) => {
    const photo = state.photos.find(p => p.id === photoId);
    if (!photo) return;
    const newPriority: PhotoPriority = photo.priority === 1 ? 3 : 1;
    updatePhoto(photoId, { priority: newPriority });
    if (newPriority === 1) {
      if (state.settings.shape !== 'auto') {
        updateSettings({ shape: 'auto' });
      }
      if (state.layout) {
        regenerateCollage({
          priorityOverride: { photoId, priority: newPriority },
          settings: { ...state.settings, shape: 'auto' },
          randomize: true,
        });
      }
    }
  }, [state.photos, state.layout, state.settings, updatePhoto, updateSettings, regenerateCollage]);

  const handleCreateCollage = useCallback(() => {
    regenerateCollage({ randomize: state.layout !== null });
  }, [state.layout, regenerateCollage]);

  const handlePhotosAdded = useCallback(async (newPhotos: PhotoItem[]) => {
    const { succeeded } = await addPhotos(newPhotos);
    if (succeeded.length === 0) return;

    const wasLayoutEmpty = state.layout === null;

    let processedDims: { id: string; width: number; height: number }[] = [];
    try {
      processedDims = await processSmartCrops(succeeded);
    } catch (error) {
      console.error('Smart crop processing failed:', error);
    }

    const dimMap = new Map(processedDims.map(d => [d.id, d]));
    const patchedPhotos = photosRef.current.map(p => {
      const dims = dimMap.get(p.id);
      return dims ? { ...p, originalWidth: dims.width, originalHeight: dims.height } : p;
    });

    regenerateCollage({ photos: patchedPhotos, randomize: !wasLayoutEmpty });
  }, [addPhotos, processSmartCrops, state.layout, regenerateCollage]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const photos: PhotoItem[] = Array.from(files).map((file) => {
      const objectUrl = URL.createObjectURL(file);
      return {
        id: crypto.randomUUID(),
        filename: file.name,
        objectUrl,
        blob: file,
        originalWidth: 0,
        originalHeight: 0,
        smartCrop: null,
        manualCrop: null,
        isProcessing: true,
        error: null,
        priority: 3,
        smartCropAttempted: false,
        previewUrl: objectUrl,
        previewBlob: file,
      };
    });

    handlePhotosAdded(photos);
    e.target.value = '';
  }, [handlePhotosAdded]);

  const handleUpdateSettings = useCallback((updates: Partial<CollageSettingsType>) => {
    updateSettings(updates);
    setLayoutError(null);
    if (state.layout && ('gapSize' in updates || 'shape' in updates)) {
      const newSettings = { ...state.settings, ...updates };
      regenerateCollage({ settings: newSettings });
    }
  }, [updateSettings, state.layout, state.settings, regenerateCollage, setLayoutError]);

  const handleSwapPhotos = useCallback((photoId1: string, photoId2: string) => {
    if (!state.layout) return;
    const normalizedGap = (state.settings.gapSize / 100) * 0.04;
    const gapPx = normalizedGap * state.layout.width;
    const newLayout = reflowAfterSwap(
      state.layout,
      state.photos,
      photoId1,
      photoId2,
      gapPx
    );
    setLayout(newLayout);
  }, [state.layout, state.photos, state.settings.gapSize, setLayout]);

  const isProcessing = isProcessingSmartCrop || state.photos.some((p) => p.isProcessing);

  const editingPhoto = editingPhotoId
    ? state.photos.find((p) => p.id === editingPhotoId)
    : null;

  // ---- Loading ----
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ---- Render ----
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto w-full">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center justify-between px-4">
            <h1 className="text-lg font-medium tracking-wide">
              <span className="text-muted-foreground">grid</span>
              <span className="text-primary">wiggle</span>
            </h1>
            <Link to="/help">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground">
                <HelpCircle className="h-4 w-4" />
                <span className="text-xs">Help</span>
              </Button>
            </Link>
          </div>
        </header>

        {/* Hidden file input for Add Photos button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />

        <main className="py-3 space-y-4 px-4">
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
            {/* Photo section - conditional based on processing state */}
            {isProcessing ? (
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
                  Photos
                  <span className="mx-2 text-muted-foreground/50">·</span>
                  <Loader2 className="inline h-3 w-3 animate-spin text-muted-foreground" />
                  <span className="ml-1.5 text-emerald-600 normal-case tracking-normal">
                    {state.photos.filter(p => !p.isProcessing && !p.error).length} of {state.photos.length} ready
                  </span>
                  {state.photos.filter(p => p.smartCrop !== null).length > 0 && (
                    <>
                      <span className="mx-2 text-muted-foreground/50">·</span>
                      <span className="text-primary/80 normal-case tracking-normal">
                        {state.photos.filter(p => p.smartCrop !== null).length} auto-cropped
                      </span>
                    </>
                  )}
                </h3>
                <PhotoProcessingView
                  photos={state.photos}
                  currentlyProcessingId={currentlyProcessingId}
                />
              </div>
            ) : (
              <PhotoStrip
                photos={state.photos}
                autoCroppedCount={state.photos.filter(p => p.smartCrop !== null).length}
                onViewAll={() => setNavigatorOpen(true)}
                onAddPhotos={() => fileInputRef.current?.click()}
                onClearAll={clearAll}
                onGenerate={handleCreateCollage}
                showGenerateButton={!state.layout}
                isGenerating={isGenerating}
              />
            )}

            {/* Generate button or Collage preview - always visible when 2+ photos */}
            {state.photos.length >= 2 && (
              <div className="relative">
                <div className="space-y-2 pt-4 border-t border-border">
                {state.layout ? (
                  <>
                    <CollageHeader
                      onShuffle={handleCreateCollage}
                      onDownload={handleExport}
                      isShuffling={isGenerating}
                      isDownloading={isExporting}
                    />

                    {exportError && (
                      <p className="text-sm text-destructive flex items-center gap-1 px-1">
                        <AlertCircle className="h-4 w-4" />
                        {exportError}
                      </p>
                    )}

                    <div className={cn(
                      "relative overflow-hidden transition-opacity duration-150",
                      isGenerating && "opacity-60"
                    )}>
                      <CollagePreview
                        photos={state.photos}
                        layout={state.layout}
                        gapColor={state.settings.gapColor}
                        onSwapPhotos={handleSwapPhotos}
                        onCellClick={setEditingPhotoId}
                        onToggleHero={handleToggleHero}
                      />

                      {isGenerating && (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      )}
                    </div>

                    {/* Dev-only layout info panel */}
                    {import.meta.env.DEV && (layoutMeta || softRejection) && (
                      <LayoutInfoPanel
                        meta={layoutMeta ?? undefined}
                        reason={softRejection?.reason}
                        details={softRejection?.details}
                      />
                    )}

                    <CollageSettings
                      settings={state.settings}
                      onUpdate={handleUpdateSettings}
                    />
                  </>
                ) : null}
                </div>

                {/* Dev-only Debug Panel */}
                {import.meta.env.DEV && (
                  <div
                    className="absolute top-0 hidden xl:block"
                    style={{ right: 'calc(100% + 24px)', width: '700px' }}
                  >
                <DebugPanel
                  logs={debugLogs}
                  durationMs={lastDurationMs}
                  photos={state.photos}
                />
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </main>
      </div>

      {state.photos.length === 0 && <SampleGallery />}

      <footer className="py-4 text-center">
        <a
          href="https://kcloadletter.com"
          target="_blank"
          rel="noopener"
          className="text-sm text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          made by kcloadletter.com
        </a>
      </footer>

      {/* Crop Editor - Conditional rendering so component unmounts on close */}
      {editingPhotoId && editingPhoto && (
        <CropEditor
          photo={editingPhoto}
          onClose={() => setEditingPhotoId(null)}
          onSave={handleSaveCrop}
          onDelete={(photoId) => {
            handleRemovePhoto(photoId);
            setEditingPhotoId(null);
          }}
        />
      )}

      {/* Thumbnail Navigator - On-demand overlay */}
      {navigatorOpen && (
        <ThumbnailNavigator
          photos={state.photos}
          onSelect={(photoId) => {
            setEditingPhotoId(photoId);
          }}
          onClose={() => setNavigatorOpen(false)}
          onSmartCrop={handleSingleSmartCrop}
          onUndoSmartCrop={handleUndoSmartCrop}
          smartCroppingPhotoId={smartCroppingPhotoId}
        />
      )}
    </div>
  );
}
