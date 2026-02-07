import { useMemo } from 'react';
import { PhotoItem } from '@/types/collage';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { PhotoProgressDots } from './PhotoProgressDots';

interface PhotoProcessingViewProps {
  photos: PhotoItem[];
  currentlyProcessingId: string | null;
}

export function PhotoProcessingView({
  photos,
  currentlyProcessingId,
}: PhotoProcessingViewProps) {
  const stats = useMemo(() => {
    const completed = photos.filter(p => !p.isProcessing && !p.error).length;
    const errors = photos.filter(p => p.error).length;
    const processing = photos.filter(p => p.isProcessing).length;
    return { completed, errors, processing, total: photos.length };
  }, [photos]);

  const currentPhoto = currentlyProcessingId 
    ? photos.find(p => p.id === currentlyProcessingId) 
    : null;

  return (
    <div className="space-y-4">

      {/* Current photo thumbnail */}
      {currentPhoto && (
        <div className="flex justify-center">
          <div className="relative w-32 h-32 rounded-lg overflow-hidden bg-muted">
            <img
              src={currentPhoto.objectUrl}
              alt=""
              className="w-full h-full object-cover"
            />
            {/* Spinner overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="flex justify-center gap-6 text-sm">
        <div className="flex items-center gap-1.5 text-emerald-600">
          <CheckCircle2 className="h-4 w-4" />
          <span>{stats.completed} ready</span>
        </div>
        {stats.errors > 0 && (
          <div className="flex items-center gap-1.5 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{stats.errors} failed</span>
          </div>
        )}
      </div>

      {/* Processing queue preview - small dots */}
      <div className="flex justify-center">
        <PhotoProgressDots 
          photos={photos}
          currentlyProcessingId={currentlyProcessingId}
          className="max-w-xs justify-center"
        />
      </div>
    </div>
  );
}
