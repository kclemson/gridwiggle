import { LayoutTestResult } from '@/test/layout/types';
import { Badge } from '@/components/ui/badge';

interface MetricsBadgesProps {
  result: LayoutTestResult;
}

/**
 * Display layout metrics as badges for quick assessment.
 */
export function MetricsBadges({ result }: MetricsBadgesProps) {
  const { testCase, rowCount, rowSizes, canvasAspect, areaCoefficientOfVariation, largestToSmallestRatio, heroCoverage } = result;
  
  return (
    <div className="flex flex-wrap gap-2 justify-center text-sm">
      <Badge variant="outline" className="font-mono">
        Photos: {testCase.photos.length}
      </Badge>
      
      <Badge variant="outline" className="font-mono">
        Hero: {testCase.hasHero ? 'Yes' : 'No'}
      </Badge>
      
      <Badge variant="outline" className="font-mono">
        Rows: {rowCount}
      </Badge>
      
      <Badge variant="outline" className="font-mono">
        Canvas: {canvasAspect.toFixed(2)}
      </Badge>
      
      <Badge variant="outline" className="font-mono">
        Area CV: {areaCoefficientOfVariation.toFixed(2)}
      </Badge>
      
      <Badge variant="outline" className="font-mono">
        Size ratio: {largestToSmallestRatio.toFixed(1)}x
      </Badge>
      
      {heroCoverage !== null && (
        <Badge variant="outline" className="font-mono">
          Hero: {(heroCoverage * 100).toFixed(0)}%
        </Badge>
      )}
      
      <Badge variant="secondary" className="font-mono text-xs">
        Rows: [{rowSizes.join(', ')}]
      </Badge>
      
      <Badge variant="secondary" className="font-mono text-xs capitalize">
        Dist: {testCase.distribution}
      </Badge>
    </div>
  );
}
