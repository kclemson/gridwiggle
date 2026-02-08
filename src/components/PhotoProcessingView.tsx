import { useMemo } from 'react';
import { PhotoItem } from '@/types/collage';
import { AlertCircle } from 'lucide-react';
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
    return { completed, errors, total: photos.length };
  }, [photos]);

  const currentPhoto = currentlyProcessingId 
    ? photos.find(p => p.id === currentlyProcessingId) 
    : null;

  return (
    <div className="space-y-4 pt-16">
      {/* Error count only - ready count is in header */}
      {stats.errors > 0 && (
        <div className="flex justify-center text-sm">
          <div className="flex items-center gap-1.5 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{stats.errors} failed</span>
          </div>
        </div>
      )}

      {/* Processing dots with integrated thumbnail */}
      <div className="flex justify-center">
        <PhotoProgressDots 
          photos={photos}
          currentlyProcessingId={currentlyProcessingId}
          currentPhoto={currentPhoto}
          className="max-w-xs justify-center"
        />
      </div>
    </div>
  );
}
