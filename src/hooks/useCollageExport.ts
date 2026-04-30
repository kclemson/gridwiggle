import { useState, useCallback, useEffect, useRef } from 'react';
import { exportCollageAsPng, shareOrDownload, downloadBlob } from '@/lib/exportCollage';
import { remoteLogger } from '@/lib/remoteLogger';
import { isMobileDevice } from '@/lib/platform';
import { PhotoItem, CollageSettings, CollageLayout } from '@/types/collage';

/**
 * Pre-renders the export PNG in the background so that, on tap, we can
 * invoke navigator.share() synchronously inside the user-gesture
 * activation. iOS Safari requires this — otherwise the share sheet
 * silently fails to appear.
 *
 * Why useEffect here is OK (per project guidelines): we're synchronizing
 * React state with an external system (a cached blob), not syncing two
 * pieces of React state. Falls under the "Browser API interactions"
 * exception.
 */
export function useCollageExport(deps: {
  photos: PhotoItem[];
  layout: CollageLayout | null;
  settings: CollageSettings;
}) {
  const { photos, layout, settings } = deps;

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Cached pre-rendered PNG for synchronous share on user gesture.
  const cachedRef = useRef<{ signature: string; blob: Blob } | null>(null);
  const renderTokenRef = useRef(0);

  // Signature includes everything that affects the rendered PNG.
  const signature = layout
    ? `${layout.width}x${layout.height}|${settings.gapColor}|${settings.exportScale}|${photos
        .map((p) => `${p.id}:${p.manualCrop ? 'm' : p.smartCrop ? 's' : 'n'}`)
        .join(',')}|${layout.cells.map((c) => `${c.photoId}@${c.x},${c.y},${c.width}x${c.height}`).join(';')}`
    : '';

  useEffect(() => {
    if (!layout || !signature) return;
    if (cachedRef.current?.signature === signature) return;

    // Invalidate any stale cache so a tap during render doesn't share old pixels.
    cachedRef.current = null;
    const token = ++renderTokenRef.current;

    // Debounce so slider drags / shuffles don't thrash the canvas.
    const timer = window.setTimeout(async () => {
      try {
        const blob = await exportCollageAsPng(
          photos,
          layout,
          settings.gapColor,
          settings.exportScale
        );
        if (token !== renderTokenRef.current) return; // superseded
        cachedRef.current = { signature, blob };
      } catch (err) {
        // Silent — handleExport will retry on demand and surface the error.
        remoteLogger.warn('export', 'Pre-render failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [signature, layout, photos, settings.gapColor, settings.exportScale]);

  const handleExport = useCallback(async () => {
    if (!layout) return;

    const filename = `collage-${Date.now()}.png`;
    const cached = cachedRef.current;

    // Fast path: blob is ready → call share() synchronously inside the
    // gesture so iOS opens its native share sheet (Save Image, etc.).
    if (cached && cached.signature === signature) {
      try {
        if (isMobileDevice() && 'share' in navigator) {
          const file = new File([cached.blob], filename, { type: 'image/png' });
          const shareData = { files: [file] };
          if (navigator.canShare?.(shareData)) {
            try {
              // NOTE: no await before this call — keeps gesture activation alive.
              await navigator.share(shareData);
              remoteLogger.info('telemetry', 'export', { count: photos.length, path: 'share-fast' });
              return;
            } catch (err) {
              if ((err as Error).name === 'AbortError') return;
              // fall through to download
            }
          }
        }
        downloadBlob(cached.blob, filename);
        remoteLogger.info('telemetry', 'export', { count: photos.length, path: 'download-fast' });
        return;
      } catch (err) {
        console.error('Fast-path export failed:', err);
        // fall through to slow path
      }
    }

    // Slow path: not pre-rendered yet. Render then share. On iOS this
    // path may fail silently because the gesture has expired — surface
    // a clear error so the user can retry.
    setIsExporting(true);
    setExportError(null);
    try {
      const blob = await exportCollageAsPng(
        photos,
        layout,
        settings.gapColor,
        settings.exportScale
      );
      cachedRef.current = { signature, blob };
      await shareOrDownload(blob, filename);
      remoteLogger.info('telemetry', 'export', { count: photos.length, path: 'slow' });
    } catch (error) {
      console.error('Export failed:', error);
      remoteLogger.error('export', 'Export failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      setExportError('Export failed. Tap again to retry.');
    } finally {
      setIsExporting(false);
    }
  }, [layout, photos, settings, signature]);

  return {
    isExporting,
    exportError,
    handleExport,
  };
}
