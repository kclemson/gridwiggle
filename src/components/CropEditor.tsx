import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PhotoItem, CropRegion } from '@/types/collage';

interface CropEditorProps {
  photo: PhotoItem;
  onClose: () => void;
  onSave: (photoId: string, crop: CropRegion) => void;
}

function getDefaultCrop(photo: PhotoItem): CropRegion {
  const activeCrop = photo.manualCrop || photo.smartCrop;
  if (activeCrop) {
    return { ...activeCrop };
  }
  // Default to center crop with some margin
  const size = Math.min(photo.originalWidth, photo.originalHeight) * 0.8;
  return {
    x: (photo.originalWidth - size) / 2,
    y: (photo.originalHeight - size) / 2,
    width: size,
    height: size,
  };
}

/**
 * CropEditor - Renders conditionally (when photo is provided).
 * Uses CSS-based image sizing - no useEffect needed for dimensions.
 * Scale is computed on-demand from the actual rendered image size.
 */
export function CropEditor({ photo, onClose, onSave }: CropEditorProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  
  // Initialize crop from photo props on mount
  const [crop, setCrop] = useState<CropRegion>(() => getDefaultCrop(photo));
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se' | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropStart, setCropStart] = useState<CropRegion | null>(null);
  
  // Trigger re-render when image loads so scale can be computed
  const [imageLoaded, setImageLoaded] = useState(false);

  // Compute scale on-demand from the actual rendered image
  const getScale = useCallback(() => {
    if (!imageRef.current) return 1;
    return imageRef.current.width / photo.originalWidth;
  }, [photo.originalWidth]);

  const getEventPosition = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const img = imageRef.current;
    if (!img) return { x: 0, y: 0 };

    const rect = img.getBoundingClientRect();
    const scale = getScale();

    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  }, [getScale]);

  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent, type: typeof dragType) => {
    e.preventDefault();
    const pos = getEventPosition(e);
    setIsDragging(true);
    setDragType(type);
    setDragStart(pos);
    setCropStart({ ...crop }); // Snapshot crop at drag start
  }, [getEventPosition, crop]);

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !dragType || !cropStart) return;

    const pos = getEventPosition(e);
    // Use absolute delta from original position, not incremental
    const dx = pos.x - dragStart.x;
    const dy = pos.y - dragStart.y;

    let newCrop = { ...cropStart }; // Start from original crop snapshot

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
    // Don't update dragStart - keep original reference point
  }, [isDragging, dragType, cropStart, photo.originalWidth, photo.originalHeight, getEventPosition, dragStart]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    setDragType(null);
  }, []);

  const handleSave = () => {
    onSave(photo.id, crop);
    onClose();
  };

  // Get current scale for rendering crop overlay
  const scale = getScale();

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-4 gap-4">
        <DialogHeader>
          <DialogTitle>Adjust Crop</DialogTitle>
        </DialogHeader>
        
        <div 
          className="flex-1 relative overflow-hidden bg-black/50 rounded-lg touch-none select-none flex items-center justify-center"
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        >
          {/* Image wrapper - browser handles sizing via CSS */}
          <div className="relative max-w-full max-h-full">
            <img
              ref={imageRef}
              src={photo.originalDataUrl}
              alt=""
              className="max-w-full max-h-full object-contain block"
              style={{ maxHeight: 'calc(90vh - 140px)' }} // Account for header/footer
              draggable={false}
              onLoad={() => setImageLoaded(true)}
            />
            
            {/* Only render overlay once image has loaded and we can compute scale */}
            {imageLoaded && (
              <>
                {/* Crop area with box-shadow to darken outside */}
                <div
                  className="absolute border-2 border-white cursor-move"
                  style={{
                    left: crop.x * scale,
                    top: crop.y * scale,
                    width: crop.width * scale,
                    height: crop.height * scale,
                    boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.6)`,
                    background: 'transparent',
                  }}
                  onMouseDown={(e) => handlePointerDown(e, 'move')}
                  onTouchStart={(e) => handlePointerDown(e, 'move')}
                >
                  {/* Grid lines */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="border border-white/30" />
                    ))}
                  </div>

                  {/* Corner handles */}
                  {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                    <div
                      key={corner}
                      className="absolute w-5 h-5 bg-white rounded-full border-2 border-primary -translate-x-1/2 -translate-y-1/2"
                      style={{
                        left: corner.includes('e') ? '100%' : 0,
                        top: corner.includes('s') ? '100%' : 0,
                        cursor: `${corner}-resize`,
                      }}
                      onMouseDown={(e) => handlePointerDown(e, `resize-${corner}`)}
                      onTouchStart={(e) => handlePointerDown(e, `resize-${corner}`)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2">
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
