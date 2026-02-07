/**
 * Capture Controls Component
 * 
 * Displays pending capture count with success rate, plus export/reset buttons.
 * Used by both V3Test header and DebugPanel.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CaptureControlsProps {
  pendingCount: number;
  successCount: number;
  onExport: () => void;
  onReset: () => void;
  variant?: 'compact' | 'full';
}

export function CaptureControls({ 
  pendingCount, 
  successCount, 
  onExport, 
  onReset,
  variant = 'compact',
}: CaptureControlsProps) {
  const successRate = pendingCount > 0 
    ? Math.round((successCount / pendingCount) * 100) 
    : 0;
  
  // Color: green > 80%, amber 50-80%, red < 50%
  const rateColor = successRate >= 80 
    ? 'text-green-600' 
    : successRate >= 50 
      ? 'text-amber-600' 
      : 'text-red-600';
  
  const isCompact = variant === 'compact';
  const buttonSize = isCompact ? 'h-6 w-6 p-0' : 'h-8 px-2 gap-1.5';
  const iconSize = isCompact ? 'h-3 w-3' : 'h-4 w-4';
  
  return (
    <div className="flex items-center gap-2">
      {pendingCount > 0 && (
        <Badge variant="secondary" className="tabular-nums text-xs">
          {pendingCount} pending
          <span className={cn("ml-1", rateColor)}>({successRate}%)</span>
        </Badge>
      )}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onReset}
        disabled={pendingCount === 0}
        className={cn(buttonSize, !isCompact && "text-muted-foreground hover:text-destructive")}
        title="Clear all captures"
      >
        <Trash2 className={iconSize} />
        {!isCompact && "Reset"}
      </Button>
      <Button 
        variant={isCompact ? "ghost" : "outline"}
        size="sm" 
        onClick={onExport}
        disabled={pendingCount === 0}
        className={buttonSize}
        title="Export captures as JSON"
      >
        <Download className={iconSize} />
        {!isCompact && "Export"}
      </Button>
    </div>
  );
}
