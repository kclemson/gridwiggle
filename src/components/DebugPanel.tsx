/**
 * Debug Panel for Main App
 * 
 * Wraps the shared DebugLogPanel with v1/v3 algorithm toggle.
 * Dev-only component for debugging layout generation.
 * 
 * Includes export/reset controls for V3 layout captures.
 */

import { useCallback } from 'react';
import { LogEntry } from '@/lib/devLogger';
import { DebugLogPanel } from '@/components/debug/DebugLogPanel';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Trash2 } from 'lucide-react';
import { 
  getCaptureStats, 
  exportPendingCaptures, 
  downloadJson,
  clearCaptures,
} from '@/lib/v3CaptureStorage';

export type AlgorithmVersion = 'v1' | 'v3';

interface DebugPanelProps {
  logs: LogEntry[];
  durationMs?: number;
  algorithmVersion: AlgorithmVersion;
  onAlgorithmVersionChange: (version: AlgorithmVersion) => void;
}

export function DebugPanel({ 
  logs, 
  durationMs,
  algorithmVersion,
  onAlgorithmVersionChange,
}: DebugPanelProps) {
  // Re-read on each render (cheap localStorage read, updates naturally)
  const pendingCount = getCaptureStats().pending;

  const handleExport = useCallback(() => {
    const { data, count } = exportPendingCaptures();
    if (count === 0) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadJson(data, `v3-captures-${algorithmVersion}-${timestamp}.json`);
  }, [algorithmVersion]);

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
      <ToggleGroup 
        type="single" 
        value={algorithmVersion} 
        onValueChange={(value) => value && onAlgorithmVersionChange(value as AlgorithmVersion)}
        size="sm"
      >
        <ToggleGroupItem value="v1" className="text-xs font-mono px-2 h-6">
          v1
        </ToggleGroupItem>
        <ToggleGroupItem 
          value="v3" 
          className="text-xs font-mono px-2 h-6 data-[state=on]:bg-amber-500/20 data-[state=on]:text-amber-600 dark:data-[state=on]:text-amber-400"
        >
          v3
        </ToggleGroupItem>
      </ToggleGroup>
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
