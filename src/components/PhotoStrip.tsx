import { PhotoItem } from '@/types/collage';
import { Button } from '@/components/ui/button';
import { Crop, Loader2, Wand2, Plus, Trash2 } from 'lucide-react';

interface PhotoStripProps {
  photos: PhotoItem[];
  autoCroppedCount: number;
  onViewAll: () => void;
  onAddPhotos: () => void;
  onClearAll: () => void;
  onGenerate?: () => void;
  showGenerateButton?: boolean;
  isGenerating?: boolean;
}

export function PhotoStrip({
  photos,
  autoCroppedCount,
  onViewAll,
  onAddPhotos,
  onClearAll,
  onGenerate,
  showGenerateButton,
  isGenerating,
}: PhotoStripProps) {
  return (
    <div className="space-y-3">
      {/* Header */}
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
        Photos ({photos.length})
        {autoCroppedCount > 0 && (
          <>
            <span className="mx-2 text-muted-foreground/50 normal-case">·</span>
            <span className="text-primary/80 normal-case font-normal tracking-normal">
              {autoCroppedCount} auto-cropped
            </span>
          </>
        )}
      </h3>

      {/* Photo strip - clickable to view all */}
      <button
        type="button"
        onClick={onViewAll}
        className="h-14 w-full overflow-hidden rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
      >
        <div className="flex h-full gap-0.5">
          {photos.map((photo) => (
            <img
              key={photo.id}
              src={photo.thumbnailUrl ?? photo.previewUrl ?? photo.objectUrl}
              alt=""
              className="h-full w-auto flex-shrink-0 object-cover"
            />
          ))}
        </div>
      </button>

      {/* Actions - unified row */}
      <div className="flex flex-wrap justify-center items-center gap-2">
        <Button variant="outline" size="sm" onClick={onViewAll}>
          <Crop className="h-4 w-4" />
          <span className="hidden sm:inline">Adjust </span>Crops
        </Button>
        <Button variant="outline" size="sm" onClick={onAddPhotos}>
          <Plus className="h-4 w-4" />
          <span className="sm:hidden">Add</span>
          <span className="hidden sm:inline">Add Photos</span>
        </Button>
        {showGenerateButton && onGenerate && (
          <Button size="sm" onClick={onGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Generate
          </Button>
        )}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onClearAll}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sm:hidden">Clear</span>
          <span className="hidden sm:inline">Clear All</span>
        </Button>
      </div>
    </div>
  );
}
