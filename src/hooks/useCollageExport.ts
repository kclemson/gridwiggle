import { useState, useCallback } from 'react';
import { exportCollageAsPng, shareOrDownload } from '@/lib/exportCollage';
import { remoteLogger } from '@/lib/remoteLogger';
import { PhotoItem, CollageSettings, CollageLayout } from '@/types/collage';

/**
 * Single-path export. The previous pre-render-and-cache scheme was
 * unreliable: any layout/photo/setting change invalidated the cache, so on
 * tap we'd usually fall through to the slow path anyway, by which point
 * iOS had consumed the gesture and the share sheet never appeared.
 *
 * iOS Safari (16.4+) keeps the gesture alive across a single awaited
 * promise chain that started inside the click handler, so rendering then
 * sharing inline works reliably as long as we don't introduce extra
 * setTimeouts or unrelated awaits.
 */
export function useCollageExport(deps: {
  photos: PhotoItem[];
  layout: CollageLayout | null;
  settings: CollageSettings;
}) {
  const { photos, layout, settings } = deps;

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    if (!layout) return;

    const filename = `collage-${Date.now()}.png`;
    setIsExporting(true);
    setExportError(null);
    try {
      const blob = await exportCollageAsPng(
        photos,
        layout,
        settings.gapColor,
        settings.exportScale
      );
      const outcome = await shareOrDownload(blob, filename);
      remoteLogger.info('telemetry', 'export', {
        count: photos.length,
        outcome,
      });
    } catch (error) {
      console.error('Export failed:', error);
      remoteLogger.error('export', 'Export failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      setExportError('Export failed. Tap again to retry.');
    } finally {
      setIsExporting(false);
    }
  }, [layout, photos, settings]);

  return {
    isExporting,
    exportError,
    handleExport,
  };
}
