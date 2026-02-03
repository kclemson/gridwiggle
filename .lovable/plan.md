

# Remove Step-Based Navigation Entirely

The step system (`upload` → `review` → `collage`) is unnecessary complexity. The UI should be a single vertically-scrolling page where content appears/hides based on whether photos exist and whether a layout has been generated.

---

## Current Architecture (Overly Complex)

```
Step state: 'upload' | 'review' | 'collage'
  ↓
Conditional rendering based on step
  ↓
Back arrow navigation between steps
  ↓
Broken states when step doesn't match data
```

## New Architecture (Simple)

```
No step state needed
  ↓
Show upload prompt when: photos.length === 0
Show review UI when: photos.length > 0
Show collage preview when: layout !== null (below review UI)
```

---

## File Changes

### 1. `src/types/collage.ts`

**Remove:**
- The `step` field from `CollageState` type

### 2. `src/hooks/useCollageState.ts`

**Remove:**
- `step` from default state
- `setStep` function

### 3. `src/pages/Index.tsx`

**Remove:**
- `ArrowLeft` import (no longer needed)
- `setStep` from destructured hook
- The entire back arrow button in header
- All `state.step` conditionals
- `handleCreateCollage` can just call `setLayout` directly

**Simplify rendering logic:**

```text
┌─────────────────────────────────────────┐
│ Header: Smart Collage    [Clear All]    │
├─────────────────────────────────────────┤
│                                         │
│ (if no photos)                          │
│   Full upload prompt                    │
│                                         │
│ (if has photos)                         │
│   [Add More Photos] button              │
│   Original Photos grid                  │
│   Smart Cropped grid                    │
│   Settings                              │
│   [Create Collage] button               │
│                                         │
│ (if layout exists - appears below)      │
│   Collage Preview                       │
│   [Regenerate] [Download PNG]           │
│                                         │
└─────────────────────────────────────────┘
```

**Key change:** The collage preview appears *below* the review section, not replacing it. Users can still see and modify their photos/settings while viewing the collage.

---

## Behavior After Changes

| Action | Result |
|--------|--------|
| Add first photos | Upload prompt disappears, review UI appears |
| Click "Create Collage" | Collage preview appears below settings |
| Change settings | Layout auto-regenerates |
| Clear all | Everything resets to upload prompt |

No steps. No navigation. No back arrows. Just a vertical flow.

