import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PhotoItem, CropRegion } from '@/types/collage';
import { getEditorInitialCrop } from '@/lib/cropUtils';

interface CropEditorProps {
  photo: PhotoItem;
  onClose: () => void;
  onSave: (photoId: string, crop: CropRegion) => void;
}

/**
 * CropEditor - SVG-based crop editor using viewBox coordinates.
 * Uses the same coordinate system as CroppedImage for pixel-perfect alignment.
 * All crop coordinates are in original image pixels.
 */
export function CropEditor({ photo, onClose, onSave }: CropEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Initialize crop from photo props on mount using centralized utility
  const [crop, setCrop] = useState<CropRegion>(() => getEditorInitialCrop(photo));
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se' | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropStart, setCropStart] = useState<CropRegion | null>(null);
  
  // Track viewScale for sizing handles in screen pixels
  const [viewScale, setViewScale] = useState(1);

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
    onSave(photo.id, crop);
    onClose();
  };

  // Handle size in viewBox units so it appears as ~20px on screen
  const handleSize = viewScale > 0 ? 20 / viewScale : 20;
  const strokeWidth = viewScale > 0 ? 2 / viewScale : 2;

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
            className="max-w-full block touch-none select-none"
            style={{ maxHeight: 'calc(90vh - 120px)' }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {/* Full image */}
            <image
              href={photo.objectUrl}
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
              const cx = corner.includes('e') ? crop.x + crop.width : crop.x;
              const cy = corner.includes('s') ? crop.y + crop.height : crop.y;
              const cursorMap = {
                nw: 'nwse-resize',
                ne: 'nesw-resize',
                sw: 'nesw-resize',
                se: 'nwse-resize',
              };
              
              return (
                <circle
                  key={corner}
                  cx={cx}
                  cy={cy}
                  r={handleSize / 2}
                  fill="white"
                  stroke="hsl(var(--primary))"
                  strokeWidth={strokeWidth}
                  style={{ cursor: cursorMap[corner] }}
                  onPointerDown={(e) => handlePointerDown(e, `resize-${corner}`)}
                />
              );
            })}
          </svg>
        </div>

        <DialogFooter className="px-4 py-3 border-t border-border shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
