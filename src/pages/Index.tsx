import { useState, useCallback, useRef, useEffect } from 'react';
import { useCollageState } from '@/hooks/useCollageState';
import { PhotoUploader } from '@/components/PhotoUploader';
import { PhotoCarousel } from '@/components/PhotoCarousel';
import { ThumbnailNavigator } from '@/components/ThumbnailNavigator';
import { PhotoProcessingView } from '@/components/PhotoProcessingView';
import { CollageSettings } from '@/components/CollageSettings';
import { CropEditor } from '@/components/CropEditor';
import { CollagePreview } from '@/components/CollagePreview';
import { DebugPanel } from '@/components/DebugPanel';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { getSmartCrop } from '@/services/smartCropService';
import { generateLayoutInWorker } from '@/services/layoutGenerationService';
import { reflowAfterSwap } from '@/lib/layoutUtils';
import { getDisplayCrop } from '@/lib/cropUtils';
import { exportCollageAsPng, shareOrDownload } from '@/lib/exportCollage';
import { devLogger, LogEntry } from '@/lib/devLogger';
import { RejectionBadge, SoftRejectionBadge } from '@/components/debug';
import { CollageHeader } from '@/components/collage/CollageHeader';
import { remoteLogger } from '@/lib/remoteLogger';
import { getImageDimensions, createDisplayPreview } from '@/lib/imageUtils';
import { PhotoItem, CropRegion, CollageSettings as CollageSettingsType, PhotoPriority } from '@/types/collage';
import { V3Tuning, DEFAULT_V3_TUNING, PhotoDimension } from '@/lib/v3/types';
import { 
  saveCapture, 
  extractReasonFrequencies,
  getLastRejection,
} from '@/lib/v3CaptureStorage';
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
  // Ref to processSmartCrops for recovery callback (avoids stale closure)
  const processSmartCropsRef = useRef<((photos: PhotoItem[]) => Promise<void>) | null>(null);

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
      // Defer to next tick so the component has mounted and ref is assigned
      queueMicrotask(() => {
        processSmartCropsRef.current?.(photos);
      });
    },
  });

  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [smartCropProgress, setSmartCropProgress] = useState(0);
  const [isProcessingSmartCrop, setIsProcessingSmartCrop] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('Detecting faces and subjects...');
  const [debugLogs, setDebugLogs] = useState<LogEntry[]>([]);
  const [lastDurationMs, setLastDurationMs] = useState<number | undefined>(undefined);
  const [v3Tuning, setV3Tuning] = useState<V3Tuning>(DEFAULT_V3_TUNING);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [rejectedLayout, setRejectedLayout] = useState<{
    cells: { photoId: string; x: number; y: number; width: number; height: number }[];
    canvasWidth: number;
    canvasHeight: number;
    reason: string;
    details: Record<string, unknown>;
  } | null>(null);
  const [softRejection, setSoftRejection] = useState<{
    reason: string;
    details: Record<string, unknown>;
  } | null>(null);
  
  // Carousel and navigator state
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [currentlyProcessingId, setCurrentlyProcessingId] = useState<string | null>(null);
  
  // Collapsible carousel state - default collapsed, user can expand
  const [carouselOpen, setCarouselOpen] = useState(() => {
    const saved = localStorage.getItem('carouselOpen');
    return saved !== null ? saved === 'true' : false;
  });

  // Derived: count of photos that are fully loaded (have dimensions)
  const readyPhotos = state.photos.filter(p => p.originalWidth > 0 && p.originalHeight > 0).length;
  
  // Detect stale rejection by comparing photo counts
  // If rejection says "20 photos" but we only have 5 ready, it's from a previous session
  const rejectedPhotoCount = rejectedLayout
    ? (rejectedLayout.details as any)?.photoCount ?? rejectedLayout.cells.length
    : 0;
  const isRejectionStale = rejectedLayout && Math.abs(rejectedPhotoCount - readyPhotos) > 1;
  
  // Ref to access latest photos (avoids stale closure in async callbacks)
  const photosRef = useRef<PhotoItem[]>(state.photos);
  photosRef.current = state.photos;
  
  // Request ID for stale response detection (worker-based generation)
  const latestRequestIdRef = useRef(0);

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
  // Now async with Web Worker for non-blocking UI
  const regenerateCollage = useCallback(async (options: RegenerateOptions = {}) => {
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
      photosToUse = photosToUse.map(p => 
        p.id === cropOverride.photoId 
          ? { ...p, manualCrop: cropOverride.crop }
          : p
      );
    }
    
    // Filter out photos that aren't ready (missing dimensions from still-processing uploads)
    photosToUse = photosToUse.filter(p => 
      p.originalWidth > 0 && p.originalHeight > 0
    );
    
    // Need at least 2 photos for a collage
    if (photosToUse.length < 2) {
      setLayout(null);
      return;
    }
    
    // Build PhotoDimension[] for worker (lightweight - no blobs)
    const dimensions: PhotoDimension[] = photosToUse.map(photo => {
      const crop = getDisplayCrop(photo);
      const width = crop ? crop.width : photo.originalWidth;
      const height = crop ? crop.height : photo.originalHeight;
      const effectivePriority = priorityOverride?.photoId === photo.id 
        ? priorityOverride.priority 
        : photo.priority;
      return {
        id: photo.id,
        aspectRatio: width / height,
        weight: effectivePriority === 1 ? 2.0 : 1.0,
      };
    });
    
    // Map slider (0-100) directly to normalized gap (0 to 0.04)
    const normalizedGap = (settings.gapSize / 100) * 0.04;
    
    // Track this request to detect stale responses
    const requestId = ++latestRequestIdRef.current;
    
    setIsGenerating(true);
    devLogger.clear();
    remoteLogger.info('layout', 'Regenerating collage', { photoCount: photosToUse.length });
    
    try {
      // Always use V3 worker for layout generation
      const result = await generateLayoutInWorker({
        dimensions,
        normalizedGap,
        tuning: tuningOverride,
        randomize,
      });
      
      // Check for stale response (user clicked again while we were working)
      if (requestId !== latestRequestIdRef.current) {
        return; // Discard stale result
      }
      
      const layout = result.layout;
      
      // Populate debug logs from worker
      if (result.logs) {
        for (const log of result.logs) {
          devLogger.log(log.category, log.label, log.data);
        }
      }
      
      const currentLogs = devLogger.getLogs();
      setDebugLogs(currentLogs);
      setLastDurationMs(result.durationMs);
      
      // Save capture directly (dev only)
      if (import.meta.env.DEV) {
        const heroPhoto = photosToUse.find(p => {
          const dim = dimensions.find(d => d.id === p.id);
          return dim?.weight === 2.0;
        });
        const avgAR = dimensions.length > 0 
          ? dimensions.reduce((s, d) => s + d.aspectRatio, 0) / dimensions.length 
          : 0;
        const landscapeCount = dimensions.filter(d => d.aspectRatio > 1).length;
        const orientationBias = dimensions.length > 0 
          ? (landscapeCount / dimensions.length) * 2 - 1 
          : 0;
        
        const logEntries = result.logs || currentLogs;
        const { rejectReasons, feasibilityReasons, rejectCount, feasibilityCount } = 
          extractReasonFrequencies(logEntries);
        const lastRejection = getLastRejection(logEntries);
        
        saveCapture({
          photoCount: photosToUse.length,
          heroCount: heroPhoto ? 1 : 0,
          heroAR: heroPhoto 
            ? dimensions.find(d => d.id === heroPhoto.id)?.aspectRatio ?? null 
            : null,
          avgAR,
          orientationBias,
          seed: requestId,
          success: layout !== null,
          canvasWidth: layout?.width ?? null,
          canvasHeight: layout?.height ?? null,
          canvasAR: layout 
            ? layout.width / layout.height 
            : null,
          cellCount: layout?.cells.length ?? null,
          logCount: logEntries.length,
          rejectCount,
          rejectReasons,
          feasibilityCount,
          feasibilityReasons,
          durationMs: result.durationMs ?? 0,
          failureReason: layout ? null : lastRejection?.reason ?? 'unknown',
          failureDetails: layout ? null : lastRejection?.details ?? null,
          // Rejected layout geometry not captured in production
          rejectedCells: null,
          rejectedCanvasWidth: null,
          rejectedCanvasHeight: null,
          capturedAt: new Date().toISOString(),
        });
      }
      
      if (layout) {
        setLayout(layout);
        setLayoutError(null);
        setRejectedLayout(null);
        setSoftRejection(result.softRejection ?? null);
        remoteLogger.info('layout', 'Layout generated', { 
          cells: layout.cells.length,
          durationMs: result.durationMs,
          usedWorker: result.usedWorker ?? false,
        });
      } else {
        remoteLogger.error('layout', 'Layout generation failed', {
          durationMs: result.durationMs,
          usedWorker: result.usedWorker ?? false,
          reason: result.failure?.reason ?? 'unknown',
        });
        
        // Capture rejected layout for visualization
        if (result.rejectedLayout) {
          // Scale from normalized (0-1) to pixel coordinates (base 1000)
          const SCALE = 1000;
          setRejectedLayout({
            cells: result.rejectedLayout.cells.map(c => ({
              photoId: c.photoId,
              x: Math.round(c.x * SCALE),
              y: Math.round(c.y * SCALE),
              width: Math.round(c.width * SCALE),
              height: Math.round(c.height * SCALE),
            })),
            canvasWidth: Math.round(result.rejectedLayout.canvasWidth * SCALE),
            canvasHeight: Math.round(result.rejectedLayout.canvasHeight * SCALE),
            reason: result.rejectedLayout.reason,
            details: result.rejectedLayout.details,
          });
          // Clear layout so rejection visualization renders
          setLayout(null);
          setLayoutError("Layout rejected. Try shuffling or adjusting photos.");
        } else {
          setRejectedLayout(null);
          if (state.layout) {
            // No geometry to show - keep old layout with error message
            setLayoutError("Couldn't generate a new layout. Try shuffling or adjusting photos.");
          } else {
            setLayout(null);
            setLayoutError("Couldn't generate a layout with these photos.");
          }
        }
      }
    } catch (error) {
      // Check for stale response
      if (requestId !== latestRequestIdRef.current) return;
      
      console.error('Layout generation failed:', error);
      remoteLogger.error('layout', 'Generation failed', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      if (!state.layout) {
        setLayoutError("Something went wrong. Please try again.");
      }
    } finally {
      // Only clear generating if this is still the latest request
      if (requestId === latestRequestIdRef.current) {
        setIsGenerating(false);
      }
    }
  }, [state.settings, state.layout, setLayout, v3Tuning]);

  // Helper to give browser time to garbage collect between heavy operations
  // Critical for iOS Safari which leaks memory without explicit GC pauses
  const gcDelay = () => new Promise(resolve => setTimeout(resolve, 100));

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
          isProcessing: false,
        });
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
  }, [updatePhoto]);
  
  // Assign ref for recovery callback (avoids stale closure in useCollageState callback)
  processSmartCropsRef.current = processSmartCrops;

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
        randomize: true,  // Shuffle for variety - avoids deterministic failures
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
    
    remoteLogger.info('upload', 'Photos added', { count: succeeded.length });

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

  const handleExport = useCallback(async () => {
    if (!state.layout) return;
    
    setIsExporting(true);
    setExportError(null);
    remoteLogger.info('export', 'Starting export', { photoCount: state.photos.length });
    
    try {
      const blob = await exportCollageAsPng(
        state.photos,
        state.layout,
        state.settings.gapColor
      );
      await shareOrDownload(blob, `collage-${Date.now()}.png`);
      remoteLogger.info('export', 'Export complete', { size: blob.size });
    } catch (error) {
      console.error('Export failed:', error);
      remoteLogger.error('export', 'Export failed', { 
        error: error instanceof Error ? error.message : String(error),
      });
      setExportError('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [state.layout, state.photos, state.settings]);

  const handleSwapPhotos = useCallback((photoId1: string, photoId2: string) => {
    if (!state.layout) return;
    
    // Use gap size from settings - convert slider (0-100) to normalized gap (0 to 0.04)
    // Then scale to layout width for absolute pixels
    const normalizedGap = (state.settings.gapSize / 100) * 0.04;
    const gapPx = normalizedGap * state.layout.width;
    
    // Reflow-aware swap: recalculates row heights based on new photo placements
    const newLayout = reflowAfterSwap(
      state.layout,
      state.photos,
      photoId1,
      photoId2,
      gapPx
    );
    // Update layout with new cells and dimensions
    setLayout(newLayout);
  }, [state.layout, state.photos, state.settings.gapSize, setLayout]);

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
              <div className="flex items-center gap-2">
                <PhotoUploader 
                  onPhotosAdded={handlePhotosAdded}
                  hasPhotos={true}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={clearAll}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              </div>
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
            {/* Collapsible Photo carousel with progress dots in header */}
            <Collapsible open={carouselOpen} onOpenChange={handleCarouselOpenChange}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center justify-between w-full px-1 py-2 text-left hover:bg-muted/50 rounded-lg transition-colors">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {isProcessing ? (
                      <>
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
                      </>
                    ) : (
                      <>
                        Photos ({state.photos.length})
                        {state.photos.filter(p => p.smartCrop !== null).length > 0 && (
                          <>
                            <span className="mx-2 text-muted-foreground/50 normal-case">·</span>
                            <span className="text-primary/80 normal-case font-normal tracking-normal">
                              {state.photos.filter(p => p.smartCrop !== null).length} auto-cropped
                            </span>
                          </>
                        )}
                      </>
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
                    onRefresh={handleCreateCollage}
                    isRefreshing={isGenerating}
                  />
                )}
              </CollapsibleContent>
            </Collapsible>


            {/* Generate button or Collage preview - always visible when 2+ photos */}
            {state.photos.length >= 2 && (
              <div className="relative">
                <div className="space-y-2 pt-4 border-t border-border">
                {state.layout ? (
                  // SUCCESS: Valid layout - show collage preview with shuffle/download
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
                      isGenerating && "opacity-60",
                      // Dev-only amber ring for soft rejections
                      import.meta.env.DEV && softRejection && "ring-2 ring-amber-500 rounded-lg"
                    )}>
                      <CollagePreview
                        photos={state.photos}
                        layout={state.layout}
                        gapColor={state.settings.gapColor}
                        onSwapPhotos={handleSwapPhotos}
                        onCellClick={setEditingPhotoId}
                        onToggleHero={handleToggleHero}
                      />
                      
                      {/* Generating overlay - spinner centered on canvas */}
                      {isGenerating && (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      )}
                    </div>
                    
                    {/* Dev-only soft rejection badge */}
                    {import.meta.env.DEV && softRejection && (
                      <SoftRejectionBadge 
                        reason={softRejection.reason} 
                        details={softRejection.details} 
                      />
                    )}
                    
                    <CollageSettings
                      settings={state.settings}
                      onUpdate={handleUpdateSettings}
                    />
                  </>
                ) : rejectedLayout && readyPhotos >= 2 && !isRejectionStale ? (
                  // REJECTION: Show failed layout with diagnostics
                  <>
                    <CollageHeader
                      onShuffle={() => {
                        setLayoutError(null);
                        setRejectedLayout(null);
                        regenerateCollage({ randomize: true });
                      }}
                      isShuffling={isGenerating}
                      showDownload={false}
                    />
                    
                    <div className="relative">
                      <div className="ring-4 ring-destructive rounded-lg overflow-hidden opacity-70">
                        <CollagePreview
                          photos={state.photos}
                          layout={{
                            width: rejectedLayout.canvasWidth,
                            height: rejectedLayout.canvasHeight,
                            cells: rejectedLayout.cells,
                          }}
                          gapColor={state.settings.gapColor}
                          onSwapPhotos={() => {}}
                        />
                      </div>
                      <RejectionBadge 
                        reason={rejectedLayout.reason} 
                        details={rejectedLayout.details} 
                      />
                      
                      {/* Generating overlay */}
                      {isGenerating && (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      )}
                    </div>
                    
                    <CollageSettings
                      settings={state.settings}
                      onUpdate={handleUpdateSettings}
                    />
                  </>
                ) : layoutError && readyPhotos >= 2 && !isRejectionStale ? (
                  // FALLBACK: No geometry available - text error only
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
                ) : null}
                </div>
                
                {/* Dev-only Debug Panel - positioned next to collage */}
                {import.meta.env.DEV && (
                  <div 
                    className="absolute top-0 hidden xl:block"
                    style={{ right: 'calc(100% + 24px)', width: '700px' }}
                  >
                    <DebugPanel 
                      logs={debugLogs}
                      durationMs={lastDurationMs}
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
            // Open crop editor directly - View All is for managing crops
            setEditingPhotoId(photoId);
            setNavigatorOpen(false);
          }}
          onClose={() => setNavigatorOpen(false)}
        />
      )}
    </div>
  );
}
