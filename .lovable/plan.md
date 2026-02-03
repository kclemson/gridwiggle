

## Replace Switch with Checkbox for Hero Toggle

A simple UI refinement to use a Checkbox instead of a Switch for the hero photo toggle. Checkboxes feel more natural for a binary on/off selection like this.

### Change

**File: `src/components/CropEditor.tsx`**

1. Replace the `Switch` import with `Checkbox`:
   ```typescript
   import { Checkbox } from '@/components/ui/checkbox';
   ```

2. Replace the Switch component with Checkbox (lines 274-278):
   ```tsx
   <Checkbox 
     id="hero-toggle"
     checked={isHero} 
     onCheckedChange={(checked) => setIsHero(checked === true)} 
   />
   ```

The Label stays the same. The only difference is `onCheckedChange` for Checkbox can return `'indeterminate'` so we need to handle that with `checked === true`.

### Files to Modify

| File | Change |
|------|--------|
| `src/components/CropEditor.tsx` | Replace Switch with Checkbox component |

