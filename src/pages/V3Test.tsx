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
import { CaptureControls, RejectionBadge, LayoutInfoPanel } from '@/components/debug';
import { LayoutVisualization } from '@/components/layout-rating/LayoutVisualization';
import { 
  generatePhotoSet, 
  TEST_PHOTO_COUNTS,
  getSavedPhotoSets,
  savePhotoSet,
  deletePhotoSet,
  loadPhotoSetAsPhotos,
  SavedPhotoSet,
} from '@/test/layout/photoGenerator';
import { generateCollageLayoutV4 } from '@/lib/v4/index';
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
import { Shuffle, Star, Image, Eye, EyeOff, Loader2, ClipboardPaste, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Static settings matching production defaults
const GAP_SIZE = 8;

/** Configurable hero count distribution for random test generation. */
const HERO_MIX: Record<number, number> = {
  0: 0.05,  // 5% no-hero
  1: 0.45,  // 45% single-hero
  2: 0.50,  // 50% dual-hero
};

/** Minimum photo count required for a given hero count. */
const MIN_PHOTOS_FOR_HEROES: Record<number, number> = {
  0: 1,
  1: 1,
  2: 8,  // Engine gate: dual hero needs >= 8 photos
};
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
    smartCropAttempted: false,
    manualCrop: null,
    isProcessing: false,
    error: null,
    priority: photo.priority,
  };
}

/**
 * Sample a heroCount from the HERO_MIX distribution,
 * falling back to lower counts when photoCount is too small.
 */
function sampleHeroCount(photoCount: number): number {
  const roll = Math.random();
  let cumulative = 0;
  
  // Walk entries from highest heroCount down so fallback is natural
  const entries = Object.entries(HERO_MIX)
    .map(([k, v]) => ({ count: Number(k), prob: v }))
    .sort((a, b) => a.count - b.count);
  
  for (const { count, prob } of entries) {
    cumulative += prob;
    if (roll <= cumulative) {
      // Check minimum photo requirement, fall back to 1
      if (photoCount < (MIN_PHOTOS_FOR_HEROES[count] ?? 1)) {
        return Math.min(1, photoCount);
      }
      return count;
    }
  }
  return 1; // fallback
}

/**
 * Generate a random photo set with configurable hero distribution.
 */
function generateRandomSet(): { photos: SyntheticPhoto[]; seed: number; orientationBias: number } {
  const photoCount = TEST_PHOTO_COUNTS[Math.floor(Math.random() * TEST_PHOTO_COUNTS.length)];
  const orientationBias = (Math.random() - 0.5); // -0.5 to +0.5
  const heroCount = sampleHeroCount(photoCount);
  const seed = Date.now();
  
  const photos = generatePhotoSet(photoCount, orientationBias, heroCount);
  return { photos, seed, orientationBias };
}

/**
 * Layout generation result (pure function output).
 */
interface LayoutResult {
  layout: CollageLayout | null;
  layoutMeta: Record<string, unknown> | null;
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
  
  const result = generateCollageLayoutV4(photoItems, settings, { photoWeights, randomize: true });
  const durationMs = performance.now() - startTime;
  const logs = devLogger.getLogs();
  const rejectedLayout = getLastRejectedLayout();
  
  return { 
    layout: result?.layout ?? null, 
    layoutMeta: result?.layoutMeta ? { ...result.layoutMeta, durationMs, usedWorker: false } : null,
    logs, 
    durationMs, 
    rejectedLayout,
  };
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
  
  const heroPhotos = photos.filter(p => p.priority === 1);
  const avgAR = photos.reduce((s, p) => s + p.aspectRatio, 0) / photos.length;
  const { rejectReasons, feasibilityReasons, rejectCount, feasibilityCount } = 
    extractReasonFrequencies(logs);
  
  const lastRejection = getLastRejection(logs);
  
  return {
    photoCount: photos.length,
    heroCount: heroPhotos.length,
    heroAR: heroPhotos.length > 0 ? heroPhotos[0].aspectRatio : null,
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
  layoutMeta: Record<string, unknown> | null;
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
  const [showRejected, setShowRejected] = useState(true);
  
  // Batch shuffle progress
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  
  // Capture stats (refreshed on shuffle/export/reset)
  const [captureStats, setCaptureStats] = useState(() => getCaptureStats());
  
  // Photo set mode: 'random' or a saved set ID
  const [photoSetMode, setPhotoSetMode] = useState<'random' | string>('random');
  const [savedSets, setSavedSets] = useState<SavedPhotoSet[]>(() => getSavedPhotoSets());
  
  // Import handler (parse from clipboard)
  const handleImportPhotoSet = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = JSON.parse(text) as Array<{ ar: number; isHero: boolean }>;
      
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Invalid format');
      }
      
      // Validate structure
      if (!parsed.every(p => typeof p.ar === 'number' && typeof p.isHero === 'boolean')) {
        throw new Error('Invalid format: expected { ar: number, isHero: boolean }[]');
      }
      
    // Auto-generate name based on count and heroes
    const heroCount = parsed.filter(p => p.isHero).length;
    const name = heroCount > 0 
      ? `${parsed.length} (${heroCount}H)` 
      : `${parsed.length}`;
    
    const id = savePhotoSet(name, parsed);
    setSavedSets(getSavedPhotoSets());
    setPhotoSetMode(id);
    
    toast.success(`Imported "${name}"`);
    } catch (e) {
      toast.error('Failed to parse clipboard. Copy the JSON from the Export ARs button.');
      console.error('Import error:', e);
    }
  }, []);

  // Delete handler
  const handleDeleteSet = useCallback((id: string) => {
    deletePhotoSet(id);
    setSavedSets(getSavedPhotoSets());
    if (photoSetMode === id) {
      setPhotoSetMode('random');
    }
    toast.success('Photo set deleted');
  }, [photoSetMode]);

  // Shuffle: generate new set or use fixed set, run layout, capture to storage
  const handleShuffle = useCallback(() => {
    let photos: SyntheticPhoto[];
    let orientationBias = 0;
    let seed = Date.now();
    
    if (photoSetMode === 'random') {
      const result = generateRandomSet();
      photos = result.photos;
      orientationBias = result.orientationBias;
      seed = result.seed;
    } else {
      const set = savedSets.find(s => s.id === photoSetMode);
      if (!set) return;
      photos = loadPhotoSetAsPhotos(set);  // Shuffled order, same ARs
      // Calculate orientation bias from actual data
      const landscapes = photos.filter(p => p.aspectRatio > 1).length;
      orientationBias = (landscapes / photos.length) * 2 - 1;
    }
    
    const photoSet = { photos, seed, orientationBias };
    const result = generateLayoutResult(photos);
    
    setState({ photoSet, ...result });
    
    // Capture to localStorage
    saveCapture(buildCapture(photoSet, result));
    setCaptureStats(getCaptureStats());
  }, [photoSetMode, savedSets]);
  
  // Batch shuffle: run 25 iterations, capture all to storage
  const handleShuffle25 = useCallback(async () => {
    const BATCH_SIZE = 25;
    setBatchProgress({ current: 0, total: BATCH_SIZE });
    
    let lastState: TestState | null = null;
    
    for (let i = 0; i < BATCH_SIZE; i++) {
      let photos: SyntheticPhoto[];
      let orientationBias = 0;
      let seed = Date.now();
      
      if (photoSetMode === 'random') {
        const result = generateRandomSet();
        photos = result.photos;
        orientationBias = result.orientationBias;
        seed = result.seed;
      } else {
        const set = savedSets.find(s => s.id === photoSetMode);
        if (!set) break;
        photos = loadPhotoSetAsPhotos(set);
        const landscapes = photos.filter(p => p.aspectRatio > 1).length;
        orientationBias = (landscapes / photos.length) * 2 - 1;
      }
      
      const photoSet = { photos, seed, orientationBias };
      const result = generateLayoutResult(photos);
      
      // Capture to localStorage
      saveCapture(buildCapture(photoSet, result));
      
      // Update progress
      setBatchProgress({ current: i + 1, total: BATCH_SIZE });
      
      // Keep last state for display
      lastState = { photoSet, ...result };
      
      // Yield to UI to show progress
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    // Display final result
    if (lastState) {
      setState(lastState);
    }
    
    setBatchProgress(null);
    setCaptureStats(getCaptureStats());
  }, [photoSetMode, savedSets]);
  
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
  const { photoSet, layout, layoutMeta, logs, durationMs, rejectedLayout } = state;
  
  // Stats
  const heroPhotos = photoSet.photos.filter(p => p.priority === 1);
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
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold">V3 Layout Test</h1>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Photo Set Selector */}
            <div className="flex items-center gap-1">
              <Select value={photoSetMode} onValueChange={setPhotoSetMode}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Random Photos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">Random Photos</SelectItem>
                  {savedSets.length > 0 && <SelectSeparator />}
                  {savedSets.map(set => (
                    <SelectItem key={set.id} value={set.id}>
                      {set.name} ({set.photos.length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button 
                onClick={handleImportPhotoSet} 
                variant="outline" 
                size="sm"
                title="Import photo set from clipboard (paste JSON)"
              >
                <ClipboardPaste className="h-4 w-4" />
              </Button>
              
              {photoSetMode !== 'random' && (
                <Button 
                  onClick={() => handleDeleteSet(photoSetMode)} 
                  variant="ghost" 
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  title="Delete this photo set"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <Button 
              onClick={() => setShowRejected(s => !s)}
              variant={showRejected && !layout && rejectedLayout ? "destructive" : showRejected ? "default" : "outline"}
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
            <Button 
              onClick={handleShuffle25} 
              variant="outline" 
              className="gap-2"
              disabled={batchProgress !== null}
            >
              {batchProgress ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {batchProgress.current}/{batchProgress.total}
                </>
              ) : (
                <>
                  <Shuffle className="h-4 w-4" />
                  Shuffle 25
                </>
              )}
            </Button>
            <Button 
              onClick={handleShuffle} 
              variant="outline" 
              className="gap-2"
              disabled={batchProgress !== null}
            >
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
          {heroPhotos.length > 0 && (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
              <span>
                {heroPhotos.length === 1 
                  ? `Hero AR: ${heroPhotos[0].aspectRatio.toFixed(2)}`
                  : `${heroPhotos.length} Heroes: ${heroPhotos.map(p => p.aspectRatio.toFixed(2)).join(', ')}`
                }
              </span>
            </div>
          )}
          {heroPhotos.length === 0 && (
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
          <div className={cn(
            "border rounded-lg p-4 order-1 lg:order-2",
            layout ? "bg-card" : "bg-destructive/5 border-destructive"
          )}>
            {layout ? (
              <>
                <LayoutVisualization layout={layout} photos={photoSet.photos} />
                <div className="mt-3 text-base font-medium text-foreground text-center">
                  Canvas: {layout.width}×{layout.height}px ({(layout.width / layout.height).toFixed(2)} AR, 1:{(layout.height / layout.width).toFixed(2)})
                </div>
                {layoutMeta && <LayoutInfoPanel meta={layoutMeta} />}
              </>
            ) : showRejected && scaledRejectedLayout ? (
              <div className="relative">
                <div className="ring-4 ring-destructive rounded-lg overflow-hidden">
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
