import { useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  Dialog,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';

import sample2 from '@/assets/samples/sample-collage-2.png';
import sample3 from '@/assets/samples/sample-collage-3.png';
import sample4 from '@/assets/samples/sample-collage-4.png';

const samples = [sample2, sample3, sample4];

export function SampleGallery() {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Auto-rotate through samples
  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveIndex((i) => (i + 1) % samples.length);
        setIsTransitioning(false);
      }, 400);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const openLightbox = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const navigate = useCallback((dir: 1 | -1) => {
    setSelectedIndex((i) =>
      i !== null ? (i + dir + samples.length) % samples.length : null
    );
  }, []);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (selectedIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') navigate(-1);
      else if (e.key === 'ArrowRight') navigate(1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedIndex, navigate]);

  return (
    <div className="w-full mt-6 mb-8 px-2">
      <div className="flex items-center justify-center h-56 sm:h-44">
        <button
          onClick={() => openLightbox(activeIndex)}
          className={`overflow-hidden relative h-56 sm:h-44 transition-all duration-[400ms] ease-in-out ${
            isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          }`}
        >
          <img
            src={samples[activeIndex]}
            alt={`Sample collage ${activeIndex + 1}`}
            className="h-full w-auto object-contain"
            draggable={false}
            decoding="async"
          />
        </button>
      </div>

      {/* Lightbox */}
      <Dialog
        open={selectedIndex !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedIndex(null);
        }}
      >
        <DialogPortal>
          <DialogOverlay className="bg-black/60" />
          <DialogPrimitive.Content
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onPointerDownOutside={() => setSelectedIndex(null)}
            onEscapeKeyDown={() => setSelectedIndex(null)}
          >
            <DialogTitle className="sr-only">
              Sample collage {selectedIndex !== null ? selectedIndex + 1 : ''}
            </DialogTitle>

            {/* Inner container for image + controls */}
            <div className="relative inline-flex items-center">
              {/* Close */}
              <button
                onClick={() => setSelectedIndex(null)}
                className="absolute -top-3 -right-3 z-10 bg-black/70 hover:bg-black/90 text-white rounded-full p-1.5"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Prev */}
              <button
                onClick={() => navigate(-1)}
                className="absolute -left-10 sm:-left-12 top-1/2 -translate-y-1/2 text-white/70 hover:text-white z-10"
                aria-label="Previous"
              >
                <ChevronLeft className="h-8 w-8" />
              </button>

              {/* Image */}
              {selectedIndex !== null && (
                <img
                  src={samples[selectedIndex]}
                  alt={`Sample collage ${selectedIndex + 1}`}
                  className="max-h-[70vh] max-w-[90vw] object-contain rounded-lg"
                  draggable={false}
                />
              )}

              {/* Next */}
              <button
                onClick={() => navigate(1)}
                className="absolute -right-10 sm:-right-12 top-1/2 -translate-y-1/2 text-white/70 hover:text-white z-10"
                aria-label="Next"
              >
                <ChevronRight className="h-8 w-8" />
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </div>
  );
}
