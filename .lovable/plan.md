

# Smart Crop with Object Detection - Enhanced Plan

Replace the LLM-based approach with a client-side DETR object detection model, incorporating best practices from your proven implementation.

---

## Key Insights from Reference Implementation

| Pattern | What it Does | We Should Adopt |
|---------|-------------|-----------------|
| **Image scaling to 640px** | Performance optimization for detection | Yes - reduces processing time significantly |
| **Confidence threshold 0.4** | Filters low-quality detections | Yes - balances accuracy vs recall |
| **Padding = min(w,h) * 0.1** | Consistent padding regardless of aspect ratio | Yes - simpler and more consistent |
| **Content type detection** | Classifies portrait/landscape/mixed/object | Nice-to-have for future features |
| **Scale bounding boxes back** | Maps 640px coords to original dimensions | Essential for accuracy |

---

## Architecture

```text
Photo Upload
      |
      v
smartCropService.getSmartCrop()
   - Scales image down to max 640px for performance
   - Extracts ImageData from canvas
      |
      v
Web Worker (visionWorker.ts)
   - Loads DETR model (cached after first use)
   - Runs object detection
   - Returns: [{label: "person", box: {xmin, ymin, xmax, ymax}, score: 0.95}, ...]
      |
      v
processDetections() in worker
   - Filters by confidence > 0.4
   - Scales bounding boxes back to original image dimensions
   - Calculates optimalCropArea (union of all subjects + 10% padding)
      |
      v
Returns CropRegion to main thread
```

---

## Files to Create/Modify

### 1. New File: `src/workers/visionWorker.ts`

Web Worker that runs object detection in a separate thread:

```typescript
import { pipeline } from "@huggingface/transformers";

let detector: any = null;

interface DetectionResult {
  label: string;
  score: number;
  box: { xmin: number; ymin: number; xmax: number; ymax: number };
}

interface WorkerMessage {
  type: 'detect';
  imageDataUrl: string;
  originalWidth: number;
  originalHeight: number;
  processedWidth: number;
  processedHeight: number;
}

async function loadModel() {
  if (!detector) {
    // Try WebGPU first, fallback to WASM
    const device = navigator.gpu ? "webgpu" : "wasm";
    detector = await pipeline("object-detection", "Xenova/detr-resnet-50", { device });
  }
  return detector;
}

function calculateOptimalCrop(
  detections: DetectionResult[],
  originalWidth: number,
  originalHeight: number,
  processedWidth: number,
  processedHeight: number
): { x: number; y: number; width: number; height: number } {
  // Filter by confidence > 0.4
  const subjects = detections.filter(d => d.score > 0.4);
  
  if (subjects.length === 0) {
    // No subjects detected - crop 10% from each edge
    return {
      x: originalWidth * 0.1,
      y: originalHeight * 0.1,
      width: originalWidth * 0.8,
      height: originalHeight * 0.8
    };
  }
  
  // Scale factor to convert from processed dimensions back to original
  const scaleX = originalWidth / processedWidth;
  const scaleY = originalHeight / processedHeight;
  
  // Find bounding box that contains ALL detected subjects
  let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
  
  for (const subject of subjects) {
    // Scale coordinates back to original image dimensions
    minX = Math.min(minX, subject.box.xmin * scaleX);
    minY = Math.min(minY, subject.box.ymin * scaleY);
    maxX = Math.max(maxX, subject.box.xmax * scaleX);
    maxY = Math.max(maxY, subject.box.ymax * scaleY);
  }
  
  // Add 10% padding based on smaller dimension (consistent padding)
  const padding = Math.min(originalWidth, originalHeight) * 0.1;
  
  // Apply padding and clamp to image bounds
  const x = Math.max(0, minX - padding);
  const y = Math.max(0, minY - padding);
  const right = Math.min(originalWidth, maxX + padding);
  const bottom = Math.min(originalHeight, maxY + padding);
  
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(right - x),
    height: Math.round(bottom - y)
  };
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  if (e.data.type !== 'detect') return;
  
  try {
    self.postMessage({ type: 'status', message: 'Loading model...' });
    const model = await loadModel();
    
    self.postMessage({ type: 'status', message: 'Detecting subjects...' });
    const results: DetectionResult[] = await model(e.data.imageDataUrl);
    
    // Calculate optimal crop
    const crop = calculateOptimalCrop(
      results,
      e.data.originalWidth,
      e.data.originalHeight,
      e.data.processedWidth,
      e.data.processedHeight
    );
    
    // Determine subject description
    const subjects = results
      .filter(r => r.score > 0.4)
      .map(r => r.label);
    const subjectDescription = subjects.length > 0 
      ? [...new Set(subjects)].join(', ')
      : 'No subjects detected';
    
    self.postMessage({
      type: 'result',
      crop,
      confidence: subjects.length > 0 ? Math.max(...results.map(r => r.score)) : 0.5,
      subjects: subjectDescription
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Detection failed'
    });
  }
};
```

### 2. Rewrite: `src/services/smartCropService.ts`

Replace the edge function call with worker-based detection:

```typescript
import { CropRegion } from '@/types/collage';

interface SmartCropResult {
  crop: CropRegion;
  confidence: number;
  subjects: string;
}

// Create worker singleton
let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('../workers/visionWorker.ts', import.meta.url),
      { type: 'module' }
    );
  }
  return worker;
}

// Scale image down to max 640px for performance
function scaleImageForProcessing(
  imageDataUrl: string,
  originalWidth: number,
  originalHeight: number
): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const maxSize = 640;
    
    // Check if scaling needed
    if (originalWidth <= maxSize && originalHeight <= maxSize) {
      resolve({ dataUrl: imageDataUrl, width: originalWidth, height: originalHeight });
      return;
    }
    
    const scale = Math.min(maxSize / originalWidth, maxSize / originalHeight);
    const newWidth = Math.round(originalWidth * scale);
    const newHeight = Math.round(originalHeight * scale);
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      resolve({
        dataUrl: canvas.toDataURL('image/jpeg', 0.85),
        width: newWidth,
        height: newHeight
      });
    };
    img.onerror = reject;
    img.src = imageDataUrl;
  });
}

export async function getSmartCrop(
  imageDataUrl: string,
  width: number,
  height: number
): Promise<SmartCropResult> {
  // Scale down for performance
  const scaled = await scaleImageForProcessing(imageDataUrl, width, height);
  
  return new Promise((resolve, reject) => {
    const worker = getWorker();
    
    const handleMessage = (e: MessageEvent) => {
      if (e.data.type === 'result') {
        worker.removeEventListener('message', handleMessage);
        resolve({
          crop: e.data.crop,
          confidence: e.data.confidence,
          subjects: e.data.subjects
        });
      } else if (e.data.type === 'error') {
        worker.removeEventListener('message', handleMessage);
        reject(new Error(e.data.error));
      }
      // Ignore 'status' messages for now (could use for progress UI)
    };
    
    worker.addEventListener('message', handleMessage);
    
    worker.postMessage({
      type: 'detect',
      imageDataUrl: scaled.dataUrl,
      originalWidth: width,
      originalHeight: height,
      processedWidth: scaled.width,
      processedHeight: scaled.height
    });
  });
}
```

### 3. Update: `src/pages/Index.tsx`

Add model loading state for better UX:

- Track if model is being downloaded (first use)
- Show appropriate loading message
- Consider adding progress indicator for model download

```typescript
// Add state for model loading
const [isModelLoading, setIsModelLoading] = useState(false);

// In the progress indicator section:
{isProcessing && (
  <div className="space-y-2">
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Wand2 className="h-4 w-4 animate-pulse-soft text-primary" />
      <span>
        {isModelLoading 
          ? 'Downloading AI model (first time only, ~85MB)...' 
          : 'Detecting faces and subjects...'}
      </span>
    </div>
    <Progress value={smartCropProgress} className="h-2" />
  </div>
)}
```

### 4. Update: `package.json`

Add the transformers library:

```json
"@huggingface/transformers": "^3.4.1"
```

### 5. Update: `vite.config.ts`

Ensure worker bundling is configured (may already work by default):

```typescript
// Vite handles workers with type: 'module' automatically
// No changes needed unless issues arise
```

### 6. Optional Cleanup: Remove Edge Function

- Delete `supabase/functions/smart-crop/` directory
- Update `supabase/config.toml` to remove function reference

---

## Key Algorithm Details

### Bounding Box Scaling

The reference implementation correctly scales bounding boxes from processed dimensions back to original:

```typescript
// DETR returns coordinates relative to the 640px processed image
// Must scale back to original dimensions
const scaleX = originalWidth / processedWidth;  // e.g., 3000/640 = 4.69
const scaleY = originalHeight / processedHeight;

// Apply scale to each coordinate
actualX = detectedX * scaleX;
actualY = detectedY * scaleY;
```

### Padding Calculation

Use the smaller image dimension for consistent padding:

```typescript
// Padding as 10% of the smaller dimension
// This ensures consistent "breathing room" regardless of aspect ratio
const padding = Math.min(originalWidth, originalHeight) * 0.1;
```

### Fallback Strategy

When no subjects are detected:

```typescript
// Crop 10% from each edge, keeping center 80%
return {
  x: width * 0.1,
  y: height * 0.1,
  width: width * 0.8,
  height: height * 0.8
};
```

---

## Benefits vs Current LLM Approach

| Aspect | LLM (Current) | DETR (Proposed) |
|--------|---------------|-----------------|
| **Accuracy** | Inconsistent, can "hallucinate" | Trained specifically for detection |
| **Face detection** | Prompt-based (unreliable) | Detects "person" with precise boxes |
| **Latency** | ~2-5s per image (network) | First: ~10s (download), then: <1s |
| **Cost** | API credits per image | Free after download |
| **Offline** | No | Yes (after first use) |
| **Deterministic** | No | Yes |

---

## Implementation Order

1. Add `@huggingface/transformers` dependency
2. Create `src/workers/visionWorker.ts` with DETR pipeline
3. Rewrite `src/services/smartCropService.ts` to use worker
4. Update `src/pages/Index.tsx` for model loading state
5. Test with the same photos that showed problems
6. Remove edge function (optional cleanup after verification)

