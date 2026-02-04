import { HeroLogEntry } from '@/lib/debugLogger';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, X, AlertTriangle, ChevronRight } from 'lucide-react';

interface DebugPanelProps {
  logs: HeroLogEntry[];
}

function getLogIcon(label: string, data: Record<string, unknown>) {
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

function LogEntry({ entry }: { entry: HeroLogEntry }) {
  const icon = getLogIcon(entry.label, entry.data);
  const dataEntries = Object.entries(entry.data);
  
  return (
    <div className="border-b border-border/50 py-2 px-3 last:border-b-0">
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

export function DebugPanel({ logs }: DebugPanelProps) {
  const timestamp = logs.length > 0 
    ? new Date(logs[0].timestamp).toLocaleTimeString() 
    : null;

  return (
    <div className="max-h-[600px]">
      <div className="bg-background border border-border rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-muted/50 px-3 py-2 border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Hero Layout Logs
          </span>
          {timestamp && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {timestamp}
            </span>
          )}
        </div>
        
        {/* Log entries */}
        <ScrollArea className="max-h-[calc(100vh-140px)]">
          {logs.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Generate a collage to see logs
            </div>
          ) : (
            <div>
              {logs.map((entry, index) => (
                <LogEntry key={`${entry.timestamp}-${index}`} entry={entry} />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
