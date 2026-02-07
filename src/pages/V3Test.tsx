/**
 * V3 Layout Test Page
 * 
 * Dev-only page for rapid V3 algorithm iteration.
 * Uses synthetic photos (CSS rectangles) for fast testing.
 * Auto-captures layout metadata to localStorage on every shuffle.
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { DebugLogPanel } from '@/components/debug/DebugLogPanel';
import { CaptureControls, RejectionBadge } from '@/components/debug';
import { LayoutVisualization } from '@/components/layout-rating/LayoutVisualization';
import { generatePhotoSet, TEST_PHOTO_COUNTS } from '@/test/layout/photoGenerator';
import { generateCollageLayoutV3 } from '@/lib/v3/index';
import { getLastRejectedLayout, clearRejectedLayout } from '@/lib/v3/intersection';
import { devLogger, LogEntry } from '@/lib/devLogger';
import { 
  saveCapture, 
  getCaptureStats, 
  exportPendingCaptures, 
  extractReasonFrequencies,
  getLastRejection,
  downloadJson,
  clearCaptures,
  V3LayoutCapture,
} from '@/lib/v3CaptureStorage';
import { SyntheticPhoto } from '@/test/layout/types';
import { PhotoItem, CollageSettings, CollageLayout } from '@/types/collage';
import type { RejectedLayout } from '@/lib/v3/types';
import { Shuffle, Star, Image, Eye, EyeOff } from 'lucide-react';

// Static settings matching production defaults
const GAP_SIZE = 8;

// Placeholder blob for synthetic photos (not used for CSS visualization)
const PLACEHOLDER_BLOB = new Blob([''], { type: 'image/png' });

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
  rejectedLayout: RejectedLayout | null;
}

/**
 * Generate layout and capture logs/timing (pure function).
 */
function generateLayoutResult(photos: SyntheticPhoto[]): LayoutResult {
  devLogger.clear();
  clearRejectedLayout(); // Clear previous rejected layout
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
  const rejectedLayout = getLastRejectedLayout();
  
  return { layout, logs, durationMs, rejectedLayout };
}

/**
 * Build a capture object from photo set and layout result.
 */
function buildCapture(
  photoSet: { photos: SyntheticPhoto[]; seed: number; orientationBias: number },
  result: LayoutResult
): Omit<V3LayoutCapture, 'exported'> {
  const { photos, seed, orientationBias } = photoSet;
  const { layout, logs, durationMs, rejectedLayout } = result;
  
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
    
    // Rejected layout geometry for visualization
    rejectedCells: rejectedLayout?.cells?.map(c => ({
      photoId: c.photoId,
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height,
    })) ?? null,
    rejectedCanvasWidth: rejectedLayout?.canvasWidth ?? null,
    rejectedCanvasHeight: rejectedLayout?.canvasHeight ?? null,
    
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
  rejectedLayout: RejectedLayout | null;
}

export default function V3Test() {
  // Consolidated state initialized with first generation
  const [state, setState] = useState<TestState>(() => {
    const photoSet = generateRandomSet();
    const result = generateLayoutResult(photoSet.photos);
    return { photoSet, ...result };
  });
  
  // Toggle for showing rejected layouts
  const [showRejected, setShowRejected] = useState(false);
  
  // Capture stats (refreshed on shuffle/export/reset)
  const [captureStats, setCaptureStats] = useState(() => getCaptureStats());
  
  // Shuffle: generate new set, run layout, capture to storage
  const handleShuffle = useCallback(() => {
    const photoSet = generateRandomSet();
    const result = generateLayoutResult(photoSet.photos);
    
    setState({ photoSet, ...result });
    
    // Capture to localStorage
    saveCapture(buildCapture(photoSet, result));
    setCaptureStats(getCaptureStats());
  }, []);
  
  // Export pending captures
  const handleExport = useCallback(() => {
    const { data, count } = exportPendingCaptures();
    if (count === 0) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadJson(data, `v3-captures-${timestamp}.json`);
    setCaptureStats(getCaptureStats());
  }, []);
  
  // Reset all captures
  const handleReset = useCallback(() => {
    clearCaptures();
    setCaptureStats({ total: 0, pending: 0, pendingSuccessCount: 0 });
  }, []);
  
  // Destructure state for rendering
  const { photoSet, layout, logs, durationMs, rejectedLayout } = state;
  
  // Stats
  const heroPhoto = photoSet.photos.find(p => p.priority === 1);
  const avgAR = photoSet.photos.reduce((sum, p) => sum + p.aspectRatio, 0) / photoSet.photos.length;
  
  // Scale rejected layout from normalized space to pixels (1000 base)
  const scaledRejectedLayout = rejectedLayout?.cells && rejectedLayout.canvasWidth && rejectedLayout.canvasHeight
    ? {
        width: Math.round(rejectedLayout.canvasWidth * 1000),
        height: Math.round(rejectedLayout.canvasHeight * 1000),
        cells: rejectedLayout.cells.map(c => ({
          photoId: c.photoId,
          x: Math.round(c.x * 1000),
          y: Math.round(c.y * 1000),
          width: Math.round(c.width * 1000),
          height: Math.round(c.height * 1000),
        })),
      }
    : null;
  
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">V3 Layout Test</h1>
          <div className="flex items-center gap-2">
            <Button 
              onClick={() => setShowRejected(s => !s)}
              variant={showRejected ? "default" : "outline"}
              size="sm"
              className="gap-2"
            >
              {showRejected ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {showRejected ? "Showing Rejected" : "Show Rejected"}
            </Button>
            <CaptureControls
              pendingCount={captureStats.pending}
              successCount={captureStats.pendingSuccessCount}
              onExport={handleExport}
              onReset={handleReset}
              variant="full"
            />
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
              <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
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
          <DebugLogPanel 
            logs={logs}
            durationMs={durationMs}
            maxHeight="70vh"
            className="order-2 lg:order-1"
          />
          
          {/* Right: Canvas */}
          <div className="border rounded-lg p-4 bg-card order-1 lg:order-2">
            {layout ? (
              <>
                <LayoutVisualization layout={layout} photos={photoSet.photos} />
                <div className="mt-3 text-base font-medium text-foreground text-center">
                  Canvas: {layout.width}×{layout.height}px ({(layout.width / layout.height).toFixed(2)} AR, 1:{(layout.height / layout.width).toFixed(2)})
                </div>
              </>
            ) : showRejected && scaledRejectedLayout ? (
              <div className="relative">
                <div className="ring-2 ring-destructive rounded-lg overflow-hidden">
                  <LayoutVisualization layout={scaledRejectedLayout} photos={photoSet.photos} />
                </div>
                <div className="mt-3 text-base font-medium text-foreground text-center">
                  Canvas: {scaledRejectedLayout.width}×{scaledRejectedLayout.height}px ({(scaledRejectedLayout.width / scaledRejectedLayout.height).toFixed(2)} AR)
                </div>
                <RejectionBadge 
                  reason={rejectedLayout?.reason ?? 'unknown'} 
                  details={rejectedLayout?.details ?? {}} 
                />
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                {rejectedLayout 
                  ? `Layout rejected: ${rejectedLayout.reason.replace(/_/g, ' ')}${!rejectedLayout.cells ? ' (no cell data)' : ''}`
                  : 'Layout generation failed'
                }
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
