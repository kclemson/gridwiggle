import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { LAYOUT_ISSUE_TAGS, LAYOUT_POSITIVE_TAGS, LayoutTag } from '@/test/layout/types';

interface TagCheckboxesProps {
  selectedTags: LayoutTag[];
  onTagsChange: (tags: LayoutTag[]) => void;
}

const TAG_LABELS: Record<LayoutTag, string> = {
  'hero-not-prominent': 'Hero not prominent',
  'hero-too-dominant': 'Hero too dominant',
  'single-photo-row': 'Single-photo row',
  'row-too-dense': 'Row too dense',
  'uneven-sizes': 'Uneven sizes',
  'wrong-shape': 'Wrong shape',
  'wasted-space': 'Wasted space',
  'well-balanced': 'Well balanced',
  'hero-works': 'Hero works well',
  'good-variety': 'Good variety',
};

/**
 * Two-column checkbox grid for tagging layouts with issues or positives.
 */
export function TagCheckboxes({ selectedTags, onTagsChange }: TagCheckboxesProps) {
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
                {TAG_LABELS[tag]}
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
                {TAG_LABELS[tag]}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
