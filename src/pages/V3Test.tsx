/**
 * V3 Layout Test Page
 * 
 * Dev-only page for rapid V3 algorithm iteration.
 * Uses synthetic photos (CSS rectangles) for fast testing.
 * Auto-captures layout metadata to localStorage on every shuffle.
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LayoutVisualization } from '@/components/layout-rating/LayoutVisualization';
import { generatePhotoSet, TEST_PHOTO_COUNTS } from '@/test/layout/photoGenerator';
import { generateCollageLayoutV3 } from '@/lib/v3/index';
import { devLogger, LogEntry } from '@/lib/devLogger';
import { 
  saveCapture, 
  getCaptureStats, 
  exportPendingCaptures, 
  extractReasonFrequencies,
  getLastRejection,
  downloadJson,
  V3LayoutCapture,
} from '@/lib/v3CaptureStorage';
import { SyntheticPhoto } from '@/test/layout/types';
import { PhotoItem, CollageSettings, CollageLayout } from '@/types/collage';
import { Shuffle, Star, Image, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

// Static settings matching production defaults
const GAP_SIZE = 8;

// Placeholder blob for synthetic photos (not used for CSS visualization)
const PLACEHOLDER_BLOB = new Blob([''], { type: 'image/png' });

/**
 * Format log data for display:
 * - Flatten nested objects with underscore prefix
 * - Remove JSON syntax characters
 * - Format as comma-separated key:value pairs
 */
function formatLogData(data: Record<string, unknown>): string {
  const pairs: string[] = [];
  
  function flatten(obj: Record<string, unknown>, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}_${key}` : key;
      
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively flatten nested objects
        flatten(value as Record<string, unknown>, fullKey);
      } else if (Array.isArray(value)) {
        // Format arrays as [val1, val2, ...]
        const formatted = value.map(v => 
          typeof v === 'number' ? v.toFixed(2) : String(v)
        ).join(', ');
        pairs.push(`${fullKey}:[${formatted}]`);
      } else if (typeof value === 'number') {
        // Format numbers to 2 decimal places if float
        const formatted = Number.isInteger(value) ? value : value.toFixed(2);
        pairs.push(`${fullKey}:${formatted}`);
      } else {
        pairs.push(`${fullKey}:${value}`);
      }
    }
  }
  
  flatten(data);
  return pairs.join(', ');
}

/**
 * Convert SyntheticPhoto to PhotoItem for layout generation.
 */
function toPhotoItem(photo: SyntheticPhoto): PhotoItem {
  return {
    id: photo.id,
    filename: photo.id,
    objectUrl: '', // Not needed for CSS visualization
    blob: PLACEHOLDER_BLOB,
    originalWidth: photo.originalWidth,
    originalHeight: photo.originalHeight,
    smartCrop: null,
    manualCrop: null,
    isProcessing: false,
    error: null,
    priority: photo.priority,
  };
}

/**
 * Generate a random photo set with 95% hero probability.
 */
function generateRandomSet(): { photos: SyntheticPhoto[]; seed: number; orientationBias: number } {
  const photoCount = TEST_PHOTO_COUNTS[Math.floor(Math.random() * TEST_PHOTO_COUNTS.length)];
  const orientationBias = (Math.random() - 0.5); // -0.5 to +0.5
  const hasHero = Math.random() < 0.95; // 95% hero - no-hero cases are easier
  const seed = Date.now(); // Use timestamp as pseudo-seed for reference
  
  const photos = generatePhotoSet(photoCount, orientationBias, hasHero);
  return { photos, seed, orientationBias };
}

/**
 * Layout generation result (pure function output).
 */
interface LayoutResult {
  layout: CollageLayout | null;
  logs: LogEntry[];
  durationMs: number;
}

/**
 * Generate layout and capture logs/timing (pure function).
 */
function generateLayoutResult(photos: SyntheticPhoto[]): LayoutResult {
  devLogger.clear();
  const startTime = performance.now();
  
  const photoItems = photos.map(toPhotoItem);
  const settings: CollageSettings = {
    shape: 'auto',
    gapColor: '#ffffff',
    gapSize: GAP_SIZE,
  };
  
  // Build photo weights (hero = priority 1 gets weight 2)
  const photoWeights: Record<string, number> = {};
  photos.forEach(p => {
    if (p.priority === 1) {
      photoWeights[p.id] = 2;
    }
  });
  
  const layout = generateCollageLayoutV3(photoItems, settings, { photoWeights });
  const durationMs = performance.now() - startTime;
  const logs = devLogger.getLogs();
  
  return { layout, logs, durationMs };
}

/**
 * Build a capture object from photo set and layout result.
 */
function buildCapture(
  photoSet: { photos: SyntheticPhoto[]; seed: number; orientationBias: number },
  result: LayoutResult
): Omit<V3LayoutCapture, 'exported'> {
  const { photos, seed, orientationBias } = photoSet;
  const { layout, logs, durationMs } = result;
  
  const heroPhoto = photos.find(p => p.priority === 1);
  const avgAR = photos.reduce((s, p) => s + p.aspectRatio, 0) / photos.length;
  const { rejectReasons, feasibilityReasons, rejectCount, feasibilityCount } = 
    extractReasonFrequencies(logs);
  
  const lastRejection = getLastRejection(logs);
  
  return {
    photoCount: photos.length,
    heroCount: heroPhoto ? 1 : 0,
    heroAR: heroPhoto?.aspectRatio ?? null,
    avgAR,
    orientationBias,
    seed,
    
    success: layout !== null,
    canvasWidth: layout?.width ?? null,
    canvasHeight: layout?.height ?? null,
    canvasAR: layout ? layout.width / layout.height : null,
    cellCount: layout?.cells.length ?? null,
    
    logCount: logs.length,
    rejectCount,
    rejectReasons,
    feasibilityCount,
    feasibilityReasons,
    durationMs,
    
    failureReason: layout ? null : lastRejection?.reason ?? 'unknown',
    failureDetails: layout ? null : lastRejection?.details ?? null,
    
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Consolidated test state.
 */
interface TestState {
  photoSet: { photos: SyntheticPhoto[]; seed: number; orientationBias: number };
  layout: CollageLayout | null;
  logs: LogEntry[];
  durationMs: number;
}

// Thresholds for efficiency indicators
const LOG_THRESHOLDS = { good: 30, warn: 80 };
const DURATION_THRESHOLDS = { good: 10, warn: 50 };

function LogCountBadge({ 
  count, 
  rejectCount, 
  feasibilityCount 
}: { 
  count: number; 
  rejectCount: number;
  feasibilityCount: number;
}) {
  const color = count <= LOG_THRESHOLDS.good 
    ? 'text-green-600' 
    : count <= LOG_THRESHOLDS.warn 
      ? 'text-amber-600' 
      : 'text-red-600';
  
  return (
    <span className={cn("tabular-nums", color)}>
      {count} logs
      {(rejectCount > 0 || feasibilityCount > 0) && (
        <span className="text-muted-foreground ml-1">
          (
          {rejectCount > 0 && <span className="text-red-500">{rejectCount} rej</span>}
          {rejectCount > 0 && feasibilityCount > 0 && ', '}
          {feasibilityCount > 0 && <span className="text-amber-500">{feasibilityCount} feas</span>}
          )
        </span>
      )}
    </span>
  );
}

function DurationBadge({ durationMs }: { durationMs: number }) {
  const color = durationMs <= DURATION_THRESHOLDS.good 
    ? 'text-green-600' 
    : durationMs <= DURATION_THRESHOLDS.warn 
      ? 'text-amber-600' 
      : 'text-red-600';
  
  return (
    <span className={cn("tabular-nums", color)}>
      {durationMs.toFixed(1)}ms
    </span>
  );
}

export default function V3Test() {
  // Consolidated state initialized with first generation
  const [state, setState] = useState<TestState>(() => {
    const photoSet = generateRandomSet();
    const result = generateLayoutResult(photoSet.photos);
    return { photoSet, ...result };
  });
  
  // Pending capture count (refreshed on shuffle/export)
  const [pendingCount, setPendingCount] = useState(() => getCaptureStats().pending);
  
  // Shuffle: generate new set, run layout, capture to storage
  const handleShuffle = useCallback(() => {
    const photoSet = generateRandomSet();
    const result = generateLayoutResult(photoSet.photos);
    
    setState({ photoSet, ...result });
    
    // Capture to localStorage
    saveCapture(buildCapture(photoSet, result));
    setPendingCount(getCaptureStats().pending);
  }, []);
  
  // Export pending captures
  const handleExport = useCallback(() => {
    const { data, count } = exportPendingCaptures();
    if (count === 0) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadJson(data, `v3-captures-${timestamp}.json`);
    setPendingCount(0);
  }, []);
  
  // Destructure state for rendering
  const { photoSet, layout, logs, durationMs } = state;
  
  // Stats
  const heroPhoto = photoSet.photos.find(p => p.priority === 1);
  const avgAR = photoSet.photos.reduce((sum, p) => sum + p.aspectRatio, 0) / photoSet.photos.length;
  
  // Log category breakdown
  const logStats = extractReasonFrequencies(logs);
  
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">V3 Layout Test</h1>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <Badge variant="secondary" className="tabular-nums">
                {pendingCount} pending
              </Badge>
            )}
            <Button 
              onClick={handleExport} 
              variant="outline" 
              size="sm"
              disabled={pendingCount === 0}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button onClick={handleShuffle} variant="outline" className="gap-2">
              <Shuffle className="h-4 w-4" />
              Shuffle
            </Button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Image className="h-4 w-4" />
            <span>{photoSet.photos.length} photos</span>
          </div>
          {heroPhoto && (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <span>Hero AR: {heroPhoto.aspectRatio.toFixed(2)}</span>
            </div>
          )}
          {!heroPhoto && (
            <div className="text-muted-foreground/50">No hero</div>
          )}
          <div>Avg AR: {avgAR.toFixed(2)}</div>
        </div>
        
        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[670px_1fr] gap-6">
          {/* Left: Debug Logs */}
          <div className="border rounded-lg bg-card overflow-hidden order-2 lg:order-1">
            <div className="p-3 border-b font-medium text-sm flex items-center justify-between">
              <span>Debug Logs</span>
              <div className="flex items-center gap-3 font-mono text-xs">
                <LogCountBadge 
                  count={logs.length} 
                  rejectCount={logStats.rejectCount}
                  feasibilityCount={logStats.feasibilityCount}
                />
                <DurationBadge durationMs={durationMs} />
              </div>
            </div>
            <ScrollArea className="h-[70vh]">
              <div className="p-3 font-mono text-xs space-y-1">
                {logs.length === 0 ? (
                  <div className="text-muted-foreground">No logs yet</div>
                ) : (
                  logs.map((entry, idx) => {
                    const isReject = entry.level === 'warn' || entry.level === 'error' 
                      || entry.category.includes('reject');
                    const isFeasibility = entry.category === 'feasibility';
                    
                    return (
                      <div key={idx} className="grid grid-cols-[260px_1fr] gap-2">
                        <div className="flex gap-1 min-w-0">
                          <span className={cn(
                            "shrink-0",
                            isReject ? "text-red-500" 
                              : isFeasibility ? "text-amber-500" 
                              : "text-blue-500"
                          )}>
                            [{entry.category}]
                          </span>
                          <span className={cn(
                            "break-words min-w-0",
                            isReject ? "text-red-400" 
                              : isFeasibility ? "text-amber-400" 
                              : "text-foreground"
                          )}>
                            {entry.label}
                          </span>
                        </div>
                        {Object.keys(entry.data).length > 0 && (
                          <span className={cn(
                            "break-all",
                            isReject ? "text-red-400/70" 
                              : isFeasibility ? "text-amber-400/70" 
                              : "text-muted-foreground"
                          )}>
                            {formatLogData(entry.data)}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
          
          {/* Right: Canvas */}
          <div className="border rounded-lg p-4 bg-card order-1 lg:order-2">
            {layout ? (
              <LayoutVisualization layout={layout} photos={photoSet.photos} />
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                Layout generation failed
              </div>
            )}
            
            {layout && (
              <div className="mt-3 text-base font-medium text-foreground text-center">
                Canvas: {layout.width}×{layout.height}px ({(layout.width / layout.height).toFixed(2)} AR, 1:{(layout.height / layout.width).toFixed(2)})
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
