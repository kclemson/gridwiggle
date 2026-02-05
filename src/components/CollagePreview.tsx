import { useRef, useState, useCallback } from 'react';
import { PhotoItem, CollageLayout, CollageCell } from '@/types/collage';
import { getDisplayCrop } from '@/lib/cropUtils';
import { CroppedImage } from '@/components/common/CroppedImage';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';

interface CollagePreviewProps {
  photos: PhotoItem[];
  layout: CollageLayout;
  gapColor: string;
  onSwapPhotos: (photoId1: string, photoId2: string) => void;
  onCellClick?: (photoId: string) => void;
  onToggleHero?: (photoId: string) => void;
}

/**
 * CollagePreview - Uses CSS-based sizing with aspect-ratio.
 * No useEffect needed for dimensions - browser handles layout.
 * Scale is computed on-demand from actual rendered dimensions.
 */
export function CollagePreview({ 
  photos, 
  layout, 
  gapColor, 
  onSwapPhotos,
  onCellClick,
  onToggleHero,
}: CollagePreviewProps) {
  const collageRef = useRef<HTMLDivElement>(null); // Kept for potential future use (e.g., exporting)
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

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
    // Don't start drag if touching an interactive element (like the star button)
    const target = e.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }
    
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


  // Calculate max width that ensures height stays ≤ 500px
  const maxPreviewHeight = 500;
  const aspectRatio = layout.width / layout.height;
  const heightConstrainedWidth = maxPreviewHeight * aspectRatio;
  const effectiveMaxWidth = Math.min(layout.width, heightConstrainedWidth);

  return (
    <div 
      className="w-full overflow-hidden"
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* CSS handles responsive scaling via max-width and aspect-ratio */}
      <div
        ref={collageRef}
        className="relative mx-auto"
        style={{
          maxWidth: effectiveMaxWidth,
          width: '100%',
          aspectRatio: `${layout.width} / ${layout.height}`,
          backgroundColor: gapColor,
        }}
      >
        {layout.cells.map((cell) => {
          const photo = getPhotoForCell(cell);
          if (!photo) return null;

          const crop = getDisplayCrop(photo);
          const isBeingDragged = draggingId === photo.id || touchDragId === photo.id;
          const isDragTarget = dragOver === photo.id;

          return (
            <div
              key={cell.photoId}
              data-photo-id={photo.id}
              className={cn(
                "absolute overflow-hidden cursor-grab active:cursor-grabbing transition-all group",
                isBeingDragged && "opacity-50 scale-95",
                isDragTarget && "ring-4 ring-primary ring-offset-2 ring-offset-background"
              )}
              style={{
                left: `${(cell.x / layout.width) * 100}%`,
                top: `${(cell.y / layout.height) * 100}%`,
                width: `${(cell.width / layout.width) * 100}%`,
                height: `${(cell.height / layout.height) * 100}%`,
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
              <CroppedImage
                src={photo.objectUrl}
                crop={crop}
                originalWidth={photo.originalWidth}
                originalHeight={photo.originalHeight}
                fit="cover"
              />
              
              {/* Hero toggle button - appears on hover, always visible on mobile */}
              {!isBeingDragged && onToggleHero && (
                <button
                  className={cn(
                    "absolute top-2 right-2 z-10 p-1.5 rounded-full transition-all",
                    "bg-background/60 hover:bg-background/80",
                    photo.priority === 1 
                      ? "opacity-100"  // Hero star always fully visible for screenshots
                      : "opacity-70 md:opacity-0 md:group-hover:opacity-100",  // Non-hero: hover on desktop
                    "touch-manipulation"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleHero(photo.id);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  draggable={false}
                  aria-label={photo.priority === 1 ? "Remove hero status" : "Mark as hero"}
                >
                  <Star 
                    className={cn(
                      "h-4 w-4",
                      photo.priority === 1 
                        ? "fill-amber-400 text-amber-400" 
                        : "text-muted-foreground"
                    )} 
                  />
                </button>
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
              src={photos.find((p) => p.id === touchDragId)!.objectUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          )}
        </div>
      )}
    </div>
  );
}
