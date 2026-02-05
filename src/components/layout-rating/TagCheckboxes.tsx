import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { LAYOUT_ISSUE_TAGS, LAYOUT_POSITIVE_TAGS, LayoutTag, LayoutTestResult } from '@/test/layout/types';

interface TagCheckboxesProps {
  selectedTags: LayoutTag[];
  onTagsChange: (tags: LayoutTag[]) => void;
  result: LayoutTestResult;
}

/**
 * Generate dynamic label based on tag and result metrics.
 */
function getDynamicLabel(tag: LayoutTag, result: LayoutTestResult): string {
  const { canvasAspect, heroCoverage, heroToRunnerUpRatio, 
          cellAreaPercents, rowSizes, largestToSmallestRatio } = result;
  
  switch (tag) {
    case 'wrong-shape':
      return `Wrong shape (${canvasAspect.toFixed(2)})`;
    
    case 'extreme-aspect':
      return `Extreme aspect (${canvasAspect.toFixed(2)})`;
    
    case 'hero-not-prominent':
      if (heroCoverage !== null && cellAreaPercents.length >= 4) {
        const top3NonHero = cellAreaPercents.slice(1, 4)
          .map(p => `${Math.round(p * 100)}%`).join('/');
        return `Hero not prominent (${Math.round(heroCoverage * 100)}% vs ${top3NonHero})`;
      }
      return 'Hero not prominent';
    
    case 'hero-too-dominant':
      if (heroCoverage !== null && heroToRunnerUpRatio !== null) {
        return `Hero too dominant (${Math.round(heroCoverage * 100)}% · ${heroToRunnerUpRatio.toFixed(1)}×)`;
      }
      return 'Hero too dominant';
    
    case 'row-too-dense':
      return `Row too dense ([${rowSizes.join(', ')}])`;
    
    case 'single-photo-row':
      return `Single-photo row ([${rowSizes.join(', ')}])`;
    
    case 'uneven-sizes':
      return `Uneven sizes (${largestToSmallestRatio.toFixed(1)}×)`;
    
    case 'wasted-space':
      return 'Wasted space';
    case 'well-balanced':
      return 'Well balanced';
    case 'hero-works':
      return 'Hero works well';
    
    default:
      return tag;
  }
}

/**
 * Two-column checkbox grid for tagging layouts with issues or positives.
 */
export function TagCheckboxes({ selectedTags, onTagsChange, result }: TagCheckboxesProps) {
  const handleToggle = (tag: LayoutTag) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-6 text-sm">
      {/* Issues column */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-destructive uppercase tracking-wide">
          Issues
        </span>
        <div className="space-y-1.5">
          {LAYOUT_ISSUE_TAGS.map(tag => (
            <div key={tag} className="flex items-center gap-2">
              <Checkbox
                id={tag}
                checked={selectedTags.includes(tag)}
                onCheckedChange={() => handleToggle(tag)}
              />
              <Label
                htmlFor={tag}
                className="text-sm font-normal cursor-pointer"
              >
                {getDynamicLabel(tag, result)}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Positives column */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-primary uppercase tracking-wide">
          Positives
        </span>
        <div className="space-y-1.5">
          {LAYOUT_POSITIVE_TAGS.map(tag => (
            <div key={tag} className="flex items-center gap-2">
              <Checkbox
                id={tag}
                checked={selectedTags.includes(tag)}
                onCheckedChange={() => handleToggle(tag)}
              />
              <Label
                htmlFor={tag}
                className="text-sm font-normal cursor-pointer"
              >
                {getDynamicLabel(tag, result)}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
