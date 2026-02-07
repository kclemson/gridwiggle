

## Add Reset Button for Capture Storage

### Design Intent
Allow clearing all pending captures when the algorithm changes, preventing stale/irrelevant logs from being included in exported analysis data.

### User Outcome
A "Reset" button appears next to Export that clears all captures from localStorage and resets the pending counter to 0.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/v3CaptureStorage.ts` | Add `clearCaptures()` function |
| `src/pages/V3Test.tsx` | Add Reset button with confirmation |

---

## Technical Details

### v3CaptureStorage.ts

Add a simple clear function:

```typescript
/**
 * Clear all captures from localStorage.
 */
export function clearCaptures(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear V3 captures from localStorage', e);
  }
}
```

### V3Test.tsx

Add handler and button in the header:

```typescript
// Import
import { clearCaptures } from '@/lib/v3CaptureStorage';
import { Trash2 } from 'lucide-react';

// Handler
const handleReset = useCallback(() => {
  clearCaptures();
  setPendingCount(0);
}, []);
```

Button placement in header (between pending badge and Export):

```text
[47 pending] [Reset] [Export] [Shuffle]
```

```tsx
<Button 
  onClick={handleReset}
  variant="ghost"
  size="sm"
  disabled={pendingCount === 0}
  className="gap-1.5 text-muted-foreground hover:text-destructive"
>
  <Trash2 className="h-4 w-4" />
  Reset
</Button>
```

The button is:
- Disabled when pending count is 0 (nothing to reset)
- Uses ghost variant with muted styling (secondary action)
- Hover state changes to destructive color as visual warning

