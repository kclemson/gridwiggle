/**
 * Debug Panel for Main App
 * 
 * Wraps the shared DebugLogPanel with capture export/reset controls.
 * Dev-only component for debugging layout generation.
 */

import { useState, useCallback, useEffect } from 'react';
import { LogEntry } from '@/lib/devLogger';
import { DebugLogPanel } from '@/components/debug/DebugLogPanel';
import { CaptureControls } from '@/components/debug/CaptureControls';
import { Button } from '@/components/ui/button';
import { 
  getCaptureStats, 
  exportPendingCaptures, 
  downloadJson,
  clearCaptures,
} from '@/lib/captureStorage';
import { getDisplayCrop } from '@/lib/cropUtils';
import { PhotoItem } from '@/types/collage';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';

interface DebugPanelProps {
  logs: LogEntry[];
  durationMs?: number;
  /** Photos for AR export (optional) */
  photos?: PhotoItem[];
}

export function DebugPanel({ 
  logs, 
  durationMs,
  photos,
}: DebugPanelProps) {
  // Track pending count and success count in state so reset triggers re-render
  const [stats, setStats] = useState(() => getCaptureStats());

  // Sync stats when logs change (after each generation)
  useEffect(() => {
    setStats(getCaptureStats());
  }, [logs]);

  const handleExport = useCallback(() => {
    const { data, count } = exportPendingCaptures();
    if (count === 0) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadJson(data, `v3-captures-${timestamp}.json`);
    setStats(getCaptureStats());
  }, []);

  const handleReset = useCallback(() => {
    clearCaptures();
    setStats({ total: 0, pending: 0, pendingSuccessCount: 0 });
  }, []);

  // Export photo ARs to clipboard for LayoutTest import
  const handleExportARs = useCallback(() => {
    if (!photos || photos.length === 0) {
      toast.error('No photos to export');
      return;
    }
    
    const data = photos.map(p => {
      const crop = getDisplayCrop(p);
      const width = crop?.width ?? p.originalWidth;
      const height = crop?.height ?? p.originalHeight;
      return {
        ar: +(width / height).toFixed(4),
        isHero: p.priority === 1,
      };
    });
    
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    toast.success(`Copied ${data.length} photo ARs to clipboard`);
  }, [photos]);

  const headerRight = (
    <div className="flex items-center gap-2">
      {photos && photos.length > 0 && (
        <Button
          onClick={handleExportARs}
          variant="outline"
          size="sm"
          className="gap-1.5"
          title="Copy photo ARs to clipboard for V3Test"
        >
          <Copy className="h-3.5 w-3.5" />
          ARs
        </Button>
      )}
      <CaptureControls
      pendingCount={stats.pending}
      successCount={stats.pendingSuccessCount}
      onExport={handleExport}
        onReset={handleReset}
        variant="compact"
      />
    </div>
  );

  return (
    <DebugLogPanel 
      logs={logs}
      durationMs={durationMs}
      headerRight={headerRight}
    />
  );
}
