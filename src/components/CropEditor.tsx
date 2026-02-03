import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PhotoItem, CropRegion } from '@/types/collage';
import { loadImage } from '@/lib/imageUtils';

interface CropEditorProps {
  photo: PhotoItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (photoId: string, crop: CropRegion) => void;
}

export function CropEditor({ photo, isOpen, onClose, onSave }: CropEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [crop, setCrop] = useState<CropRegion | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se' | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0, displayWidth: 0, displayHeight: 0 });

  // Initialize crop from photo's current crop
  useEffect(() => {
    if (photo && isOpen) {
      const activeCrop = photo.manualCrop || photo.smartCrop;
      if (activeCrop) {
        setCrop({ ...activeCrop });
      } else {
        // Default to center crop with some margin
        const size = Math.min(photo.originalWidth, photo.originalHeight) * 0.8;
        setCrop({
          x: (photo.originalWidth - size) / 2,
          y: (photo.originalHeight - size) / 2,
          width: size,
          height: size,
        });
      }
    }
  }, [photo, isOpen]);

  // Calculate display scale when container size changes
  useEffect(() => {
    if (!photo || !containerRef.current) return;

    const updateScale = () => {
      const container = containerRef.current;
      if (!container) return;

      const maxWidth = container.clientWidth;
      const maxHeight = container.clientHeight;
      const scaleX = maxWidth / photo.originalWidth;
      const scaleY = maxHeight / photo.originalHeight;
      const newScale = Math.min(scaleX, scaleY, 1);
      
      setScale(newScale);
      setImageDimensions({
        width: photo.originalWidth,
        height: photo.originalHeight,
        displayWidth: photo.originalWidth * newScale,
        displayHeight: photo.originalHeight * newScale,
      });
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [photo]);

  const getEventPosition = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };

    const rect = container.getBoundingClientRect();
    const offsetX = (container.clientWidth - imageDimensions.displayWidth) / 2;
    const offsetY = (container.clientHeight - imageDimensions.displayHeight) / 2;

    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left - offsetX) / scale,
      y: (clientY - rect.top - offsetY) / scale,
    };
  }, [scale, imageDimensions]);

  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent, type: typeof dragType) => {
    e.preventDefault();
    const pos = getEventPosition(e);
    setIsDragging(true);
    setDragType(type);
    setDragStart(pos);
  }, [getEventPosition]);

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !dragType || !crop || !photo) return;

    const pos = getEventPosition(e);
    const dx = pos.x - dragStart.x;
    const dy = pos.y - dragStart.y;

    let newCrop = { ...crop };

    if (dragType === 'move') {
      newCrop.x = Math.max(0, Math.min(crop.x + dx, photo.originalWidth - crop.width));
      newCrop.y = Math.max(0, Math.min(crop.y + dy, photo.originalHeight - crop.height));
    } else {
      const minSize = 50;
      
      if (dragType.includes('nw') || dragType.includes('sw')) {
        const newX = Math.max(0, Math.min(crop.x + dx, crop.x + crop.width - minSize));
        const widthChange = crop.x - newX;
        newCrop.x = newX;
        newCrop.width = crop.width + widthChange;
      }
      if (dragType.includes('ne') || dragType.includes('se')) {
        newCrop.width = Math.max(minSize, Math.min(crop.width + dx, photo.originalWidth - crop.x));
      }
      if (dragType.includes('nw') || dragType.includes('ne')) {
        const newY = Math.max(0, Math.min(crop.y + dy, crop.y + crop.height - minSize));
        const heightChange = crop.y - newY;
        newCrop.y = newY;
        newCrop.height = crop.height + heightChange;
      }
      if (dragType.includes('sw') || dragType.includes('se')) {
        newCrop.height = Math.max(minSize, Math.min(crop.height + dy, photo.originalHeight - crop.y));
      }
    }

    setCrop(newCrop);
    setDragStart(pos);
  }, [isDragging, dragType, crop, photo, getEventPosition, dragStart]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    setDragType(null);
  }, []);

  const handleSave = () => {
    if (photo && crop) {
      onSave(photo.id, crop);
      onClose();
    }
  };

  if (!photo) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-4 gap-4">
        <DialogHeader>
          <DialogTitle>Adjust Crop</DialogTitle>
        </DialogHeader>
        
        <div 
          ref={containerRef}
          className="flex-1 relative overflow-hidden bg-black/50 rounded-lg touch-none select-none"
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        >
          {/* Image */}
          <div 
            className="absolute inset-0 flex items-center justify-center"
          >
            <div 
              className="relative"
              style={{
                width: imageDimensions.displayWidth,
                height: imageDimensions.displayHeight,
              }}
            >
              <img
                src={photo.originalDataUrl}
                alt=""
                className="w-full h-full"
                draggable={false}
              />
              
              {/* Darkened overlay */}
              <div className="absolute inset-0 bg-black/60" />
              
              {/* Crop area */}
              {crop && (
                <>
                  {/* Clear crop area */}
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
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} className="border border-white/30" />
                      ))}
                    </div>

                    {/* Corner handles */}
                    {['nw', 'ne', 'sw', 'se'].map((corner) => (
                      <div
                        key={corner}
                        className="absolute w-5 h-5 bg-white rounded-full border-2 border-primary -translate-x-1/2 -translate-y-1/2"
                        style={{
                          left: corner.includes('e') ? '100%' : 0,
                          top: corner.includes('s') ? '100%' : 0,
                          cursor: `${corner}-resize`,
                        }}
                        onMouseDown={(e) => handlePointerDown(e, `resize-${corner}` as typeof dragType)}
                        onTouchStart={(e) => handlePointerDown(e, `resize-${corner}` as typeof dragType)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
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
