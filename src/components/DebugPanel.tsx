/**
 * Debug Panel for Main App
 * 
 * Wraps the shared DebugLogPanel with capture export/reset controls.
 * Dev-only component for debugging layout generation.
 */

import { useCallback } from 'react';
import { LogEntry } from '@/lib/devLogger';
import { DebugLogPanel } from '@/components/debug/DebugLogPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Trash2 } from 'lucide-react';
import { 
  getCaptureStats, 
  exportPendingCaptures, 
  downloadJson,
  clearCaptures,
} from '@/lib/v3CaptureStorage';

interface DebugPanelProps {
  logs: LogEntry[];
  durationMs?: number;
}

export function DebugPanel({ 
  logs, 
  durationMs,
}: DebugPanelProps) {
  // Re-read on each render (cheap localStorage read, updates naturally)
  const pendingCount = getCaptureStats().pending;

  const handleExport = useCallback(() => {
    const { data, count } = exportPendingCaptures();
    if (count === 0) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadJson(data, `v3-captures-${timestamp}.json`);
  }, []);

  const handleReset = useCallback(() => {
    clearCaptures();
  }, []);

  const headerRight = (
    <div className="flex items-center gap-2">
      {pendingCount > 0 && (
        <Badge variant="secondary" className="tabular-nums text-xs">
          {pendingCount} pending
        </Badge>
      )}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={handleReset}
        disabled={pendingCount === 0}
        className="h-6 w-6 p-0"
        title="Clear all captures"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={handleExport}
        disabled={pendingCount === 0}
        className="h-6 w-6 p-0"
        title="Export captures as JSON"
      >
        <Download className="h-3 w-3" />
      </Button>
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
