import { useState, useMemo, useRef } from 'react';
import ReactCrop, { type PercentCrop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import {
  PhotoItem,
  CropRegion,
  PhotoPriority,
  LabelPosition,
} from '@/types/collage';
import { clampCropToImage, getDisplayCrop } from '@/lib/cropUtils';

interface CropEditorV2Props {
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
 * CropEditorV2 — react-image-crop based editor.
 *
 * Phase 1: skeleton only. Renders the crop UI with full-image default,
 * handles edge-straddling (provided by the library), Cancel + Save in
 * the footer. Save writes a full-image crop (no real change). Used to
 * validate handle tappability on desktop and mobile before wiring real
 * state in subsequent phases.
 */
export function CropEditorV2(props: CropEditorV2Props) {
  const { photo, onClose, onSave } = props;

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

  return <CropEditorV2Inner {...props} />;
}

function CropEditorV2Inner({ photo, onClose, onSave }: CropEditorV2Props) {
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

  const hasChanges = useMemo(
    () => !samePercent(crop, initialCropRef.current),
    [crop],
  );

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
    const priority: PhotoPriority = photo.priority === 1 ? 1 : 3;
    onClose();
    onSave(photo.id, region, priority, photo.label);
  };

  // Suppress unused warning until Phase 3 wires Smart Crop's pixel-based
  // comparison off of `completedCrop`.
  void completedCrop;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-4xl w-[min(95vw,56rem)] max-h-[95vh] flex flex-col p-0 gap-0 overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
          <DialogTitle>Adjust Crop (V2)</DialogTitle>
          <DialogDescription className="sr-only">
            Drag the crop area to reposition, or drag corners to resize
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 bg-black/50 flex items-center justify-center p-4">
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
        </div>

        <div className="px-4 py-3 border-t border-border shrink-0 flex flex-wrap items-center gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}