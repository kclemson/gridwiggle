import { useRef, useState, useCallback, useMemo, memo, useEffect } from 'react';
import { PhotoItem, CollageLayout, CollageCell, LabelPosition } from '@/types/collage';
import { getDisplayCrop } from '@/lib/cropUtils';
import { CroppedImage } from '@/components/common/CroppedImage';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';
import { isMobileDevice } from '@/lib/platform';
import { autoTextColor, labelAnchorStyle } from '@/lib/labelStyle';

interface CollageCellProps {
  cell: CollageCell;
  photo: PhotoItem;
  layoutWidth: number;
  layoutHeight: number;
  gapColor: string;
  labelsEnabled: boolean;
  labelPosition: LabelPosition;
  isBeingDragged: boolean;
  isDragTarget: boolean;
  onDragStart: (e: React.DragEvent, photoId: string) => void;
  onDragOver: (e: React.DragEvent, photoId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, photoId: string) => void;
  onDragEnd: () => void;
  onPointerDown: (e: React.PointerEvent, photoId: string) => void;
  onToggleHero?: (photoId: string) => void;
}

/**
 * Memoized cell component to prevent unnecessary re-renders.
 * Each cell only re-renders when its specific props change.
 */
const CollageCellComponent = memo(function CollageCellComponent({
  cell,
  photo,
  layoutWidth,
  layoutHeight,
  gapColor,
  labelsEnabled,
  labelPosition,
  isBeingDragged,
  isDragTarget,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onPointerDown,
  onToggleHero,
}: CollageCellProps) {
  const crop = getDisplayCrop(photo);
  const mobile = isMobileDevice();

  return (
    <div
      data-photo-id={photo.id}
      className={cn(
        "absolute overflow-hidden group",
        !mobile && "cursor-grab active:cursor-grabbing",
        isBeingDragged && "opacity-50 scale-95",
        isDragTarget && "ring-4 ring-primary ring-offset-2 ring-offset-background"
      )}
      style={{
        left: `${(cell.x / layoutWidth) * 100}%`,
        top: `${(cell.y / layoutHeight) * 100}%`,
        width: `${(cell.width / layoutWidth) * 100}%`,
        height: `${(cell.height / layoutHeight) * 100}%`,
        willChange: isBeingDragged ? 'transform, opacity' : 'auto',
        containerType: 'size',
      }}
      draggable={!mobile}
      onDragStart={(e) => onDragStart(e, photo.id)}
      onDragOver={(e) => onDragOver(e, photo.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, photo.id)}
      onDragEnd={onDragEnd}
      onPointerDown={(e) => onPointerDown(e, photo.id)}
    >
      <CroppedImage
        src={photo.objectUrl}
        previewSrc={photo.previewUrl}
        thumbnailSrc={photo.thumbnailUrl}
        crop={crop}
        originalWidth={photo.originalWidth}
        originalHeight={photo.originalHeight}
        fit="cover"
      />

      {labelsEnabled && (photo.label ?? photo.suggestedLabel) && (
        <div
          className="pointer-events-none font-semibold whitespace-nowrap overflow-hidden text-ellipsis"
          style={{
            ...labelAnchorStyle(labelPosition),
            backgroundColor: gapColor,
            color: autoTextColor(gapColor),
            fontSize: 'var(--label-font-size, max(11px, 1.6cqmin))',
            maxWidth: '100%',
            padding: '2px 8px',
            lineHeight: 1.2,
          }}
        >
          {photo.label ?? photo.suggestedLabel}
        </div>
      )}
      
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
          onPointerDown={(e) => e.stopPropagation()}
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
});

interface CollagePreviewProps {
  photos: PhotoItem[];
  layout: CollageLayout;
  gapColor: string;
  labelsEnabled: boolean;
  labelPosition: LabelPosition;
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
  labelsEnabled,
  labelPosition,
  onSwapPhotos,
  onCellClick,
  onToggleHero,
}: CollagePreviewProps) {
  
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  // O(1) photo lookup instead of O(n) find() on each cell render
  const photoMap = useMemo(() => 
    new Map(photos.map(p => [p.id, p])), 
    [photos]
  );

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

  // Unified pointer gesture state machine — one model for both tap (open
  // editor) and hold (swap-drag). Replaces the previous split between
  // onTouchStart/onTouchMove/onTouchEnd and a competing onClick handler,
  // which caused the "third tap" bug on mobile (long-ish taps were eaten
  // by the hold timer before the click could fire).
  const [touchDragId, setTouchDragId] = useState<string | null>(null);
  const [touchPosition, setTouchPosition] = useState({ x: 0, y: 0 });
  const gestureRef = useRef<{
    photoId: string;
    startX: number;
    startY: number;
    pointerType: string;
    timer: number | null;
    activated: boolean;
    cancelled: boolean;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const HOLD_THRESHOLD_MS = 250;
  const MOVE_THRESHOLD_PX = 8;
  const TAP_MAX_MS = 500;          // Upper bound for what counts as a tap

  const clearGesture = useCallback(() => {
    const g = gestureRef.current;
    if (g?.timer != null) clearTimeout(g.timer);
    gestureRef.current = null;
  }, []);

  // pointerdown on a cell — touch OR mouse OR pen. Only the primary button.
  const handleCellPointerDown = useCallback((e: React.PointerEvent, photoId: string) => {
    // Ignore secondary mouse buttons.
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Don't intercept gestures on interactive elements (star button).
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    // For mouse, the native HTML5 drag system handles swap; we still want a
    // tap to open the editor on plain click, so we register the gesture but
    // skip the hold timer.
    const isPointerDrag = e.pointerType !== 'mouse';

    clearGesture();
    gestureRef.current = {
      photoId,
      startX: e.clientX,
      startY: e.clientY,
      pointerType: e.pointerType,
      timer: null,
      activated: false,
      cancelled: false,
    };

    if (isPointerDrag) {
      gestureRef.current.timer = window.setTimeout(() => {
        const g = gestureRef.current;
        if (!g || g.cancelled) return;
        g.activated = true;
        setTouchDragId(g.photoId);
        setTouchPosition({ x: g.startX, y: g.startY });
        document.body.style.overflow = 'hidden';
        if (navigator.vibrate) navigator.vibrate(50);
      }, HOLD_THRESHOLD_MS);
    }
  }, [clearGesture]);

  // Container-level pointermove. Tracks all in-flight gestures.
  const handleContainerPointerMove = useCallback((e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g) return;
    if (g.activated) {
      setTouchPosition({ x: e.clientX, y: e.clientY });
      return;
    }
    const dx = Math.abs(e.clientX - g.startX);
    const dy = Math.abs(e.clientY - g.startY);
    if (dx > MOVE_THRESHOLD_PX || dy > MOVE_THRESHOLD_PX) {
      // Movement before activation -> treat as scroll, abandon gesture.
      g.cancelled = true;
      clearGesture();
    }
  }, [clearGesture]);

  // Container-level pointerup/cancel. Decides tap vs swap vs nothing.
  const handleContainerPointerEnd = useCallback((e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g) return;

    if (g.activated) {
      // Was a hold-drag. Resolve swap target.
      document.body.style.overflow = '';
      const element = document.elementFromPoint(e.clientX, e.clientY);
      const cellElement = element?.closest('[data-photo-id]');
      const targetId = cellElement?.getAttribute('data-photo-id');
      if (targetId && targetId !== g.photoId) {
        onSwapPhotos(g.photoId, targetId);
      }
      setTouchDragId(null);
    } else if (!g.cancelled && e.type !== 'pointercancel') {
      // Quick release without movement -> tap. Open editor.
      const dx = Math.abs(e.clientX - g.startX);
      const dy = Math.abs(e.clientY - g.startY);
      if (dx <= MOVE_THRESHOLD_PX && dy <= MOVE_THRESHOLD_PX) {
        onCellClick?.(g.photoId);
      }
    }
    clearGesture();
  }, [onSwapPhotos, onCellClick, clearGesture]);

  // Block native page scroll only while an active hold-drag is in flight.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const onTouchMoveNative = (e: TouchEvent) => {
      if (touchDragId) e.preventDefault();
    };
    node.addEventListener('touchmove', onTouchMoveNative, { passive: false });
    return () => node.removeEventListener('touchmove', onTouchMoveNative);
  }, [touchDragId]);

  // Safety: if the component unmounts mid-drag, restore body scroll.
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
      const g = gestureRef.current;
      if (g?.timer != null) clearTimeout(g.timer);
    };
  }, []);

  // Calculate max width that ensures height stays ≤ 500px
  // Layout dimensions already include border padding from algorithm
  const maxPreviewHeight = 500;
  const aspectRatio = layout.width / layout.height;
  const heightConstrainedWidth = maxPreviewHeight * aspectRatio;
  const effectiveMaxWidth = Math.min(layout.width, heightConstrainedWidth);

  return (
    <div 
      ref={containerRef}
      className="w-full overflow-hidden"
      onPointerMove={handleContainerPointerMove}
      onPointerUp={handleContainerPointerEnd}
      onPointerCancel={handleContainerPointerEnd}
      style={{
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {/* CSS handles responsive scaling via max-width and aspect-ratio */}
      <div
        
        className="relative mx-auto"
        style={{
          maxWidth: effectiveMaxWidth,
          width: '100%',
          aspectRatio: `${layout.width} / ${layout.height}`,
          backgroundColor: gapColor,
          containerType: 'size',
          // Single label font size for the whole collage so all labels match.
          ['--label-font-size' as any]: 'clamp(11px, 1.8cqmin, 28px)',
          // No padding needed - layout includes border in coordinates
        }}
      >
        {layout.cells.map((cell) => {
          const photo = photoMap.get(cell.photoId);
          if (!photo) return null;

          const isBeingDragged = draggingId === photo.id || touchDragId === photo.id;
          const isDragTarget = dragOver === photo.id;

          return (
            <CollageCellComponent
              key={cell.photoId}
              cell={cell}
              photo={photo}
              layoutWidth={layout.width}
              layoutHeight={layout.height}
              gapColor={gapColor}
              labelsEnabled={labelsEnabled}
              labelPosition={labelPosition}
              isBeingDragged={isBeingDragged}
              isDragTarget={isDragTarget}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onPointerDown={handleCellPointerDown}
              onToggleHero={onToggleHero}
            />
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
          {photoMap.get(touchDragId) && (
            <img
              src={photoMap.get(touchDragId)!.thumbnailUrl ?? photoMap.get(touchDragId)!.previewUrl ?? photoMap.get(touchDragId)!.objectUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          )}
        </div>
      )}
    </div>
  );
}
