import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Trash2, Loader2, Sparkles } from 'lucide-react';
import { PhotoItem, CropRegion, PhotoPriority } from '@/types/collage';
import { getEditorInitialCrop } from '@/lib/cropUtils';

interface CropEditorProps {
  photo: PhotoItem;
  onClose: () => void;
  onSave: (photoId: string, crop: CropRegion, priority: PhotoPriority) => void;
  onDelete: (photoId: string) => void;
}

/**
 * CropEditor - SVG-based crop editor using viewBox coordinates.
 * Uses the same coordinate system as CroppedImage for pixel-perfect alignment.
 * All crop coordinates are in original image pixels.
 */
export function CropEditor({ photo, onClose, onSave, onDelete }: CropEditorProps) {
  // Guard against 0 dimensions - show loading state instead of invalid SVG
  if (photo.originalWidth === 0 || photo.originalHeight === 0) {
    return (
      <Dialog open={true} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Image Loading...</DialogTitle>
            <DialogDescription>
              Please wait while the image dimensions are being loaded.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  
  return <CropEditorInner photo={photo} onClose={onClose} onSave={onSave} onDelete={onDelete} />;
}

/**
 * Inner CropEditor component with all hooks - only rendered when dimensions are valid.
 */
function CropEditorInner({ photo, onClose, onSave, onDelete }: CropEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Initialize crop from photo props on mount using centralized utility
  const [crop, setCrop] = useState<CropRegion>(() => getEditorInitialCrop(photo));
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se' | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropStart, setCropStart] = useState<CropRegion | null>(null);
  
  // Hero toggle state - initialized from photo.priority
  const [isHero, setIsHero] = useState(photo.priority === 1);
  
  // Track viewScale for sizing handles in screen pixels
  const [viewScale, setViewScale] = useState(1);
  
  // Store initial values for change detection
  const initialCrop = useRef<CropRegion>(getEditorInitialCrop(photo));
  const initialIsHero = useRef(photo.priority === 1);
  
  // Detect if any changes were made
  const hasChanges = useMemo(() => {
    const cropChanged = 
      crop.x !== initialCrop.current.x ||
      crop.y !== initialCrop.current.y ||
      crop.width !== initialCrop.current.width ||
      crop.height !== initialCrop.current.height;
    
    const heroChanged = isHero !== initialIsHero.current;
    
    return cropChanged || heroChanged;
  }, [crop, isHero]);

  // Update viewScale from actual rendered SVG dimensions
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    
    const updateViewScale = () => {
      const rect = svg.getBoundingClientRect();
      if (photo.originalWidth > 0) {
        setViewScale(rect.width / photo.originalWidth);
      }
    };
    
    const observer = new ResizeObserver(updateViewScale);
    observer.observe(svg);
    updateViewScale();
    
    return () => observer.disconnect();
  }, [photo.originalWidth]);

  // Convert screen coordinates to SVG viewBox coordinates using getScreenCTM
  const getEventPosition = useCallback((e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    
    const cursor = pt.matrixTransform(ctm.inverse());
    return { x: cursor.x, y: cursor.y };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent, type: typeof dragType) => {
    e.preventDefault();
    e.stopPropagation();
    
    const pos = getEventPosition(e);
    setIsDragging(true);
    setDragType(type);
    setDragStart(pos);
    setCropStart({ ...crop });
  }, [getEventPosition, crop]);

  // Convert raw client coordinates to SVG viewBox coordinates (for window-level events).
  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const cursor = pt.matrixTransform(ctm.inverse());
    return { x: cursor.x, y: cursor.y };
  }, []);

  const computeCropFromPos = useCallback((pos: { x: number; y: number }) => {
    if (!dragType || !cropStart) return null;
    const dx = pos.x - dragStart.x;
    const dy = pos.y - dragStart.y;

    let newCrop = { ...cropStart };

    if (dragType === 'move') {
      newCrop.x = Math.max(0, Math.min(cropStart.x + dx, photo.originalWidth - cropStart.width));
      newCrop.y = Math.max(0, Math.min(cropStart.y + dy, photo.originalHeight - cropStart.height));
    } else {
      const minSize = 50;
      
      if (dragType.includes('nw') || dragType.includes('sw')) {
        const newX = Math.max(0, Math.min(cropStart.x + dx, cropStart.x + cropStart.width - minSize));
        const widthChange = cropStart.x - newX;
        newCrop.x = newX;
        newCrop.width = cropStart.width + widthChange;
      }
      if (dragType.includes('ne') || dragType.includes('se')) {
        newCrop.width = Math.max(minSize, Math.min(cropStart.width + dx, photo.originalWidth - cropStart.x));
      }
      if (dragType.includes('nw') || dragType.includes('ne')) {
        const newY = Math.max(0, Math.min(cropStart.y + dy, cropStart.y + cropStart.height - minSize));
        const heightChange = cropStart.y - newY;
        newCrop.y = newY;
        newCrop.height = cropStart.height + heightChange;
      }
      if (dragType.includes('sw') || dragType.includes('se')) {
        newCrop.height = Math.max(minSize, Math.min(cropStart.height + dy, photo.originalHeight - cropStart.y));
      }
    }
    return newCrop;
  }, [dragType, cropStart, dragStart, photo.originalWidth, photo.originalHeight]);

  // Window-level pointer tracking — works around mobile WebKit's unreliable
  // setPointerCapture on SVG children, and keeps drags alive when the finger
  // leaves the SVG bounds. pointercancel is treated like pointerup so OS
  // interruptions don't leave a stuck drag state.
  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      const pos = clientToSvg(e.clientX, e.clientY);
      const next = computeCropFromPos(pos);
      if (next) setCrop(next);
    };
    const onEnd = () => {
      setIsDragging(false);
      setDragType(null);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [isDragging, clientToSvg, computeCropFromPos]);

  const handleSave = () => {
    const priority: PhotoPriority = isHero ? 1 : 3;
    // Close immediately for responsiveness
    onClose();
    // State update happens after close - user doesn't see the delay
    onSave(photo.id, crop, priority);
  };
  
  const handleApplySmartCrop = useCallback(() => {
    if (photo.smartCrop) {
      setCrop({ ...photo.smartCrop });
    }
  }, [photo.smartCrop]);
  
  // Check if current crop matches smart crop
  const isSmartCropActive = useMemo(() => {
    if (!photo.smartCrop) return false;
    return (
      crop.x === photo.smartCrop.x &&
      crop.y === photo.smartCrop.y &&
      crop.width === photo.smartCrop.width &&
      crop.height === photo.smartCrop.height
    );
  }, [crop, photo.smartCrop]);

  const handleDelete = () => {
    onDelete(photo.id);
  };

  // Fixed screen-pixel sizes for consistent visuals regardless of image resolution
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const handleSize = viewScale > 0 ? (isTouchDevice ? 22 : 12) / viewScale : 12;
  const hitAreaSize = viewScale > 0 ? 72 / viewScale : 72;
  const strokeWidth = viewScale > 0 ? 2 / viewScale : 2;
  
  // Check if a point is near a corner, returning the corner id if so
  const getCornerId = useCallback((x: number, y: number): 'nw' | 'ne' | 'sw' | 'se' | null => {
    const threshold = hitAreaSize / 2;
    const corners = {
      nw: { x: crop.x, y: crop.y },
      ne: { x: crop.x + crop.width, y: crop.y },
      sw: { x: crop.x, y: crop.y + crop.height },
      se: { x: crop.x + crop.width, y: crop.y + crop.height },
    };
    for (const [id, corner] of Object.entries(corners)) {
      if (Math.abs(x - corner.x) <= threshold && Math.abs(y - corner.y) <= threshold) {
        return id as 'nw' | 'ne' | 'sw' | 'se';
      }
    }
    return null;
  }, [hitAreaSize, crop.x, crop.y, crop.width, crop.height]);

  // Smart dispatcher: delegate to resize if near a corner, otherwise move
  const handleCropAreaPointerDown = useCallback((e: React.PointerEvent) => {
    // Use clientToSvg directly — the event now fires on an HTML overlay div,
    // not the SVG itself, but getScreenCTM still maps client coords correctly.
    const pos = clientToSvg(e.clientX, e.clientY);
    const corner = getCornerId(pos.x, pos.y);
    if (corner) {
      handlePointerDown(e, `resize-${corner}`);
    } else {
      handlePointerDown(e, 'move');
    }
  }, [clientToSvg, getCornerId, handlePointerDown]);

  // Offset handles inward when at image edges so they're fully visible
  const getHandlePosition = (corner: 'nw' | 'ne' | 'sw' | 'se') => {
    const cx = corner.includes('e') ? crop.x + crop.width : crop.x;
    const cy = corner.includes('s') ? crop.y + crop.height : crop.y;
    return { cx, cy };
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
          <DialogTitle>Adjust Crop</DialogTitle>
          <DialogDescription className="sr-only">
            Drag the crop area to reposition, or drag corners to resize
          </DialogDescription>
        </DialogHeader>
        
        <div className="overflow-hidden bg-black/50 flex items-center justify-center p-4 touch-none">
          <div className="relative inline-block max-w-full" style={{ maxHeight: 'calc(90vh - 120px)' }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${photo.originalWidth} ${photo.originalHeight}`}
            preserveAspectRatio="xMidYMid meet"
            className="max-w-full block select-none"
            style={{ maxHeight: 'calc(90vh - 120px)', pointerEvents: 'none' }}
          >
            {/* Drop shadow filter for handle visibility */}
            <defs>
              <filter id="handleShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="black" floodOpacity="0.5" />
              </filter>
            </defs>
            
            {/* Full image - use preview for performance, viewBox handles coordinate mapping */}
            <image
              href={photo.previewUrl ?? photo.objectUrl}
              x="0"
              y="0"
              width={photo.originalWidth}
              height={photo.originalHeight}
              preserveAspectRatio="none"
            />
            
            {/* Darkening overlay - 4 rects outside crop region */}
            {/* Top */}
            <rect
              x="0"
              y="0"
              width={photo.originalWidth}
              height={crop.y}
              fill="rgba(0, 0, 0, 0.6)"
              pointerEvents="none"
            />
            {/* Bottom */}
            <rect
              x="0"
              y={crop.y + crop.height}
              width={photo.originalWidth}
              height={photo.originalHeight - (crop.y + crop.height)}
              fill="rgba(0, 0, 0, 0.6)"
              pointerEvents="none"
            />
            {/* Left */}
            <rect
              x="0"
              y={crop.y}
              width={crop.x}
              height={crop.height}
              fill="rgba(0, 0, 0, 0.6)"
              pointerEvents="none"
            />
            {/* Right */}
            <rect
              x={crop.x + crop.width}
              y={crop.y}
              width={photo.originalWidth - (crop.x + crop.width)}
              height={crop.height}
              fill="rgba(0, 0, 0, 0.6)"
              pointerEvents="none"
            />
            
            {/* Visible crop outline (decorative — interaction is handled by the
                expanded interaction rect below). */}
            <rect
              x={crop.x}
              y={crop.y}
              width={crop.width}
              height={crop.height}
              fill="transparent"
              stroke="white"
              strokeWidth={strokeWidth}
              pointerEvents="none"
            />
            
            {/* Grid lines (rule of thirds) */}
            {[1, 2].map((i) => (
              <g key={i} pointerEvents="none">
                <line
                  x1={crop.x + (crop.width * i) / 3}
                  y1={crop.y}
                  x2={crop.x + (crop.width * i) / 3}
                  y2={crop.y + crop.height}
                  stroke="rgba(255, 255, 255, 0.3)"
                  strokeWidth={strokeWidth / 2}
                />
                <line
                  x1={crop.x}
                  y1={crop.y + (crop.height * i) / 3}
                  x2={crop.x + crop.width}
                  y2={crop.y + (crop.height * i) / 3}
                  stroke="rgba(255, 255, 255, 0.3)"
                  strokeWidth={strokeWidth / 2}
                />
              </g>
            ))}
            
            {/* Visible corner handles — purely decorative; interaction routes
                through the unified interaction rect below. */}
            {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => {
              const { cx, cy } = getHandlePosition(corner);
              return (
                <rect
                  key={corner}
                  x={cx - handleSize / 2}
                  y={cy - handleSize / 2}
                  width={handleSize}
                  height={handleSize}
                  rx={handleSize * 0.2}
                  fill="white"
                  stroke="#333"
                  strokeWidth={strokeWidth}
                  filter="url(#handleShadow)"
                  pointerEvents="none"
                />
              );
            })}
          </svg>
          {/* HTML interaction overlay — covers the entire SVG box. Plain DOM
              elements hit-test reliably on every browser (iOS WebKit's SVG
              hit-testing is flaky with transparent fills). All pointer input
              flows through here; SVG above is render-only. */}
          <div
            className="absolute inset-0 cursor-move"
            style={{ touchAction: 'none' }}
            onPointerDown={handleCropAreaPointerDown}
          />
          </div>
        </div>

        <div className="px-4 py-3 border-t border-border shrink-0 flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleDelete}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 sm:w-auto sm:px-3"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">Delete</span>
          </Button>
          {photo.smartCrop && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleApplySmartCrop}
              disabled={isSmartCropActive}
              className="sm:w-auto sm:px-3"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline ml-1.5">Smart Crop</span>
            </Button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Switch id="hero-toggle" checked={isHero} onCheckedChange={setIsHero} />
            <Label htmlFor="hero-toggle" className="text-sm">Hero</Label>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
