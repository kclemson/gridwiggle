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
    remoteLogger.info('export', 'Starting export', { photoCount: photos.length });

    try {
      const blob = await exportCollageAsPng(
        photos,
        layout,
        settings.gapColor,
        settings.exportScale
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
  }, [layout, photos, settings]);

  return {
    isExporting,
    exportError,
    handleExport,
  };
}
