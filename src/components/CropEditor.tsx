import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import ReactCrop, { type PercentCrop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Trash2, RotateCcw, Sparkles } from 'lucide-react';
import {
  PhotoItem,
  CropRegion,
  PhotoPriority,
  LabelPosition,
} from '@/types/collage';
import { clampCropToImage, getDisplayCrop } from '@/lib/cropUtils';
import { autoTextColor, labelAnchorStyle } from '@/lib/labelStyle';

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
 * CropEditor — react-image-crop based editor.
 *
 * Phase 1: skeleton only. Renders the crop UI with full-image default,
 * handles edge-straddling (provided by the library), Cancel + Save in
 * the footer. Save writes a full-image crop (no real change). Used to
 * validate handle tappability on desktop and mobile before wiring real
 * state in subsequent phases.
 */
export function CropEditor(props: CropEditorProps) {
  const { photo, onClose } = props;

  // 0-dimension loading guard (matches V1).
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

  return <CropEditorInner {...props} />;
}

function CropEditorInner({ photo, gapColor, labelPosition, onClose, onSave, onDelete }: CropEditorProps) {
  // Seed: prefer existing crop (smart or manual) unless it covers ≥99% of
  // both axes (fail-forward sentinel from getDisplayCrop), in which case
  // we show a full-image selection so Save is a no-op by default.
  const initialCrop = useMemo<PercentCrop>(() => {
    const existing = getDisplayCrop(photo);
    const coversAll =
      !!existing &&
      existing.width >= photo.originalWidth * 0.99 &&
      existing.height >= photo.originalHeight * 0.99;
    if (existing && !coversAll) {
      return {
        unit: '%',
        x: (existing.x / photo.originalWidth) * 100,
        y: (existing.y / photo.originalHeight) * 100,
        width: (existing.width / photo.originalWidth) * 100,
        height: (existing.height / photo.originalHeight) * 100,
      };
    }
    return { unit: '%', x: 0, y: 0, width: 100, height: 100 };
  }, [photo]);

  const initialCropRef = useRef<PercentCrop>(initialCrop);
  const [crop, setCrop] = useState<PercentCrop | undefined>(initialCrop);
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | undefined>();

  const [isHero, setIsHero] = useState(photo.priority === 1);
  const initialIsHero = useRef(photo.priority === 1);

  // Label state — three-valued (matches V1):
  //   undefined → "use suggestion"
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

  const imgMaxHeight = useMemo(
    () => (typeof window !== 'undefined' && window.innerHeight < 700 ? '40vh' : '60vh'),
    [],
  );

  // Float-tolerant percent comparison.
  const EPS = 0.01;
  const samePercent = (a: PercentCrop | undefined, b: PercentCrop) =>
    !!a &&
    Math.abs(a.x - b.x) < EPS &&
    Math.abs(a.y - b.y) < EPS &&
    Math.abs(a.width - b.width) < EPS &&
    Math.abs(a.height - b.height) < EPS;

  const cropChanged = !samePercent(crop, initialCropRef.current);
  const heroChanged = isHero !== initialIsHero.current;
  const labelChanged = label !== initialLabelRef.current;
  const hasChanges = cropChanged || heroChanged || labelChanged;

  const handleSave = () => {
    // Prefer the live percent crop (more accurate than the last completed
    // pixel crop in edge cases like Reset/Apply Smart Crop, which set
    // percent but don't trigger onComplete).
    const W = photo.originalWidth;
    const H = photo.originalHeight;
    const pct = crop ?? initialCropRef.current;
    const raw: CropRegion = {
      x: Math.round((pct.x / 100) * W),
      y: Math.round((pct.y / 100) * H),
      width: Math.round((pct.width / 100) * W),
      height: Math.round((pct.height / 100) * H),
    };
    const region = clampCropToImage(raw, W, H);
    const priority: PhotoPriority = isHero ? 1 : 3;
    // If the user is mid-edit, commit the draft into the saved value.
    const finalLabel: string | undefined = editingLabel
      ? labelDraft.trim()
      : label;
    onClose();
    onSave(photo.id, region, priority, finalLabel);
  };

  void completedCrop;

  // ── Reset / Smart Crop / Delete ────────────────────────────────────
  const FULL_IMAGE_CROP: PercentCrop = { unit: '%', x: 0, y: 0, width: 100, height: 100 };
  const handleReset = () => setCrop(FULL_IMAGE_CROP);
  const isFullImage = samePercent(crop, FULL_IMAGE_CROP);

  const smartCropPercent = useMemo<PercentCrop | null>(() => {
    if (!photo.smartCrop) return null;
    return {
      unit: '%',
      x: (photo.smartCrop.x / photo.originalWidth) * 100,
      y: (photo.smartCrop.y / photo.originalHeight) * 100,
      width: (photo.smartCrop.width / photo.originalWidth) * 100,
      height: (photo.smartCrop.height / photo.originalHeight) * 100,
    };
  }, [photo.smartCrop, photo.originalWidth, photo.originalHeight]);

  const handleApplySmartCrop = () => {
    if (smartCropPercent) setCrop(smartCropPercent);
  };

  const isSmartCropActive = !!smartCropPercent && samePercent(crop, smartCropPercent);

  const handleDelete = () => onDelete(photo.id);

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-4xl w-[min(95vw,56rem)] max-h-[95vh] flex flex-col p-0 gap-0 overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
          <DialogTitle className="sr-only">Edit photo</DialogTitle>
          <DialogDescription className="sr-only">
            Drag the crop area to reposition, or drag corners to resize
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 bg-black/50 flex items-center justify-center p-4">
          <div className="relative inline-block max-h-full">
            <ReactCrop
              crop={crop}
              onChange={(_pixel, percent) => setCrop(percent)}
              onComplete={(pixel) => setCompletedCrop(pixel)}
              minWidth={50}
              minHeight={50}
              ruleOfThirds
              style={{ touchAction: 'none', maxHeight: '100%' }}
            >
              <img
                src={photo.previewUrl ?? photo.objectUrl}
                alt=""
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                style={{
                  touchAction: 'none',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  WebkitUserDrag: 'none',
                  display: 'block',
                  maxWidth: `min(100%, ${photo.originalWidth}px)`,
                  maxHeight: imgMaxHeight,
                } as React.CSSProperties}
              />
            </ReactCrop>

            {/* Label overlay — anchored inside the crop rect, previewing
                how the label appears in the final collage. */}
            {crop && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${crop.x}%`,
                  top: `${crop.y}%`,
                  width: `${crop.width}%`,
                  height: `${crop.height}%`,
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
                      aria-label="Reset label to suggested value"
                    >
                      <RotateCcw size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}
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
            disabled={isFullImage}
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