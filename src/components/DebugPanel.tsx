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

  const headerRight = (
    <CaptureControls
      pendingCount={stats.pending}
      successCount={stats.pendingSuccessCount}
      onExport={handleExport}
      onReset={handleReset}
      variant="compact"
    />
  );

  return (
    <DebugLogPanel 
      logs={logs}
      durationMs={durationMs}
      headerRight={headerRight}
    />
  );
}
