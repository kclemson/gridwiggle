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
    
    // Capture pointer for smooth dragging even outside element
    (e.target as Element).setPointerCapture(e.pointerId);
    
    const pos = getEventPosition(e);
    setIsDragging(true);
    setDragType(type);
    setDragStart(pos);
    setCropStart({ ...crop });
  }, [getEventPosition, crop]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !dragType || !cropStart) return;

    const pos = getEventPosition(e);
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

    setCrop(newCrop);
  }, [isDragging, dragType, cropStart, photo.originalWidth, photo.originalHeight, getEventPosition, dragStart]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    (e.target as Element).releasePointerCapture(e.pointerId);
    setIsDragging(false);
    setDragType(null);
  }, []);

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

  // Larger handles on touch devices for easier grabbing
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Handle size in viewBox units so it appears as ~28px (desktop) or ~36px (mobile) on screen
  // Cap at 8% of smaller dimension to prevent oversized handles on small images
  const targetHandleSize = viewScale > 0 ? (isTouchDevice ? 36 : 28) / viewScale : 28;
  const maxHandleSize = Math.min(photo.originalWidth, photo.originalHeight) * 0.08;
  const handleSize = Math.min(targetHandleSize, maxHandleSize);
  const strokeWidth = viewScale > 0 ? 3 / viewScale : 3;
  
  // Minimum touch target: 64px on mobile, 44px on desktop (iOS HIG recommendation)
  const hitAreaSize = viewScale > 0 ? (isTouchDevice ? 64 : 44) / viewScale : 44;
  
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
        
        <div className="overflow-hidden bg-black/50 flex items-center justify-center p-4">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${photo.originalWidth} ${photo.originalHeight}`}
            preserveAspectRatio="xMidYMid meet"
            overflow="visible"
            className="max-w-full block touch-none select-none"
            style={{ maxHeight: 'calc(90vh - 120px)', overflow: 'visible' }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
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
            />
            {/* Bottom */}
            <rect
              x="0"
              y={crop.y + crop.height}
              width={photo.originalWidth}
              height={photo.originalHeight - (crop.y + crop.height)}
              fill="rgba(0, 0, 0, 0.6)"
            />
            {/* Left */}
            <rect
              x="0"
              y={crop.y}
              width={crop.x}
              height={crop.height}
              fill="rgba(0, 0, 0, 0.6)"
            />
            {/* Right */}
            <rect
              x={crop.x + crop.width}
              y={crop.y}
              width={photo.originalWidth - (crop.x + crop.width)}
              height={crop.height}
              fill="rgba(0, 0, 0, 0.6)"
            />
            
            {/* Crop area - draggable */}
            <rect
              x={crop.x}
              y={crop.y}
              width={crop.width}
              height={crop.height}
              fill="transparent"
              stroke="white"
              strokeWidth={strokeWidth}
              className="cursor-move"
              onPointerDown={(e) => handlePointerDown(e, 'move')}
            />
            
            {/* Grid lines (rule of thirds) */}
            {[1, 2].map((i) => (
              <g key={i}>
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
            
            {/* Corner handles */}
            {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => {
              const { cx, cy } = getHandlePosition(corner);
              const cursorMap = {
                nw: 'nwse-resize',
                ne: 'nesw-resize',
                sw: 'nesw-resize',
                se: 'nwse-resize',
              };
              
              return (
                <g key={corner}>
                  {/* Invisible hit area - larger for easier touch/click */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={hitAreaSize / 2}
                    fill="transparent"
                    style={{ cursor: cursorMap[corner] }}
                    onPointerDown={(e) => handlePointerDown(e, `resize-${corner}`)}
                  />
                  {/* Visible handle - with shadow and dark stroke for visibility */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={handleSize / 2}
                    fill="white"
                    stroke="#333"
                    strokeWidth={strokeWidth}
                    filter="url(#handleShadow)"
                    style={{ cursor: cursorMap[corner], pointerEvents: 'none' }}
                  />
                </g>
              );
            })}
          </svg>
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
