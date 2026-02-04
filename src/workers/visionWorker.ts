import { pipeline, RawImage } from "@huggingface/transformers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let detector: any = null;

interface DetectionResult {
  label: string;
  score: number;
  box: { xmin: number; ymin: number; xmax: number; ymax: number };
}

interface WorkerMessage {
  type: 'detect';
  imageBlob: Blob;
  originalWidth: number;
  originalHeight: number;
}

async function loadModel() {
  if (!detector) {
    self.postMessage({ type: 'status', message: 'Loading AI model (first time only)...' });
    
    // Try WebGPU first, fallback to WASM
    const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
    const device = hasWebGPU ? "webgpu" : "wasm";
    
    detector = await pipeline(
      "object-detection",
      "Xenova/detr-resnet-50",
      { device }
    );
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
  // Filter by confidence > 0.4, prioritize people if detected
  const allSubjects = detections.filter(d => d.score > 0.4);
  const people = allSubjects.filter(d => d.label === 'person');
  const subjects = people.length > 0 ? people : allSubjects;
  
  if (subjects.length === 0) {
    // No subjects detected - use full image (no cropping)
    return {
      x: 0,
      y: 0,
      width: originalWidth,
      height: originalHeight
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
    const model = await loadModel();
    
    self.postMessage({ type: 'status', message: 'Loading image...' });
    
    // Load image directly from blob - no base64 conversion needed
    let image = await RawImage.fromBlob(e.data.imageBlob);
    
    // Scale down to max 640px for performance
    const maxSize = 640;
    const origW = image.width;
    const origH = image.height;
    let processedWidth = origW;
    let processedHeight = origH;
    
    if (origW > maxSize || origH > maxSize) {
      const scale = Math.min(maxSize / origW, maxSize / origH);
      processedWidth = Math.round(origW * scale);
      processedHeight = Math.round(origH * scale);
      image = await image.resize(processedWidth, processedHeight);
    }
    
    self.postMessage({ type: 'status', message: 'Detecting subjects...' });
    const results = await model(image) as DetectionResult[];
    
    // Calculate optimal crop
    const crop = calculateOptimalCrop(
      results,
      e.data.originalWidth,
      e.data.originalHeight,
      processedWidth,
      processedHeight
    );
    
    // Determine subject description
    const subjects = results
      .filter(r => r.score > 0.4)
      .map(r => r.label);
    const subjectDescription = subjects.length > 0 
      ? [...new Set(subjects)].join(', ')
      : 'No subjects detected';
    
    // Calculate max confidence from filtered results
    const maxConfidence = subjects.length > 0 
      ? Math.max(...results.filter(r => r.score > 0.4).map(r => r.score)) 
      : 0;
    
    // Only apply smart crop if a person was detected
    // DETR hallucinates random objects (banana, vase) for cartoons
    // but reliably detects "person" in real photos
    const hasPerson = results.some(r => r.score > 0.4 && r.label === 'person');
    const skipCrop = !hasPerson;
    
    self.postMessage({
      type: 'result',
      crop,
      confidence: maxConfidence,
      subjects: subjectDescription,
      skipCrop,
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Detection failed'
    });
  }
};
