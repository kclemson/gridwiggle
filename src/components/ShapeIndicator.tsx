import { sliderToTargetAR } from '@/lib/shapeSlider';

interface ShapeIndicatorProps {
  /** Slider position 0-100 */
  position: number;
}

/**
 * Small morphing outline rectangle whose aspect ratio matches the slider position.
 * Uses constant-area formula: area=400, w=sqrt(area*ar), h=sqrt(area/ar).
 */
export function ShapeIndicator({ position }: ShapeIndicatorProps) {
  const ar = sliderToTargetAR(position);
  const area = 400;
  const w = Math.sqrt(area * ar);
  const h = Math.sqrt(area / ar);

  return (
    <div
      className="border border-muted-foreground/50 flex-shrink-0 transition-all duration-150"
      style={{ width: `${w}px`, height: `${h}px` }}
    />
  );
}
