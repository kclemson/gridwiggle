import { useState, useCallback, useRef, useEffect } from 'react';
import { useCollageState } from '@/hooks/useCollageState';
import { PhotoUploader } from '@/components/PhotoUploader';
import { PhotoCarousel } from '@/components/PhotoCarousel';
import { ThumbnailNavigator } from '@/components/ThumbnailNavigator';
import { PhotoProcessingView } from '@/components/PhotoProcessingView';
import { CollageSettings } from '@/components/CollageSettings';
import { CropEditor } from '@/components/CropEditor';
import { CollagePreview } from '@/components/CollagePreview';
import { DebugPanel, AlgorithmVersion } from '@/components/DebugPanel';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { getSmartCrop } from '@/services/smartCropService';
import { generateCollageLayout, reflowAfterSwap } from '@/lib/collageLayout';

import { generateCollageLayoutV3 } from '@/lib/v3';
import { exportCollageAsPng, shareOrDownload } from '@/lib/exportCollage';
import { devLogger, LogEntry } from '@/lib/devLogger';
import { getImageDimensions, createDisplayPreview } from '@/lib/imageUtils';
import { PhotoItem, CropRegion, CollageSettings as CollageSettingsType, PhotoPriority, DEFAULT_TUNING } from '@/types/collage';
import { V3Tuning, DEFAULT_V3_TUNING } from '@/lib/v3/types';
import { cn } from '@/lib/utils';
import { 
  Wand2, 
  Grid3X3, 
  Download, 
  Loader2,
  Trash2,
  RefreshCw,
  AlertCircle,
  ChevronDown
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
  const [debugLogs, setDebugLogs] = useState<LogEntry[]>([]);
  const [v3Tuning, setV3Tuning] = useState<V3Tuning>(DEFAULT_V3_TUNING);
  const [algorithmVersion, setAlgorithmVersion] = useState<AlgorithmVersion>('v3');
  const [layoutError, setLayoutError] = useState<string | null>(null);
  
  // Carousel and navigator state
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [currentlyProcessingId, setCurrentlyProcessingId] = useState<string | null>(null);
  
  // Collapsible carousel state - default collapsed, user can expand
  const [carouselOpen, setCarouselOpen] = useState(() => {
    const saved = localStorage.getItem('carouselOpen');
    return saved !== null ? saved === 'true' : false;
  });

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
    /** V3 tuning parameters (for immediate changes) */
    v3Tuning?: V3Tuning;
  }

  // Centralized collage regeneration - all triggers use this
  const regenerateCollage = useCallback((options: RegenerateOptions = {}) => {
    const {
      photos = photosRef.current,
      settings = state.settings,
      priorityOverride,
      cropOverride,
      randomize = false,
      v3Tuning: tuningOverride = v3Tuning,
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
      devLogger.clear();
      
      // V3 is the production algorithm
      // In dev mode, algorithmVersion toggle in DebugPanel can override
      const useV3 = !import.meta.env.DEV || algorithmVersion === 'v3';

      const layout = useV3
        ? generateCollageLayoutV3(photosToUse, settings, { 
            photoWeights,
            randomize,
            tuning: tuningOverride,
          })
        : generateCollageLayout(photosToUse, settings, { 
            photoWeights,
            randomize,
            tuning: DEFAULT_TUNING,
          });
      
      setDebugLogs(devLogger.getLogs());
      
      if (layout) {
        setLayout(layout);
        setLayoutError(null);  // Clear any previous error
      } else if (state.layout) {
        // Generation failed but we have a previous layout - keep it, show error
        setLayoutError("Couldn't generate a new layout. Try shuffling or adjusting photos.");
      } else {
        // No previous layout - nothing to preserve
        setLayout(null);
        setLayoutError("Couldn't generate a layout with these photos.");
      }
    } catch (error) {
      console.error('Layout generation failed:', error);
      if (!state.layout) {
        setLayoutError("Something went wrong. Please try again.");
      }
    }
  }, [state.settings, state.layout, setLayout, v3Tuning, algorithmVersion]);

  // Process smart crops for photos - called directly from event handler
  // Also loads dimensions + creates display previews (moved here for instant UI feedback)
  const processSmartCrops = useCallback(async (photos: PhotoItem[]) => {
    if (photos.length === 0) return;
    
    setIsProcessingSmartCrop(true);
    setSmartCropProgress(0);
    
    let completed = 0;
    const total = photos.length;

    for (const photo of photos) {
      // Track currently processing photo for the ProcessingView
      setCurrentlyProcessingId(photo.id);
      
      try {
        // Get fresh photo data from state (dimensions may have been updated)
        const currentPhoto = photosRef.current.find(p => p.id === photo.id);
        let width = currentPhoto?.originalWidth || photo.originalWidth;
        let height = currentPhoto?.originalHeight || photo.originalHeight;
        
        // Load dimensions if not yet known (moved from PhotoUploader for instant feedback)
        if (width === 0 || height === 0) {
          const dimensions = await getImageDimensions(photo.objectUrl);
          width = dimensions.width;
          height = dimensions.height;
          
          // Create display preview
          const preview = await createDisplayPreview(photo.blob, 1200);
          
          updatePhoto(photo.id, {
            originalWidth: width,
            originalHeight: height,
            previewUrl: preview.url,
            previewBlob: preview.blob,
          });
        }
        
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
    
    setCurrentlyProcessingId(null);
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
    
    // Reset shape to auto when adding a hero
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
    
    // Reset shape to auto when adding a hero
    if (newPriority === 1 && state.settings.shape !== 'auto') {
      updateSettings({ shape: 'auto' });
    }
    
    if (state.layout) {
      regenerateCollage({ 
        priorityOverride: { photoId, priority: newPriority },
        settings: newPriority === 1 ? { ...state.settings, shape: 'auto' } : undefined,
      });
    }
  }, [state.photos, state.layout, state.settings, updatePhoto, updateSettings, regenerateCollage]);

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
      // Silent - photos still work, just without smart crop
    } finally {
      // Always generate collage, even if smart crop failed
      regenerateCollage({ randomize: !wasLayoutEmpty });
    }
  }, [addPhotos, processSmartCrops, state.layout, regenerateCollage]);

  const handleUpdateSettings = useCallback((updates: Partial<CollageSettingsType>) => {
    updateSettings(updates);
    setLayoutError(null);  // Clear error when user adjusts settings
    if (state.layout && ('gapSize' in updates || 'shape' in updates)) {
      const newSettings = { ...state.settings, ...updates };
      regenerateCollage({ settings: newSettings });
    }
  }, [updateSettings, state.layout, state.settings, regenerateCollage]);

  const handleV3TuningChange = useCallback((key: keyof V3Tuning, value: number) => {
    const newTuning = { ...v3Tuning, [key]: value };
    setV3Tuning(newTuning);
    if (state.layout) {
      regenerateCollage({ v3Tuning: newTuning });
    }
  }, [v3Tuning, state.layout, regenerateCollage]);

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

  const isProcessing = isProcessingSmartCrop || state.photos.some((p) => p.isProcessing);

  
  // Persist carousel open state
  const handleCarouselOpenChange = (open: boolean) => {
    setCarouselOpen(open);
    localStorage.setItem('carouselOpen', String(open));
  };

  const editingPhoto = editingPhotoId 
    ? state.photos.find((p) => p.id === editingPhotoId) 
    : null;

  // Show loading state while initializing from IndexedDB
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Single wrapper constrains ALL content to 512px */}
      <div className="max-w-lg mx-auto w-full">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center justify-between px-4">
            <h1 className="text-lg font-medium tracking-wide">
              <span className="text-muted-foreground">grid</span>
              <span className="text-primary">wiggle</span>
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

            {/* Collapsible Photo carousel with progress dots in header */}
            <Collapsible open={carouselOpen} onOpenChange={handleCarouselOpenChange}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center justify-between w-full px-1 py-2 text-left hover:bg-muted/50 rounded-lg transition-colors">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {isProcessing ? (
                      <>
                        Photos
                        <span className="mx-2 text-muted-foreground/50">·</span>
                        <span className="text-emerald-600 normal-case tracking-normal">
                          {state.photos.filter(p => !p.isProcessing && !p.error).length} of {state.photos.length} ready
                        </span>
                      </>
                    ) : (
                      `Photos (${state.photos.length})`
                    )}
                  </h3>
                  
                  <ChevronDown 
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-transform duration-200",
                      carouselOpen && "rotate-180"
                    )} 
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
                {/* Show processing view when expanded and processing */}
                {isProcessing ? (
                  <PhotoProcessingView
                    photos={state.photos}
                    currentlyProcessingId={currentlyProcessingId}
                  />
                ) : (
                  <PhotoCarousel
                    photos={state.photos}
                    currentIndex={carouselIndex}
                    onIndexChange={setCarouselIndex}
                    onPhotoClick={(photoId) => {
                      const photo = state.photos.find(p => p.id === photoId);
                      if (photo && !photo.isProcessing) {
                        setEditingPhotoId(photoId);
                      }
                    }}
                    onRemove={handleRemovePhoto}
                    onToggleHero={handleToggleHero}
                    onViewAll={() => setNavigatorOpen(true)}
                  />
                )}
              </CollapsibleContent>
            </Collapsible>


            {/* Generate button or Collage preview - always visible when 2+ photos */}
            {state.photos.length >= 2 && (
              <div className="relative">
                <div className="space-y-2 pt-4 border-t border-border">
                {!state.layout ? (
                  // No layout yet - show error prompt if generation failed
                  layoutError ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <AlertCircle className="h-5 w-5" />
                        <span className="text-sm">{layoutError}</span>
                      </div>
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={handleCreateCollage}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Try Again
                      </Button>
                    </div>
                  ) : null
                ) : (
                  // Layout exists - show collage preview with shuffle/download
                  <>
                    {/* Header row with title and action icons */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
                        Collage
                      </h3>
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

                    <div className="relative overflow-hidden">
                      <CollagePreview
                        photos={state.photos}
                        layout={state.layout}
                        gapColor={state.settings.gapColor}
                        onSwapPhotos={handleSwapPhotos}
                        onCellClick={setEditingPhotoId}
                        onToggleHero={handleToggleHero}
                      />
                      
                      {/* Error overlay - shown when layout generation fails */}
                      {layoutError && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl z-20">
                          <p className="text-sm text-muted-foreground text-center mb-3 px-4">
                            {layoutError}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setLayoutError(null);
                              regenerateCollage({ randomize: true });
                            }}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Try Again
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {/* Configure - only shown when collage exists */}
                    <CollageSettings
                      settings={state.settings}
                      onUpdate={handleUpdateSettings}
                    />
                  </>
                )}
                </div>
                
                {/* Dev-only Debug Panel - positioned next to collage */}
                {import.meta.env.DEV && (
                  <div 
                    className="absolute top-0 hidden xl:block"
                    style={{ right: 'calc(100% + 24px)', width: '700px' }}
                  >
                    <DebugPanel 
                      logs={debugLogs} 
                      v3Tuning={v3Tuning} 
                      onV3TuningChange={handleV3TuningChange}
                      algorithmVersion={algorithmVersion}
                      onAlgorithmVersionChange={setAlgorithmVersion}
                    />
                  </div>
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
          currentIndex={carouselIndex}
          onSelect={(photoId) => {
            const idx = state.photos.findIndex(p => p.id === photoId);
            if (idx >= 0) {
              setCarouselIndex(idx);
            }
            setNavigatorOpen(false);
          }}
          onClose={() => setNavigatorOpen(false)}
        />
      )}
    </div>
  );
}
