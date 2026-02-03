import { useRef, useState, useCallback, useEffect } from 'react';
import { PhotoItem, CollageLayout, CollageCell } from '@/types/collage';
import { getActiveCrop, loadImage, getCroppedImageDataUrl } from '@/lib/imageUtils';
import { cn } from '@/lib/utils';

interface CollagePreviewProps {
  photos: PhotoItem[];
  layout: CollageLayout;
  gapColor: string;
  onSwapPhotos: (photoId1: string, photoId2: string) => void;
  onCellClick?: (photoId: string) => void;
}

export function CollagePreview({ 
  photos, 
  layout, 
  gapColor, 
  onSwapPhotos,
  onCellClick 
}: CollagePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  // Calculate display scale
  useEffect(() => {
    const updateScale = () => {
      const container = containerRef.current;
      if (!container) return;

      const maxWidth = container.clientWidth;
      const maxHeight = container.clientHeight || 600;
      const scaleX = maxWidth / layout.width;
      const scaleY = maxHeight / layout.height;
      setScale(Math.min(scaleX, scaleY, 1));
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [layout.width, layout.height]);

  const handleDragStart = useCallback((e: React.DragEvent, photoId: string) => {
    setDraggingId(photoId);
    e.dataTransfer.setData('text/plain', photoId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, photoId: string) => {
    e.preventDefault();
    if (draggingId && draggingId !== photoId) {
      setDragOver(photoId);
    }
  }, [draggingId]);

  const handleDragLeave = useCallback(() => {
    setDragOver(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    if (sourceId && sourceId !== targetId) {
      onSwapPhotos(sourceId, targetId);
    }
    setDraggingId(null);
    setDragOver(null);
  }, [onSwapPhotos]);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOver(null);
  }, []);

  // Touch drag support
  const [touchDragId, setTouchDragId] = useState<string | null>(null);
  const [touchPosition, setTouchPosition] = useState({ x: 0, y: 0 });

  const handleTouchStart = useCallback((e: React.TouchEvent, photoId: string) => {
    const touch = e.touches[0];
    setTouchDragId(photoId);
    setTouchPosition({ x: touch.clientX, y: touch.clientY });
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchDragId) return;
    const touch = e.touches[0];
    setTouchPosition({ x: touch.clientX, y: touch.clientY });
  }, [touchDragId]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchDragId) return;

    // Find the cell under the touch end position
    const touch = e.changedTouches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const cellElement = element?.closest('[data-photo-id]');
    const targetId = cellElement?.getAttribute('data-photo-id');

    if (targetId && targetId !== touchDragId) {
      onSwapPhotos(touchDragId, targetId);
    }

    setTouchDragId(null);
  }, [touchDragId, onSwapPhotos]);

  const getPhotoForCell = (cell: CollageCell) => {
    return photos.find((p) => p.id === cell.photoId);
  };

  return (
    <div 
      ref={containerRef}
      className="w-full overflow-hidden"
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="relative mx-auto"
        style={{
          width: layout.width * scale,
          height: layout.height * scale,
          backgroundColor: gapColor,
        }}
      >
        {layout.cells.map((cell) => {
          const photo = getPhotoForCell(cell);
          if (!photo) return null;

          const crop = getActiveCrop(photo);
          const isBeingDragged = draggingId === photo.id || touchDragId === photo.id;
          const isDragTarget = dragOver === photo.id;

          return (
            <div
              key={cell.photoId}
              data-photo-id={photo.id}
              className={cn(
                "absolute overflow-hidden cursor-grab active:cursor-grabbing transition-all",
                isBeingDragged && "opacity-50 scale-95",
                isDragTarget && "ring-4 ring-primary ring-offset-2 ring-offset-background"
              )}
              style={{
                left: cell.x * scale,
                top: cell.y * scale,
                width: cell.width * scale,
                height: cell.height * scale,
              }}
              draggable
              onDragStart={(e) => handleDragStart(e, photo.id)}
              onDragOver={(e) => handleDragOver(e, photo.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, photo.id)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(e, photo.id)}
              onClick={() => onCellClick?.(photo.id)}
            >
              {crop ? (
                <div className="w-full h-full relative overflow-hidden">
                  <img
                    src={photo.originalDataUrl}
                    alt=""
                    className="absolute"
                    style={{
                      width: `${(photo.originalWidth / crop.width) * 100}%`,
                      height: `${(photo.originalHeight / crop.height) * 100}%`,
                      left: `${(-crop.x / crop.width) * 100}%`,
                      top: `${(-crop.y / crop.height) * 100}%`,
                    }}
                    draggable={false}
                  />
                </div>
              ) : (
                <img
                  src={photo.originalDataUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Touch drag preview */}
      {touchDragId && (
        <div
          className="fixed pointer-events-none z-50 opacity-75 shadow-2xl rounded-lg overflow-hidden"
          style={{
            left: touchPosition.x - 50,
            top: touchPosition.y - 50,
            width: 100,
            height: 100,
          }}
        >
          {photos.find((p) => p.id === touchDragId) && (
            <img
              src={photos.find((p) => p.id === touchDragId)!.originalDataUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          )}
        </div>
      )}
    </div>
  );
}
