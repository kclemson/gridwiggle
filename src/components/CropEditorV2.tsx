import { useState, useMemo } from 'react';
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
import { clampCropToImage } from '@/lib/cropUtils';

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
  // Seed: full-image crop in percent units.
  const [crop, setCrop] = useState<PercentCrop | undefined>({
    unit: '%',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | undefined>();

  const imgMaxHeight = useMemo(
    () => (typeof window !== 'undefined' && window.innerHeight < 700 ? '40vh' : '60vh'),
    [],
  );

  const handleSave = () => {
    // Phase 1: ship a full-image crop regardless of UI state, so the
    // round-trip works without the real save logic wired yet.
    const region: CropRegion = clampCropToImage(
      { x: 0, y: 0, width: photo.originalWidth, height: photo.originalHeight },
      photo.originalWidth,
      photo.originalHeight,
    );
    const priority: PhotoPriority = photo.priority === 1 ? 1 : 3;
    onClose();
    onSave(photo.id, region, priority, photo.label);
  };

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
          <Button size="sm" onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}