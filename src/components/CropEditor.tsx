import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Trash2, Loader2, Sparkles, RotateCcw } from 'lucide-react';
import {
  PhotoItem,
  CropRegion,
  PhotoPriority,
  LabelPosition,
} from '@/types/collage';
import { getDisplayCrop, clampCropToImage } from '@/lib/cropUtils';
import { autoTextColor, labelAnchorStyle, getDisplayLabel } from '@/lib/labelStyle';
import { cn } from '@/lib/utils';

/**
 * Compute a safe, immediately-visible default crop. Handles must always
 * sit inside the visible image area, otherwise they render past the SVG
 * edge and become invisible/untappable.
 *
 * Rule:
 *  - If the photo has a manual/smart crop that's meaningfully inset
 *    (covers <99% of either axis), use it.
 *  - Otherwise (no crop, OR a "fail-forward" full-image smart crop),
 *    return a centered 90% inset.
 */
function getDefaultEditorCrop(photo: PhotoItem): CropRegion {
  const existing = getDisplayCrop(photo);
  const coversAll =
    !!existing &&
    existing.width >= photo.originalWidth * 0.99 &&
    existing.height >= photo.originalHeight * 0.99;
  if (existing && !coversAll) return { ...existing };
  const inset = 0.05;
  return {
    x: photo.originalWidth * inset,
    y: photo.originalHeight * inset,
    width: photo.originalWidth * (1 - inset * 2),
    height: photo.originalHeight * (1 - inset * 2),
  };
}

interface CropEditorProps {
  photo: PhotoItem;
  gapColor: string;
  labelPosition: LabelPosition;
  onClose: () => void;
  onSave: (
    photoId: string,
    crop: CropRegion,
    priority: PhotoPriority,
    label: string | undefined,
  ) => void;
  onDelete: (photoId: string) => void;
}

/**
 * CropEditor - SVG-based crop editor using viewBox coordinates.
 * Uses the same coordinate system as CroppedImage for pixel-perfect alignment.
 * All crop coordinates are in original image pixels.
 */
export function CropEditor({ photo, gapColor, labelPosition, onClose, onSave, onDelete }: CropEditorProps) {
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
  
  return <CropEditorInner photo={photo} gapColor={gapColor} labelPosition={labelPosition} onClose={onClose} onSave={onSave} onDelete={onDelete} />;
}

/**
 * Inner CropEditor component with all hooks - only rendered when dimensions are valid.
 */
function CropEditorInner({ photo, gapColor, labelPosition, onClose, onSave, onDelete }: CropEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Compute the default crop ONCE per mount and reuse for state, change-detection, and reset.
  const defaultCropRef = useRef<CropRegion>(getDefaultEditorCrop(photo));
  const [crop, setCrop] = useState<CropRegion>(() => defaultCropRef.current);
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se' | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropStart, setCropStart] = useState<CropRegion | null>(null);
  
  // Hero toggle state - initialized from photo.priority
  const [isHero, setIsHero] = useState(photo.priority === 1);
  
  const initialIsHero = useRef(photo.priority === 1);

  // Label state — three-valued:
  //   undefined → "use suggestion" (no explicit override)
  //   ''        → user explicitly cleared
  //   string    → user-provided label
  const suggestedLabel = photo.suggestedLabel ?? '';
  const [label, setLabel] = useState<string | undefined>(photo.label);
  const initialLabelRef = useRef<string | undefined>(photo.label);
  const displayedLabel = label !== undefined ? label : suggestedLabel;
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(displayedLabel);
  const labelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingLabel) {
      // Defer to ensure input is mounted
      requestAnimationFrame(() => {
        labelInputRef.current?.focus();
        labelInputRef.current?.select();
      });
    }
  }, [editingLabel]);

  const beginEditLabel = useCallback(() => {
    setLabelDraft(displayedLabel);
    setEditingLabel(true);
  }, [displayedLabel]);

  const commitLabel = useCallback(() => {
    setLabel(labelDraft);
    setEditingLabel(false);
  }, [labelDraft]);

  const cancelLabelEdit = useCallback(() => {
    setLabelDraft(displayedLabel);
    setEditingLabel(false);
  }, [displayedLabel]);

  const revertLabelToSuggestion = useCallback(() => {
    setLabel(undefined);
    setLabelDraft(suggestedLabel);
    setEditingLabel(false);
  }, [suggestedLabel]);
  
  // Detect if any changes were made
  const hasChanges = useMemo(() => {
    const initial = defaultCropRef.current;
    const cropChanged = 
      crop.x !== initial.x ||
      crop.y !== initial.y ||
      crop.width !== initial.width ||
      crop.height !== initial.height;
    
    const heroChanged = isHero !== initialIsHero.current;
    const labelChanged = label !== initialLabelRef.current;

    return cropChanged || heroChanged || labelChanged;
  }, [crop, isHero, label]);

  // Single source of truth for viewScale: measured before paint via
  // useLayoutEffect (so handles are sized correctly on first frame),
  // then kept in sync with size changes by a ResizeObserver.
  // Initialize to 0 (sentinel) — handles use a CSS-pixel fallback until
  // the first measurement lands.
  const [viewScale, setViewScale] = useState(0);
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg || photo.originalWidth === 0) return;
    const measure = () => {
      const rect = svg.getBoundingClientRect();
      if (rect.width > 0) setViewScale(rect.width / photo.originalWidth);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(svg);
    return () => ro.disconnect();
  }, [photo.originalWidth]);

  // Single coordinate conversion: client -> SVG viewBox. Used by both pointerdown
  // (on the HTML overlay) and window-level pointermove.
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

  // Window-level pointer tracking: keeps drags alive when the finger leaves
  // the overlay, and avoids relying on setPointerCapture (flaky in WebKit).
  // No stopPropagation: window-level events don't reach Radix's portal anyway.
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
    // If the label input is still focused (user clicked Save without
    // blurring), prefer the in-flight draft over committed state.
    const finalLabel: string | undefined = editingLabel
      ? labelDraft.trim()
      : (label === undefined ? undefined : label.trim());
    // Close immediately for responsiveness
    onClose();
    // State update happens after close - user doesn't see the delay
    onSave(photo.id, crop, priority, finalLabel);
  };
  
  const handleApplySmartCrop = useCallback(() => {
    if (photo.smartCrop) {
      setCrop({ ...photo.smartCrop });
    }
  }, [photo.smartCrop]);

  const handleReset = useCallback(() => {
    setCrop({ ...defaultCropRef.current });
  }, []);
  
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

  // Fixed screen-pixel sizes for consistent visuals regardless of image
  // resolution. Until we've measured the SVG (viewScale === 0), fall back
  // to a generous estimate based on photo size so handles aren't tiny.
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const targetHandlePx = isTouchDevice ? 22 : 12;
  const targetHitAreaPx = 72;
  const targetStrokePx = 2;
  // Pre-measure fallback: assume the photo will display at ~min(viewport,
  // originalWidth). This errs on the side of larger handles, never tinier.
  const fallbackScale =
    typeof window !== 'undefined' && photo.originalWidth > 0
      ? Math.min(window.innerWidth * 0.9, photo.originalWidth) / photo.originalWidth
      : 1;
  const effectiveScale = viewScale > 0 ? viewScale : fallbackScale;
  const handleSize = targetHandlePx / effectiveScale;
  const hitAreaSize = targetHitAreaPx / effectiveScale;
  const strokeWidth = targetStrokePx / effectiveScale;
  
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

  // Single pointerdown entry point. The overlay is the only event surface;
  // SVG is render-only. Decide move-vs-resize by hit-testing crop corners.
  const handleOverlayPointerDown = useCallback((e: React.PointerEvent) => {
    // Pointerdown with preventDefault below stops the browser from blurring
    // the label input, so commit any in-flight draft manually first.
    if (editingLabel) commitLabel();
    e.preventDefault();
    const pos = clientToSvg(e.clientX, e.clientY);
    const corner = getCornerId(pos.x, pos.y);
    const type: typeof dragType = corner ? `resize-${corner}` : 'move';
    setIsDragging(true);
    setDragType(type);
    setDragStart(pos);
    setCropStart({ ...crop });
  }, [clientToSvg, getCornerId, crop, editingLabel, commitLabel]);

  // Offset handles inward when at image edges so they're fully visible
  const getHandlePosition = (corner: 'nw' | 'ne' | 'sw' | 'se') => {
    const cx = corner.includes('e') ? crop.x + crop.width : crop.x;
    const cy = corner.includes('s') ? crop.y + crop.height : crop.y;
    return { cx, cy };
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-4xl w-[min(95vw,56rem)] max-h-[95vh] flex flex-col p-0 gap-0 overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
        // Pointerdowns inside the dialog don't trigger Radix's outside-close
        // logic, so we don't need to block them. Keeping outside-close intact
        // means tapping the backdrop still closes the dialog.
      >
        <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
          <DialogTitle>Adjust Crop</DialogTitle>
          <DialogDescription className="sr-only">
            Drag the crop area to reposition, or drag corners to resize
          </DialogDescription>
        </DialogHeader>
        
        {/* Sizing: stage claims remaining flex height; wrapper inside uses
            CSS aspect-ratio against bounded parent dimensions. SVG renders
            at 100% of the wrapper; the HTML overlay (needed for WebKit
            hit-testing) is an absolute sibling matching the same box. */}
        <div className="flex-1 min-h-0 bg-black/50 flex items-center justify-center p-4">
          <div
            className="relative"
            style={{
              aspectRatio: `${photo.originalWidth} / ${photo.originalHeight}`,
              maxWidth: `min(100%, ${photo.originalWidth}px)`,
              maxHeight: `min(100%, ${photo.originalHeight}px)`,
              width: '100%',
              height: '100%',
              touchAction: 'none',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
          >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${photo.originalWidth} ${photo.originalHeight}`}
            preserveAspectRatio="xMidYMid meet"
            overflow="visible"
            className="block w-full h-full select-none"
            style={{
              pointerEvents: 'none',
              overflow: 'visible',
            }}
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
              // Kill iOS native image-drag, which otherwise hijacks the first
              // touch on the image and prevents our crop handlers from firing.
              style={{ WebkitUserDrag: 'none', userSelect: 'none' } as React.CSSProperties}
              onDragStart={(e) => e.preventDefault()}
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
          {/* HTML interaction overlay — the only event surface. Covers the
              entire SVG box. Plain DOM hit-tests reliably on every browser
              (iOS WebKit's SVG hit-testing is flaky with transparent fills). */}
          <div
            ref={overlayRef}
            className="absolute inset-0 cursor-move"
            style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
            onPointerDown={handleOverlayPointerDown}
            onDragStart={(e) => e.preventDefault()}
            draggable={false}
          />
          {/* In-place label editor — positioned over the cropped region at
              the configured label anchor, so the user sees exactly where
              the label will appear in the final collage. */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${(crop.x / photo.originalWidth) * 100}%`,
              top: `${(crop.y / photo.originalHeight) * 100}%`,
              width: `${(crop.width / photo.originalWidth) * 100}%`,
              height: `${(crop.height / photo.originalHeight) * 100}%`,
            }}
          >
            <div
              style={{
                ...labelAnchorStyle(labelPosition),
                maxWidth: 'calc(100% - 12px)',
                display: 'flex',
                alignItems: 'stretch',
                gap: 4,
              }}
              className="pointer-events-auto"
            >
              {editingLabel ? (
                <input
                  ref={labelInputRef}
                  value={labelDraft}
                  maxLength={32}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  onBlur={commitLabel}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitLabel(); }
                    else if (e.key === 'Escape') { e.preventDefault(); cancelLabelEdit(); }
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    backgroundColor: gapColor,
                    color: autoTextColor(gapColor),
                    padding: '2px 8px',
                    fontSize: 13,
                    lineHeight: 1.2,
                    fontWeight: 600,
                    border: 'none',
                    outline: 'none',
                    minWidth: 80,
                    maxWidth: '100%',
                    textAlign: 'center',
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={beginEditLabel}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    backgroundColor: gapColor,
                    color: displayedLabel ? autoTextColor(gapColor) : `${autoTextColor(gapColor)}99`,
                    padding: '2px 8px',
                    fontSize: 13,
                    lineHeight: 1.2,
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'text',
                    fontStyle: displayedLabel ? 'normal' : 'italic',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'block',
                    textAlign: 'center',
                  }}
                  title="Click to edit label"
                >
                  {displayedLabel || 'Add label'}
                </button>
              )}
              {suggestedLabel && (editingLabel ? labelDraft : displayedLabel) !== suggestedLabel && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={revertLabelToSuggestion}
                  style={{
                    backgroundColor: gapColor,
                    color: autoTextColor(gapColor),
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0 6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title={`Reset to "${suggestedLabel}"`}
                  aria-label="Reset label to date from photo"
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </div>
          </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-border shrink-0 flex flex-wrap items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleDelete}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 sm:w-auto sm:px-3"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">Delete</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleReset}
            className="sm:w-auto sm:px-3"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5">Reset</span>
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
