import { useState, useCallback, useRef } from 'react';
import { generateLayoutInWorker } from '@/services/layoutGenerationService';
import { getDisplayCrop } from '@/lib/cropUtils';
import { devLogger, LogEntry } from '@/lib/devLogger';
import { sliderToARBounds } from '@/lib/shapeSlider';
import { remoteLogger } from '@/lib/remoteLogger';
import { 
  saveCapture, 
  extractReasonFrequencies,
  getLastRejection,
} from '@/lib/captureStorage';
import { PhotoItem, CropRegion, CollageSettings, CollageLayout, PhotoPriority } from '@/types/collage';
import { V3Tuning, DEFAULT_V3_TUNING, PhotoDimension } from '@/lib/v3/types';

// ============================================================================
// Types
// ============================================================================

export interface RegenerateOptions {
  /** Use specific photos instead of current state (for removal before state updates) */
  photos?: PhotoItem[];
  /** Use specific settings instead of current state */
  settings?: CollageSettings;
  /** Override a single photo's priority before state updates */
  priorityOverride?: { photoId: string; priority: PhotoPriority };
  /** Override a single photo's crop before state updates */
  cropOverride?: { photoId: string; crop: CropRegion };
  /** Shuffle for variety (refresh button) */
  randomize?: boolean;
  /** V3 tuning parameters (for immediate changes) */
  v3Tuning?: V3Tuning;
}

// ============================================================================
// Hook
// ============================================================================

export function useCollageGeneration(deps: {
  photos: PhotoItem[];
  settings: CollageSettings;
  layout: CollageLayout | null;
  setLayout: (layout: CollageLayout | null) => void;
}) {
  const { photos, settings, layout, setLayout } = deps;

  const [v3Tuning, setV3Tuning] = useState<V3Tuning>(DEFAULT_V3_TUNING);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Batched into single state to minimize render passes after worker returns
  const [genMeta, setGenMeta] = useState<{
    debugLogs: LogEntry[];
    lastDurationMs: number | undefined;
    softRejection: { reason: string; details: Record<string, unknown> } | null;
    layoutMeta: Record<string, unknown> | null;
  }>({
    debugLogs: [],
    lastDurationMs: undefined,
    softRejection: null,
    layoutMeta: null,
  });

  // Ref to access latest photos (avoids stale closure in async callbacks)
  const photosRef = useRef<PhotoItem[]>(photos);
  photosRef.current = photos;

  // Request ID for stale response detection (worker-based generation)
  const latestRequestIdRef = useRef(0);

  // Track shuffle count per session for telemetry
  const shuffleCountRef = useRef(0);

  // Track last-logged photo count to deduplicate telemetry
  const lastLoggedCountRef = useRef(0);

  const regenerateCollage = useCallback(async (options: RegenerateOptions = {}) => {
    const {
      photos: optPhotos = photosRef.current,
      settings: optSettings = settings,
      priorityOverride,
      cropOverride,
      randomize = false,
      v3Tuning: tuningOverride = v3Tuning,
    } = options;

    // Apply crop override to get correct dimensions immediately (avoids stale state)
    let photosToUse = optPhotos;
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
    const normalizedGap = (optSettings.gapSize / 100) * 0.04;

    // Apply shape slider AR constraint if active
    const arBounds = sliderToARBounds(optSettings.shapeSlider);
    const effectiveTuning = arBounds
      ? { ...tuningOverride, canvas_minAR: arBounds.minAR, canvas_maxAR: arBounds.maxAR }
      : tuningOverride;

    // Track this request to detect stale responses
    const requestId = ++latestRequestIdRef.current;

    // Track shuffles for telemetry
    if (randomize) {
      shuffleCountRef.current++;
    }

    setIsGenerating(true);
    devLogger.clear();

    try {
      // Use worker for layout generation
      const result = await generateLayoutInWorker({
        dimensions,
        normalizedGap,
        tuning: effectiveTuning,
        randomize,
      });

      // Check for stale response (user clicked again while we were working)
      if (requestId !== latestRequestIdRef.current) {
        return; // Discard stale result
      }

      const resultLayout = result.layout;

      // Populate debug logs from worker
      if (result.logs) {
        for (const log of result.logs) {
          devLogger.log(log.category, log.label, log.data, log.level || 'info', log.rejectedLayout);
        }
      }

      const currentLogs = devLogger.getLogs();

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
          success: resultLayout !== null,
          canvasWidth: resultLayout?.width ?? null,
          canvasHeight: resultLayout?.height ?? null,
          canvasAR: resultLayout
            ? resultLayout.width / resultLayout.height
            : null,
          cellCount: resultLayout?.cells.length ?? null,
          logCount: logEntries.length,
          rejectCount,
          rejectReasons,
          feasibilityCount,
          feasibilityReasons,
          durationMs: result.durationMs ?? 0,
          failureReason: resultLayout ? null : lastRejection?.reason ?? 'unknown',
          failureDetails: resultLayout ? null : lastRejection?.details ?? null,
          rejectedCells: null,
          rejectedCanvasWidth: null,
          rejectedCanvasHeight: null,
          capturedAt: new Date().toISOString(),
        });
      }

      // Layout is now always non-null (soft rejections instead of hard)
      setLayout(resultLayout);
      setLayoutError(null);
      setGenMeta({
        debugLogs: currentLogs,
        lastDurationMs: result.durationMs,
        softRejection: result.softRejection ?? null,
        layoutMeta: result.layoutMeta ? {
          ...result.layoutMeta,
          durationMs: result.durationMs,
          usedWorker: result.usedWorker ?? false,
        } : null,
      });
      // Telemetry: log photo count + aspect ratios (privacy-safe, no image data)
      if (randomize) {
        remoteLogger.info('telemetry', 'shuffle', {
          count: dimensions.length,
          shuffleNum: shuffleCountRef.current,
          isDev: import.meta.env.DEV,
        });
      } else if (dimensions.length !== lastLoggedCountRef.current) {
        lastLoggedCountRef.current = dimensions.length;
        remoteLogger.info('telemetry', 'photos', {
          count: dimensions.length,
          aspectRatios: dimensions.map(d => +d.aspectRatio.toFixed(2)),
          heroCount: dimensions.filter(d => d.weight > 1).length,
          isDev: import.meta.env.DEV,
        });
      }
    } catch (error) {
      // Check for stale response
      if (requestId !== latestRequestIdRef.current) return;

      console.error('Layout generation failed:', error);
      remoteLogger.error('layout', 'Generation failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      if (!layout) {
        setLayoutError("Something went wrong. Please try again.");
      }
    } finally {
      // Only clear generating if this is still the latest request
      if (requestId === latestRequestIdRef.current) {
        setIsGenerating(false);
      }
    }
  }, [settings, layout, setLayout, v3Tuning]);

  const handleV3TuningChange = useCallback((key: keyof V3Tuning, value: number) => {
    const newTuning = { ...v3Tuning, [key]: value };
    setV3Tuning(newTuning);
    if (layout) {
      regenerateCollage({ v3Tuning: newTuning });
    }
  }, [v3Tuning, layout, regenerateCollage]);

  return {
    isGenerating,
    layoutError,
    setLayoutError,
    softRejection: genMeta.softRejection,
    layoutMeta: genMeta.layoutMeta,
    debugLogs: genMeta.debugLogs,
    lastDurationMs: genMeta.lastDurationMs,
    v3Tuning,
    regenerateCollage,
    handleV3TuningChange,
  };
}
