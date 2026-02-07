
# Crop Dialog UX Improvements

## Overview

Three UX improvements to the Adjust Crop dialog and photo carousel:

1. **Add Delete button to the Adjust Crop dialog** - Enables collapsing the carousel
2. **Disable Save button when nothing has changed** - Clearer UI state
3. **Add button press feedback** - Satisfying click interaction

---

## 1. Add Delete Button to Crop Editor

### User Outcome
Once the delete functionality is in the Adjust Crop dialog, all photo management can be done via the collage preview. This allows the carousel to be collapsed by default, reducing visual clutter.

### Implementation

**File**: `src/components/CropEditor.tsx`

Add a Delete button in the footer, left-aligned as a destructive action:

```tsx
// Add onDelete prop
interface CropEditorProps {
  photo: PhotoItem;
  onClose: () => void;
  onSave: (photoId: string, crop: CropRegion, priority: PhotoPriority) => void;
  onDelete: (photoId: string) => void;  // NEW
}

// In DialogFooter, add delete button on the left
<DialogFooter className="...">
  <Button 
    variant="ghost" 
    onClick={() => onDelete(photo.id)}
    className="text-destructive hover:text-destructive mr-auto"
  >
    <Trash2 className="h-4 w-4 mr-1.5" />
    Delete Photo
  </Button>
  
  {/* Existing hero checkbox and save/cancel... */}
</DialogFooter>
```

**File**: `src/pages/Index.tsx`

Pass the delete handler to CropEditor:

```tsx
<CropEditor
  photo={editingPhoto}
  onClose={() => setEditingPhotoId(null)}
  onSave={handleSaveCrop}
  onDelete={(photoId) => {
    handleRemovePhoto(photoId);
    setEditingPhotoId(null);
  }}
/>
```

---

## 2. Disable Save When No Changes

### User Outcome
The Save button is disabled and styled differently when the user hasn't made any edits, making it clear there's nothing to save.

### Design
- Compare current crop position/size against initial values
- Compare hero toggle state against initial value
- If both are unchanged, disable the Save button

### Implementation

**File**: `src/components/CropEditor.tsx`

Add change detection:

```tsx
// Store initial values for comparison
const initialCrop = useRef<CropRegion>(getEditorInitialCrop(photo));
const initialIsHero = useRef(photo.priority === 1);

// Detect if any changes were made
const hasChanges = useMemo(() => {
  const cropChanged = 
    crop.x !== initialCrop.current.x ||
    crop.y !== initialCrop.current.y ||
    crop.width !== initialCrop.current.width ||
    crop.height !== initialCrop.current.height;
  
  const heroChanged = isHero !== initialIsHero.current;
  
  return cropChanged || heroChanged;
}, [crop, isHero]);

// Disable save button when no changes
<Button 
  onClick={handleSave} 
  disabled={!hasChanges}
>
  Save
</Button>
```

---

## 3. Add Button Press Feedback

### User Outcome
When clicking Save or any action button, users get immediate tactile feedback:
- Visual "pressed" state (scale down briefly)
- Button text changes or shows loading state
- Dialog closes faster or shows transition

### Design Pattern
Use the "active" CSS pseudo-state for instant press feedback, plus a brief loading state:

```css
/* In button component - already has this via Tailwind */
.button:active {
  transform: scale(0.97);
}
```

However, the current issue is the delay between click and dialog close. The fix:

1. **Optimistic close**: Close dialog immediately, don't wait for state updates
2. **Visual feedback**: Show a brief pressed/saving state

### Implementation

**File**: `src/components/CropEditor.tsx`

Add immediate visual feedback:

```tsx
const [isSaving, setIsSaving] = useState(false);

const handleSave = () => {
  setIsSaving(true);
  const priority: PhotoPriority = isHero ? 1 : 3;
  
  // Close immediately for responsiveness
  onClose();
  
  // State update happens after close - user doesn't see the delay
  onSave(photo.id, crop, priority);
};

// Button shows saving state briefly
<Button 
  onClick={handleSave} 
  disabled={!hasChanges || isSaving}
  className="active:scale-95 transition-transform"
>
  {isSaving ? 'Saving...' : 'Save'}
</Button>
```

**File**: `src/components/ui/button.tsx`

Add active state to the base button for tactile feedback:

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center ... active:scale-[0.98] transition-transform duration-75",
  // ... rest of variants
);
```

---

## Collapsible Carousel (Follow-up)

Once the delete button is in the crop editor, the carousel becomes optional. A follow-up could:

- Add a "Photos" collapsible section header
- Default to collapsed when a collage layout exists
- Use Radix Collapsible component (already installed)

This keeps the carousel available for users who want it, but removes visual clutter for those who interact via the collage.

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/components/CropEditor.tsx` | Add `onDelete` prop, delete button, change detection, save feedback |
| `src/pages/Index.tsx` | Pass `onDelete` handler to CropEditor |
| `src/components/ui/button.tsx` | Add `active:scale-[0.98]` for tactile press feedback |

