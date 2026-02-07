import { LogEntry } from '@/lib/devLogger';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, X, AlertTriangle, ChevronRight, Filter } from 'lucide-react';
import { V3Tuning } from '@/lib/v3/types';
import { V3TuningSection } from '@/components/V3TuningSection';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

export type AlgorithmVersion = 'v1' | 'v3';

interface DebugPanelProps {
  logs: LogEntry[];
  v3Tuning: V3Tuning;
  onV3TuningChange: (key: keyof V3Tuning, value: number) => void;
  algorithmVersion: AlgorithmVersion;
  onAlgorithmVersionChange: (version: AlgorithmVersion) => void;
}

function getLogIcon(label: string, data: Record<string, unknown>, category?: string) {
  // Feasibility checks — amber filter icon
  if (category === 'feasibility') {
    return <Filter className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
  }
  
  // Check for accepted/rejected in config logs
  if (label.includes('Trying config') || label.includes('config')) {
    if (data.accepted === true) {
      return <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />;
    }
    if (data.accepted === false) {
      return <X className="h-3.5 w-3.5 text-red-500 shrink-0" />;
    }
  }
  
  // Fallback logs
  if (label.includes('Fallback') || label.includes('fallback')) {
    return <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />;
  }
  
  // Layout complete
  if (label.includes('Layout complete') || label.includes('complete')) {
    return <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />;
  }
  
  // Default arrow for strategy/info logs
  return <ChevronRight className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
}

function formatValue(value: unknown): string {
  if (typeof value === 'number') {
    // Format percentages and decimals nicely
    if (Number.isInteger(value)) {
      return String(value);
    }
    return value.toFixed(2);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function LogEntryRow({ entry }: { entry: LogEntry }) {
  const icon = getLogIcon(entry.label, entry.data, entry.category);
  const dataEntries = Object.entries(entry.data);
  const isFeasibility = entry.category === 'feasibility';
  
  return (
    <div className={cn(
      "border-b border-border/50 py-2 px-3 last:border-b-0",
      isFeasibility && "bg-amber-500/10"
    )}>
      <div className="flex items-center gap-2 font-medium text-xs">
        {icon}
        <span className="text-foreground">{entry.label}</span>
      </div>
      {dataEntries.length > 0 && (
        <div className="mt-1 ml-5 space-y-0.5">
          {dataEntries.map(([key, value]) => (
            <div key={key} className="flex gap-2 text-[11px] font-mono">
              <span className="text-muted-foreground">{key}:</span>
              <span className={
                typeof value === 'boolean' 
                  ? value ? 'text-green-600' : 'text-red-600'
                  : 'text-foreground'
              }>
                {formatValue(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DebugPanel({ 
  logs, 
  v3Tuning, 
  onV3TuningChange,
  algorithmVersion,
  onAlgorithmVersionChange,
}: DebugPanelProps) {
  const timestamp = logs.length > 0 
    ? new Date(logs[0].timestamp).toLocaleTimeString() 
    : null;

  // Split logs into two columns
  const midpoint = Math.ceil(logs.length / 2);
  const leftLogs = logs.slice(0, midpoint);
  const rightLogs = logs.slice(midpoint);

  // Extract hero percentage from logs
  const heroPct = (() => {
    for (const log of logs) {
      if (log.data.heroPctOfCanvas) {
        return String(log.data.heroPctOfCanvas);
      }
    }
    return null;
  })();

  return (
    <div className="max-h-[600px]">
      <div className="bg-background border border-border rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-muted/50 px-3 py-1.5 border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Layout Logs
          </span>
          <div className="flex items-center gap-3">
            {/* Algorithm Version Toggle */}
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
            {timestamp && (
              <span className="text-[10px] text-muted-foreground font-mono">
                {timestamp}
              </span>
            )}
          </div>
        </div>
        
        {/* V3 Tuning controls */}
        <V3TuningSection tuning={v3Tuning} onTuningChange={onV3TuningChange} heroPct={heroPct} />
        
        {/* Log entries - two columns */}
        <ScrollArea className="max-h-[calc(100vh-280px)]">
          {logs.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Generate a collage to see logs
            </div>
          ) : (
            <div className="grid grid-cols-2 divide-x divide-border/50">
              {/* Left column */}
              <div>
                {leftLogs.map((entry, index) => (
                  <LogEntryRow key={`${entry.timestamp}-${index}`} entry={entry} />
                ))}
              </div>
              {/* Right column */}
              <div>
                {rightLogs.map((entry, index) => (
                  <LogEntryRow key={`${entry.timestamp}-${midpoint + index}`} entry={entry} />
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
