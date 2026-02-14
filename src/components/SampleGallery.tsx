import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import sample1 from '@/assets/samples/sample-collage-1.png';
import sample2 from '@/assets/samples/sample-collage-2.png';
import sample3 from '@/assets/samples/sample-collage-3.png';
import sample4 from '@/assets/samples/sample-collage-4.png';

const samples = [sample1, sample2, sample3, sample4];

export function SampleGallery() {
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Rotate featured thumbnail every 3s, pause when lightbox is open
  useEffect(() => {
    if (selectedIndex !== null) return;
    const id = setInterval(() => {
      setFeaturedIndex((i) => (i + 1) % samples.length);
    }, 3000);
    return () => clearInterval(id);
  }, [selectedIndex]);

  const openLightbox = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const navigate = useCallback((dir: 1 | -1) => {
    setSelectedIndex((i) =>
      i !== null ? (i + dir + samples.length) % samples.length : null
    );
  }, []);

  // Build grid order: featured takes position 0, others fill 1-3
  // All 4 items stay in DOM; featured gets col-span-2 row-span-2
  return (
    <div className="w-full max-w-md mx-auto mt-6 px-4">
      <p className="text-sm text-muted-foreground text-center mb-3">
        See what's possible
      </p>

      <div className="grid grid-cols-3 grid-rows-2 gap-1.5 aspect-[3/2]">
        {samples.map((src, i) => {
          const isFeatured = i === featuredIndex;
          return (
            <button
              key={i}
              onClick={() => openLightbox(i)}
              className={`
                overflow-hidden relative
                transition-[grid-area] duration-500 ease-in-out
                ${isFeatured
                  ? 'col-span-2 row-span-2'
                  : 'col-span-1 row-span-1'
                }
              `}
              style={{
                // Fixed grid positions: featured always first in flow
                order: isFeatured ? -1 : i,
              }}
            >
              <img
                src={src}
                alt={`Sample collage ${i + 1}`}
                className="w-full h-full object-cover"
                draggable={false}
                decoding="async"
              />
            </button>
          );
        })}
      </div>

      {/* Lightbox */}
      <Dialog
        open={selectedIndex !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedIndex(null);
        }}
      >
        <DialogPortal>
          <DialogOverlay className="bg-black/90" />
          <DialogPrimitive.Content
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
            onPointerDownOutside={() => setSelectedIndex(null)}
            onEscapeKeyDown={() => setSelectedIndex(null)}
          >
            <DialogTitle className="sr-only">
              Sample collage {selectedIndex !== null ? selectedIndex + 1 : ''}
            </DialogTitle>

            {/* Close */}
            <button
              onClick={() => setSelectedIndex(null)}
              className="absolute top-4 right-4 text-white/70 hover:text-white z-10"
              aria-label="Close"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Prev */}
            <button
              onClick={() => navigate(-1)}
              className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white z-10"
              aria-label="Previous"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>

            {/* Image */}
            {selectedIndex !== null && (
              <img
                src={samples[selectedIndex]}
                alt={`Sample collage ${selectedIndex + 1}`}
                className="max-w-full max-h-full object-contain"
                draggable={false}
              />
            )}

            {/* Next */}
            <button
              onClick={() => navigate(1)}
              className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white z-10"
              aria-label="Next"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </div>
  );
}
