

## Clean Up Feasibility Architecture & Reduce Log Noise

### Design Intent

**Separation of concerns:**
1. **`feasibility.ts`** = Pure pre-pack algebraic estimates (no post-pack data required)
2. **`region-search.ts`** = Search loop with inline validations (uses packed results)

**Current problem:** `canMeetCanvasAR` requires `heroRowWidth`, which is only known AFTER packing BESIDE. This makes it a validation step, not a feasibility pre-check — but it lives in `feasibility.ts` and logs as `'feasibility'`, which is misleading.

### User Outcomes
- Logs are easier to scan — true feasibility checks (amber) vs validations (normal)
- Far fewer log entries (~10-15 instead of ~100+)
- Better mental model: feasibility = algebraic estimates to skip entire branches

---

## Changes

### 1. Refactor `feasibility.ts` — Remove post-pack functions

Move `canMeetCanvasAR` out of `feasibility.ts` entirely. It's not a true pre-check since it requires packed `heroRowWidth`.

Add a **new true pre-check** that works at the `besideCount` level:

```typescript
/**
 * Estimate if ANY row configuration for a given besideCount could possibly
 * produce a valid canvas AR. Uses algebraic estimate of minimum heroRowWidth.
 * 
 * This is a true pre-pack estimate — runs BEFORE any packing.
 */
export function canBesideCountMeetCanvasAR(
  heroAR: number,
  besidePhotos: PhotoDimension[],
  normalizedGap: number,
  tuning: V3Tuning
): { feasible: boolean; minHeroRowWidth: number }
```

**Key insight:** The minimum `heroRowWidth` occurs when BESIDE is packed into maximum rows (most vertical stacking). We can estimate this without packing:
- `minBesideWidth ≈ sumBesideAR / maxRows` (where `maxRows = min(n, 4)`)
- `minHeroRowWidth = heroAR + gap + minBesideWidth`

If even this best-case width exceeds canvas AR limits, skip the entire `besideCount`.

### 2. Update `region-search.ts` — Two-level pruning

**Outer loop (besideCount level):** Add `canBesideCountMeetCanvasAR` check — logs once per skipped besideCount.

**Inner loop (besideRowCount level):** Keep the exact canvas AR validation, but:
- Move it inline (don't call `canMeetCanvasAR`)
- Log as `'region'` category (it's a validation, not a feasibility estimate)
- Only log on actual rejection (not every iteration)

### 3. Update `DebugPanel.tsx` — Visual distinction

Style `feasibility` category logs with amber background and Filter icon:
- Immediately recognizable as "early pruning" steps
- Visually distinct from blue "region" logs (actual search activity)

---

## Technical Details

### File: `src/lib/v3/feasibility.ts`

**Remove:** `canMeetCanvasAR` (lines 69-102)

**Add:** New outer-loop pre-check:

```typescript
/**
 * Estimate if ANY row configuration for a given besideCount could produce
 * a valid canvas AR. Uses minimum heroRowWidth estimate.
 * 
 * This is a TRUE pre-pack check — runs before any packing happens.
 */
export function canBesideCountMeetCanvasAR(
  heroAR: number,
  besidePhotos: PhotoDimension[],
  normalizedGap: number,
  tuning: V3Tuning
): { feasible: boolean; minHeroRowWidth: number } {
  if (besidePhotos.length === 0) {
    return { feasible: true, minHeroRowWidth: heroAR };
  }
  
  // Minimum besideWidth occurs at maximum row count (most vertical stacking)
  const sumBesideAR = besidePhotos.reduce((s, p) => s + p.aspectRatio, 0);
  const maxRows = Math.min(besidePhotos.length, 4);
  const minBesideWidth = sumBesideAR / maxRows;
  
  const minHeroRowWidth = heroAR + normalizedGap + minBesideWidth;
  
  // Best-case canvas AR (minimum width / maximum height)
  const minCanvasHeight = 1.0 + normalizedGap + 0.2 + 2 * normalizedGap;
  const canvasWidth = minHeroRowWidth + 2 * normalizedGap;
  const bestCaseAR = canvasWidth / minCanvasHeight;
  
  const feasible = bestCaseAR <= tuning.canvas_maxAR * 1.1;
  
  if (!feasible) {
    devLogger.log('feasibility', 'Canvas AR infeasible for besideCount', {
      besideCount: besidePhotos.length,
      minHeroRowWidth: minHeroRowWidth.toFixed(2),
      bestCaseAR: bestCaseAR.toFixed(2),
      maxAR: tuning.canvas_maxAR,
    });
  }
  
  return { feasible, minHeroRowWidth };
}
```

### File: `src/lib/v3/region-search.ts`

**Add outer-loop pre-check** (after line 80, before entering the `besideCount > 0` block):

```typescript
// Early canvas AR feasibility check at besideCount level
if (besideCount > 0) {
  const canvasARFeasibility = canBesideCountMeetCanvasAR(
    heroAR, besidePhotos, normalizedGap, tuning
  );
  if (!canvasARFeasibility.feasible) {
    continue; // Skip entire besideCount — no row config can work
  }
}
```

**Remove import** of `canMeetCanvasAR` (line 12).

**Replace inner-loop check** (lines 186-196):
Instead of calling `canMeetCanvasAR`, do inline validation without separate logging:

```typescript
// Validate canvas AR (post-pack check)
const minCanvasHeight = 1.0 + normalizedGap + 0.2 + 2 * normalizedGap;
const canvasWidth = heroRowWidth + 2 * normalizedGap;
const bestCaseAR = canvasWidth / minCanvasHeight;

if (bestCaseAR > tuning.canvas_maxAR * 1.1) {
  continue; // Skip — canvas too wide (already logged at besideCount level if pattern repeats)
}
```

### File: `src/components/DebugPanel.tsx`

**Update `getLogIcon`** to accept category:

```typescript
function getLogIcon(label: string, data: Record<string, unknown>, category?: string) {
  // Feasibility checks — amber filter icon
  if (category === 'feasibility') {
    return <Filter className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
  }
  
  // ... existing logic
}
```

**Update `LogEntryRow`** to pass category and add amber styling:

```typescript
function LogEntryRow({ entry }: { entry: LogEntry }) {
  const icon = getLogIcon(entry.label, entry.data, entry.category);
  const isFeasibility = entry.category === 'feasibility';
  
  return (
    <div className={cn(
      "border-b border-border/50 py-2 px-3 last:border-b-0",
      isFeasibility && "bg-amber-500/10"
    )}>
      {/* ... rest unchanged */}
    </div>
  );
}
```

**Add imports:**
```typescript
import { Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
```

---

## Expected Log Output (Before vs After)

**Before (371 logs):**
```
[feasibility] Canvas AR infeasible  heroRowWidth:3.03...
[region] Skipping (canvas AR infeasible) besideCount:1, besideRowCount:1...
[feasibility] Canvas AR infeasible  heroRowWidth:3.78...
[region] Skipping (canvas AR infeasible) besideCount:2, besideRowCount:1...
[feasibility] Canvas AR infeasible  heroRowWidth:3.78...
[region] Skipping (canvas AR infeasible) besideCount:2, besideRowCount:2...
... (repeats ~50 times)
```

**After (~15 logs):**
```
[feasibility] Canvas AR infeasible for besideCount  besideCount:8, minHeroRowWidth:4.2...
[feasibility] Canvas AR infeasible for besideCount  besideCount:9, minHeroRowWidth:4.8...
[region] Valid assignment candidate  besideCount:3, besideRowCount:2...
[region] Valid assignment candidate  besideCount:4, besideRowCount:2...
[region] Assignment selected by best score  ...
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/v3/feasibility.ts` | Remove `canMeetCanvasAR`, add `canBesideCountMeetCanvasAR` |
| `src/lib/v3/region-search.ts` | Add outer-loop pre-check, inline inner-loop validation without logging |
| `src/components/DebugPanel.tsx` | Add amber styling + Filter icon for feasibility category |

