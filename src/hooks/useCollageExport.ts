import { useState, useCallback } from 'react';
import { exportCollageAsPng, shareOrDownload } from '@/lib/exportCollage';
import { remoteLogger } from '@/lib/remoteLogger';
import { PhotoItem, CollageSettings, CollageLayout } from '@/types/collage';

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

    setIsExporting(true);
    setExportError(null);

    try {
      const blob = await exportCollageAsPng(
        photos,
        layout,
        settings.gapColor,
        settings.exportScale
      );
      await shareOrDownload(blob, `collage-${Date.now()}.png`);
      remoteLogger.info('telemetry', 'export', { count: photos.length });
    } catch (error) {
      console.error('Export failed:', error);
      remoteLogger.error('export', 'Export failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      setExportError('Export failed. Please try again.');
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
