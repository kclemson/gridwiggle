

# Multi-Set Real Photo Testing

## Design Intent

Enable testing the V4 algorithm against **multiple real-world photo sets** - not just synthetic samples. You'll export your actual photo collections (46-photo set, 20-photo set, etc.) once, and then run the algorithm hundreds of times against each to observe true variety patterns.

## User Outcomes

1. **Export**: One-click button in main app exports current photos to clipboard as JSON
2. **Import**: Paste any exported set into V3Test to add it to your collection
3. **Select**: Dropdown to switch between Random mode and any imported real-world set
4. **Test**: Shuffle 25 on a fixed set = 25 layouts on identical ARs, different orders

---

## Implementation

### Phase 1: Export Button in Main App

**File: `src/components/DebugPanel.tsx`**

Add an "Export ARs" button next to the existing capture controls:

```typescript
const handleExportPhotoARs = useCallback(() => {
  // Get current photos from parent (need to pass as prop)
  if (!photos || photos.length === 0) return;
  
  const data = photos.map(p => {
    const crop = getDisplayCrop(p);
    const width = crop?.width ?? p.originalWidth;
    const height = crop?.height ?? p.originalHeight;
    return {
      ar: +(width / height).toFixed(4),
      isHero: p.priority === 1,
    };
  });
  
  // Copy to clipboard
  navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  toast.success(`Copied ${data.length} photo ARs to clipboard`);
}, [photos]);
```

Add new prop `photos?: PhotoItem[]` to DebugPanel, and pass it from Index.tsx.

---

### Phase 2: Photo Set Storage

**File: `src/test/layout/photoGenerator.ts`**

Add storage and retrieval for multiple named photo sets:

```typescript
// LocalStorage key for saved photo sets
const PHOTO_SETS_KEY = 'v3-test-photo-sets';

/**
 * A saved real-world photo set for testing.
 */
export interface SavedPhotoSet {
  id: string;           // e.g., 'user-46', 'wedding-20'
  name: string;         // Display name
  createdAt: string;    // ISO timestamp
  photos: Array<{ ar: number; isHero: boolean }>;
}

/**
 * Get all saved photo sets from localStorage.
 */
export function getSavedPhotoSets(): SavedPhotoSet[] {
  const raw = localStorage.getItem(PHOTO_SETS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Save a new photo set (parsed from clipboard JSON).
 */
export function savePhotoSet(name: string, data: Array<{ ar: number; isHero: boolean }>): string {
  const sets = getSavedPhotoSets();
  const id = `set-${Date.now()}`;
  sets.push({
    id,
    name,
    createdAt: new Date().toISOString(),
    photos: data,
  });
  localStorage.setItem(PHOTO_SETS_KEY, JSON.stringify(sets));
  return id;
}

/**
 * Delete a saved photo set by ID.
 */
export function deletePhotoSet(id: string): void {
  const sets = getSavedPhotoSets().filter(s => s.id !== id);
  localStorage.setItem(PHOTO_SETS_KEY, JSON.stringify(sets));
}

/**
 * Convert a saved photo set to SyntheticPhoto[], shuffled.
 */
export function loadPhotoSetAsPhotos(set: SavedPhotoSet): SyntheticPhoto[] {
  const photos = set.photos.map((p, i) => createSyntheticPhoto(
    `${set.id}-p${i + 1}`,
    p.ar,
    p.isHero ? 1 : 3
  ));
  
  // Shuffle order (ARs preserved)
  for (let i = photos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [photos[i], photos[j]] = [photos[j], photos[i]];
  }
  
  return photos;
}
```

---

### Phase 3: V3Test UI Updates

**File: `src/pages/V3Test.tsx`**

Add photo set mode selector with import capability:

```typescript
// State
const [photoSetMode, setPhotoSetMode] = useState<'random' | string>('random');
const [savedSets, setSavedSets] = useState<SavedPhotoSet[]>(() => getSavedPhotoSets());

// Import handler (parse from clipboard)
const handleImportPhotoSet = useCallback(async () => {
  try {
    const text = await navigator.clipboard.readText();
    const parsed = JSON.parse(text) as Array<{ ar: number; isHero: boolean }>;
    
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Invalid format');
    }
    
    // Prompt for name
    const name = window.prompt('Name this photo set:', `${parsed.length} photos`);
    if (!name) return;
    
    const id = savePhotoSet(name, parsed);
    setSavedSets(getSavedPhotoSets());
    setPhotoSetMode(id);
    
    toast.success(`Imported "${name}" (${parsed.length} photos)`);
  } catch (e) {
    toast.error('Failed to parse clipboard. Copy the JSON from the Export ARs button.');
  }
}, []);

// Delete handler
const handleDeleteSet = useCallback((id: string) => {
  deletePhotoSet(id);
  setSavedSets(getSavedPhotoSets());
  if (photoSetMode === id) {
    setPhotoSetMode('random');
  }
}, [photoSetMode]);

// Modified shuffle - uses selected set if not random
const handleShuffle = useCallback(() => {
  let photos: SyntheticPhoto[];
  let orientationBias = 0;
  
  if (photoSetMode === 'random') {
    const result = generateRandomSet();
    photos = result.photos;
    orientationBias = result.orientationBias;
  } else {
    const set = savedSets.find(s => s.id === photoSetMode);
    if (!set) return;
    photos = loadPhotoSetAsPhotos(set);  // Shuffled order, same ARs
    // Calculate orientation bias from actual data
    const landscapes = photos.filter(p => p.aspectRatio > 1).length;
    orientationBias = (landscapes / photos.length) * 2 - 1;
  }
  
  const seed = Date.now();
  const result = generateLayoutResult(photos);
  setState({ photoSet: { photos, seed, orientationBias }, ...result });
  
  saveCapture(buildCapture({ photos, seed, orientationBias }, result));
  setCaptureStats(getCaptureStats());
}, [photoSetMode, savedSets]);
```

**UI additions in header:**

```tsx
{/* Photo Set Selector */}
<div className="flex items-center gap-2">
  <Select value={photoSetMode} onValueChange={setPhotoSetMode}>
    <SelectTrigger className="w-[180px]">
      <SelectValue placeholder="Random Photos" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="random">Random Photos</SelectItem>
      {savedSets.length > 0 && <SelectSeparator />}
      {savedSets.map(set => (
        <SelectItem key={set.id} value={set.id}>
          {set.name} ({set.photos.length})
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
  
  <Button 
    onClick={handleImportPhotoSet} 
    variant="outline" 
    size="sm"
    title="Import photo set from clipboard"
  >
    <ClipboardPaste className="h-4 w-4" />
  </Button>
  
  {photoSetMode !== 'random' && (
    <Button 
      onClick={() => handleDeleteSet(photoSetMode)} 
      variant="ghost" 
      size="sm"
      className="text-destructive"
      title="Delete this photo set"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  )}
</div>
```

---

## Workflow

1. **In main app** with your 46 photos loaded → click "Export ARs" in debug panel → JSON copied to clipboard
2. **Go to V3Test** → click Paste button → enter name "Wedding 46" → set is saved
3. Repeat for other photo collections (20 portraits, 10 landscapes, etc.)
4. **Select a set** from dropdown → Shuffle 25 → see 25 different layouts on the **same ARs**
5. Compare variety across sets to identify problematic AR combinations

---

## Test Matrix: Expected Behavior

| Mode | Shuffle | What Varies | What's Fixed |
|------|---------|-------------|--------------|
| Random | Single | All ARs, count, hero | Nothing |
| Random | 25x | All ARs, count, hero | Nothing |
| "Wedding 46" | Single | Photo order only | All 46 ARs, hero |
| "Wedding 46" | 25x | Photo order only | All 46 ARs, hero |

This lets you isolate: "Is the variety problem in the algorithm, or in this specific AR mix?"

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/DebugPanel.tsx` | Add `photos` prop + "Export ARs" button (~20 lines) |
| `src/pages/Index.tsx` | Pass `photos` to DebugPanel (~3 lines) |
| `src/test/layout/photoGenerator.ts` | Add photo set storage functions (~60 lines) |
| `src/pages/V3Test.tsx` | Add mode selector, import/delete handlers (~80 lines) |

**Total: ~160 lines new code**

