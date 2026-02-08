
# Plan: Add Shuffle 25 Button for Batch Testing

## What We're Building

A "Shuffle 25" button on the V3Test page that runs 25 consecutive shuffles, capturing each result to the pending captures queue for bulk export. The final layout is displayed, and the capture stats update to reflect all 25 new entries.

---

## User Experience

| Action | Result |
|--------|--------|
| Click "Shuffle 25" | Button shows loading state, runs 25 iterations, final layout displayed |
| During run | Button disabled, shows progress (e.g., "12/25...") |
| After run | Capture stats badge shows +25 pending, ready for export |

---

## Technical Changes

**File**: `src/pages/V3Test.tsx`

### 1. Add state for batch progress

```typescript
const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
```

### 2. Add handleShuffle25 callback

```typescript
const handleShuffle25 = useCallback(async () => {
  const BATCH_SIZE = 25;
  setBatchProgress({ current: 0, total: BATCH_SIZE });
  
  let lastState: TestState | null = null;
  
  for (let i = 0; i < BATCH_SIZE; i++) {
    const photoSet = generateRandomSet();
    const result = generateLayoutResult(photoSet.photos);
    
    // Capture to localStorage
    saveCapture(buildCapture(photoSet, result));
    
    // Update progress
    setBatchProgress({ current: i + 1, total: BATCH_SIZE });
    
    // Keep last state for display
    lastState = { photoSet, ...result };
    
    // Yield to UI to show progress (small delay)
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  // Display final result
  if (lastState) {
    setState(lastState);
  }
  
  setBatchProgress(null);
  setCaptureStats(getCaptureStats());
}, []);
```

### 3. Add button next to existing Shuffle button

```tsx
<Button 
  onClick={handleShuffle25} 
  variant="outline" 
  className="gap-2"
  disabled={batchProgress !== null}
>
  {batchProgress ? (
    <>
      <Loader2 className="h-4 w-4 animate-spin" />
      {batchProgress.current}/{batchProgress.total}
    </>
  ) : (
    <>
      <Shuffle className="h-4 w-4" />
      Shuffle 25
    </>
  )}
</Button>
```

### 4. Disable regular Shuffle during batch

```tsx
<Button 
  onClick={handleShuffle} 
  variant="outline" 
  className="gap-2"
  disabled={batchProgress !== null}  // Add this
>
```

---

## Files to Modify

1. **`src/pages/V3Test.tsx`** - Add batch shuffle state, handler, and button
