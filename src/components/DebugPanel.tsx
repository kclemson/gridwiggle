/**
 * Debug Panel for Main App
 * 
 * Wraps the shared DebugLogPanel with v1/v3 algorithm toggle.
 * Dev-only component for debugging layout generation.
 */

import { LogEntry } from '@/lib/devLogger';
import { DebugLogPanel } from '@/components/debug/DebugLogPanel';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

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
  const versionToggle = (
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
  );

  return (
    <DebugLogPanel 
      logs={logs}
      durationMs={durationMs}
      headerRight={versionToggle}
    />
  );
}
