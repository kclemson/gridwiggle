import { useRef, useCallback } from 'react';
import { Upload, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getImageDimensions, generateId } from '@/lib/imageUtils';
import { PhotoItem } from '@/types/collage';

interface PhotoUploaderProps {
  onPhotosAdded: (photos: PhotoItem[]) => void;
  hasPhotos: boolean;
}

export function PhotoUploader({ onPhotosAdded, hasPhotos }: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const processFiles = useCallback(async (files: FileList) => {
    const photoPromises = Array.from(files).map(async (file): Promise<PhotoItem> => {
      // File is already a Blob - no conversion needed
      const blob = file;
      const objectUrl = URL.createObjectURL(blob);
      const dimensions = await getImageDimensions(objectUrl);
      
      return {
        id: generateId(),
        objectUrl,
        blob,
        originalWidth: dimensions.width,
        originalHeight: dimensions.height,
        smartCrop: null,
        manualCrop: null,
        isProcessing: true,
        error: null,
        priority: 3, // Default: standard
      };
    });

    const photos = await Promise.all(photoPromises);
    onPhotosAdded(photos);
  }, [onPhotosAdded]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
      // Reset input so the same file(s) can be selected again
      e.target.value = '';
    }
  };

  if (hasPhotos) {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleChange}
          className="hidden"
        />
        <Button
          onClick={handleClick}
          variant="outline"
          className="touch-target gap-2"
        >
          <Plus className="h-5 w-5" />
          Add More Photos
        </Button>
      </>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleChange}
        className="hidden"
      />
      <button
        onClick={handleClick}
        className="flex flex-col items-center justify-center w-full max-w-md aspect-video rounded-xl border-2 border-dashed border-border bg-surface hover:bg-surface-elevated hover:border-primary/50 transition-all duration-200 cursor-pointer touch-target"
      >
        <div className="flex flex-col items-center gap-4 p-8">
          <div className="rounded-full bg-primary/10 p-4">
            <Upload className="h-10 w-10 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-lg font-medium text-foreground">Tap to add photos</p>
            <p className="text-sm text-muted-foreground mt-1">Select 2-8 photos for best results</p>
          </div>
        </div>
      </button>
    </div>
  );
}
