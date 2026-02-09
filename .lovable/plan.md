

# Auto-Name Photo Sets on Import

## Design Intent

Remove the manual naming step when importing photo sets. Instead of prompting with `window.prompt()`, automatically generate a descriptive name based on the photo count and hero count.

## User Outcomes

- **Faster workflow**: One less click/keystroke when importing
- **Consistent naming**: All sets follow the same pattern
- **Informative at a glance**: "46 (1H)" immediately tells you what's in the set

## Naming Scheme

| Photos | Heroes | Name |
|--------|--------|------|
| 46 | 1 | `46 (1H)` |
| 54 | 2 | `54 (2H)` |
| 20 | 0 | `20` |

---

## Technical Changes

**File: `src/pages/V3Test.tsx`**

Update the import handler to auto-generate the name:

```typescript
// Import handler (parse from clipboard)
const handleImportPhotoSet = useCallback(async () => {
  try {
    const text = await navigator.clipboard.readText();
    const parsed = JSON.parse(text) as Array<{ ar: number; isHero: boolean }>;
    
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Invalid format');
    }
    
    // Validate structure
    if (!parsed.every(p => typeof p.ar === 'number' && typeof p.isHero === 'boolean')) {
      throw new Error('Invalid format: expected { ar: number, isHero: boolean }[]');
    }
    
    // Auto-generate name based on count and heroes
    const heroCount = parsed.filter(p => p.isHero).length;
    const name = heroCount > 0 
      ? `${parsed.length} (${heroCount}H)` 
      : `${parsed.length}`;
    
    const id = savePhotoSet(name, parsed);
    setSavedSets(getSavedPhotoSets());
    setPhotoSetMode(id);
    
    toast.success(`Imported "${name}"`);
  } catch (e) {
    toast.error('Failed to parse clipboard. Copy the JSON from the Export ARs button.');
    console.error('Import error:', e);
  }
}, []);
```

---

## Summary

| Before | After |
|--------|-------|
| `window.prompt('Name this photo set:', ...)` | Auto-generate `"46 (1H)"` |
| User types name manually | One-click import |
| Inconsistent naming | Standard format |

**Changes**: ~5 lines modified in `src/pages/V3Test.tsx`

