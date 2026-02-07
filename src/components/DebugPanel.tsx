/**
 * Debug Panel for Main App
 * 
 * Wraps the shared DebugLogPanel with capture export/reset controls.
 * Dev-only component for debugging layout generation.
 */

import { useState, useCallback, useEffect } from 'react';
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
  // Track pending count in state so reset triggers re-render
  const [pendingCount, setPendingCount] = useState(() => getCaptureStats().pending);

  // Sync pending count when logs change (after each generation)
  useEffect(() => {
    setPendingCount(getCaptureStats().pending);
  }, [logs]);

  const handleExport = useCallback(() => {
    const { data, count } = exportPendingCaptures();
    if (count === 0) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadJson(data, `v3-captures-${timestamp}.json`);
    setPendingCount(0);  // Update state to trigger re-render
  }, []);

  const handleReset = useCallback(() => {
    clearCaptures();
    setPendingCount(0);  // Update state to trigger re-render
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
