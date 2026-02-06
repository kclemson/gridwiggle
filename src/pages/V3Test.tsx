/**
 * V3 Layout Test Page
 * 
 * Dev-only page for rapid V3 algorithm iteration.
 * Uses synthetic photos (CSS rectangles) for fast testing.
 */

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LayoutVisualization } from '@/components/layout-rating/LayoutVisualization';
import { generatePhotoSet } from '@/test/layout/photoGenerator';
import { generateCollageLayoutV3 } from '@/lib/v3/index';
import { devLogger, LogEntry } from '@/lib/devLogger';
import { SyntheticPhoto } from '@/test/layout/types';
import { PhotoItem, CollageSettings } from '@/types/collage';
import { Shuffle, Star, Image } from 'lucide-react';

// Static settings matching production defaults
const CANVAS_WIDTH = 480;
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
 * Generate a random photo set with 80% hero probability.
 */
function generateRandomSet(): { photos: SyntheticPhoto[]; seed: number } {
  const photoCount = Math.floor(Math.random() * 41) + 10; // 10-50
  const orientationBias = (Math.random() - 0.5); // -0.5 to +0.5
  const hasHero = Math.random() < 0.8; // 80% hero
  const seed = Date.now(); // Use timestamp as pseudo-seed for reference
  
  const photos = generatePhotoSet(photoCount, orientationBias, hasHero);
  return { photos, seed };
}

export default function V3Test() {
  const [photoSet, setPhotoSet] = useState(() => generateRandomSet());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // Shuffle and regenerate
  const handleShuffle = useCallback(() => {
    devLogger.clear();
    const newSet = generateRandomSet();
    setPhotoSet(newSet);
    // Logs will be captured after layout generation
  }, []);
  
  // Generate layout
  const layout = useMemo(() => {
    devLogger.clear();
    
    const photoItems = photoSet.photos.map(toPhotoItem);
    const settings: CollageSettings = {
      shape: 'auto',
      gapColor: '#ffffff',
      gapSize: GAP_SIZE,
    };
    
    // Build photo weights (hero = priority 1 gets weight 2)
    const photoWeights: Record<string, number> = {};
    photoSet.photos.forEach(p => {
      if (p.priority === 1) {
        photoWeights[p.id] = 2;
      }
    });
    
    const result = generateCollageLayoutV3(photoItems, settings, {
      photoWeights,
      canvasWidth: CANVAS_WIDTH,
    });
    
    // Capture logs after generation
    setLogs(devLogger.getLogs());
    
    return result;
  }, [photoSet]);
  
  // Stats
  const heroPhoto = photoSet.photos.find(p => p.priority === 1);
  const avgAR = photoSet.photos.reduce((sum, p) => sum + p.aspectRatio, 0) / photoSet.photos.length;
  
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">V3 Layout Test</h1>
          <Button onClick={handleShuffle} variant="outline" className="gap-2">
            <Shuffle className="h-4 w-4" />
            Shuffle
          </Button>
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
            <div className="p-3 border-b font-medium text-sm">
              Debug Logs ({logs.length})
            </div>
            <ScrollArea className="h-[70vh]">
              <div className="p-3 font-mono text-xs space-y-1">
                {logs.length === 0 ? (
                  <div className="text-muted-foreground">No logs yet</div>
                ) : (
                  logs.map((entry, idx) => (
                    <div key={idx} className="grid grid-cols-[260px_1fr] gap-2">
                      <div className="flex gap-1 shrink-0">
                        <span className="text-blue-500">[{entry.category}]</span>
                        <span className="text-foreground whitespace-nowrap">{entry.label}</span>
                      </div>
                      {Object.keys(entry.data).length > 0 && (
                        <span className="text-muted-foreground break-all">
                          {formatLogData(entry.data)}
                        </span>
                      )}
                    </div>
                  ))
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
