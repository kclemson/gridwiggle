

## UX Polish: Orientation Dropdown, Button Cleanup, and String Updates

This plan addresses six polish items to improve the visual elegance and clarity of the collage UI.

---

## Changes Overview

| # | Change | Summary |
|---|--------|---------|
| 1 | Orientation → Dropdown with "Auto" | Replace toggle with dropdown: Auto, Landscape, Portrait, Square |
| 2 | Button cleanup | Simpler icons for regenerate/download, less visual weight |
| 3 | Hint string | "tap to adjust or mark heroes" → "tap to crop" |
| 4 | Section header | Add "COLLAGE" header above the collage preview |
| 5 | Settings header | "SETTINGS" → "CONFIGURE" |
| 6 | Collage hint string | Update drag/hero instructions |

---

## 1. Orientation → Dropdown with "Auto" Default

### Type Changes (`src/types/collage.ts`)

Update the orientation type to include all options:

```typescript
export interface CollageSettings {
  orientation: 'auto' | 'landscape' | 'portrait' | 'square';
  gapColor: string;
  gapSize: number;
}
```

### Default Change (`src/hooks/useCollageState.ts`)

Change default from `'landscape'` to `'auto'`:

```typescript
const defaultSettings: CollageSettings = {
  orientation: 'auto',
  // ...
};
```

### Layout Algorithm (`src/lib/collageLayout.ts`)

Update `generateCollageLayout` to handle orientation modes:

```typescript
// Determine target aspect ratio based on orientation
let targetAspect: number;
let isLandscape: boolean;

switch (settings.orientation) {
  case 'landscape':
    targetAspect = 1.5;
    isLandscape = true;
    break;
  case 'portrait':
    targetAspect = 0.75;
    isLandscape = false;
    break;
  case 'square':
    targetAspect = 1.0;
    isLandscape = true; // Use landscape-style row packing for square
    break;
  case 'auto':
  default:
    // Let the algorithm pick best fit - aim for golden ratio landscape
    // but allow the scoring to accept either orientation
    targetAspect = 1.5;
    isLandscape = true;
    // Could also analyze photo aspects to pick, but simple approach works
    break;
}
```

For "auto" mode, we relax the direction penalty in scoring so the algorithm naturally picks whichever orientation produces more uniform cell sizes.

### UI Change (`src/components/CollageSettings.tsx`)

Replace ToggleGroup with Select dropdown:

```typescript
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// In the component:
<div className="flex items-center gap-2">
  <span className="text-xs text-muted-foreground">Shape:</span>
  <Select
    value={settings.orientation}
    onValueChange={(value) => onUpdate({ orientation: value as CollageSettings['orientation'] })}
  >
    <SelectTrigger className="h-7 w-24 text-xs border-0 bg-transparent">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="auto">Auto</SelectItem>
      <SelectItem value="landscape">Landscape</SelectItem>
      <SelectItem value="portrait">Portrait</SelectItem>
      <SelectItem value="square">Square</SelectItem>
    </SelectContent>
  </Select>
</div>
```

Note: Changed label from "Orientation:" to "Shape:" - it's shorter and clearer for non-technical users. Could also use "Format:" if preferred.

---

## 2. Button Cleanup

### Regenerate Button

Move from prominent purple button to subtle icon button near the collage:

```typescript
// Instead of:
<Button size="default" className="gap-2">
  <RefreshCw /> Regenerate Collage
</Button>

// Use a ghost icon button:
<Button
  variant="ghost"
  size="icon"
  onClick={handleCreateCollage}
  className="h-8 w-8"
  title="Shuffle layout"
>
  <RefreshCw className="h-4 w-4" />
</Button>
```

Position it in the collage section header row, next to the download button.

### Download Button

Make it a simple ghost icon button:

```typescript
<Button
  variant="ghost"
  size="icon"
  onClick={handleExport}
  disabled={isExporting}
  className="h-8 w-8"
  title="Download PNG"
>
  {isExporting ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : (
    <Download className="h-4 w-4" />
  )}
</Button>
```

### Create Collage Button (Initial)

Keep the primary "Create Collage" button for first-time creation, but after a layout exists, it's replaced by the subtle refresh icon.

---

## 3. Hint String Update

In `Index.tsx`, change the PhotoGrid hint:

```typescript
// From:
hint="tap to adjust or mark heroes"

// To:
hint="tap to crop"
```

This is cleaner. The hero functionality is explained in the collage section where it's actually used.

---

## 4. Add "COLLAGE" Section Header

In `Index.tsx`, add a header above the collage preview section:

```typescript
{state.layout && (
  <div className="space-y-2">
    {/* Header row with title and action icons */}
    <div className="flex items-center justify-between">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
        Collage
      </h3>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCreateCollage}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleExport}>
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
    
    {/* Hint text */}
    <p className="text-sm text-muted-foreground px-1">
      Drag to rearrange • Tap ★ to feature
    </p>
    
    {/* Collage preview */}
    <div className="rounded-xl overflow-hidden border border-border bg-surface p-4">
      <CollagePreview ... />
    </div>
  </div>
)}
```

---

## 5. Settings Header → "CONFIGURE"

In `CollageSettings.tsx`:

```typescript
// From:
<h3 className="...">Settings</h3>

// To:
<h3 className="...">Configure</h3>
```

I think "Configure" works - it's more action-oriented than "Settings". Not dorky at all!

---

## 6. Collage Hint String Update

For the hint about hero photos, consider this string:

**Option A (explaining what hero does):**
> "Drag to rearrange • Tap ★ to feature"

**Option B (more explicit):**
> "Drag to rearrange • ★ makes photos larger"

**Option C (action-focused):**
> "Drag to rearrange • Star photos to make them bigger"

I'd recommend **Option A** ("Tap ★ to feature") - it's concise and "feature" implies prominence without over-explaining. But if you want users to explicitly understand the sizing effect, Option C is clearer.

---

## File Summary

| File | Changes |
|------|---------|
| `src/types/collage.ts` | Add `'auto' \| 'square'` to orientation type |
| `src/hooks/useCollageState.ts` | Default orientation → `'auto'` |
| `src/lib/collageLayout.ts` | Handle auto/square orientations in layout algorithm |
| `src/components/CollageSettings.tsx` | Replace ToggleGroup with Select dropdown, rename "Settings" → "Configure" |
| `src/pages/Index.tsx` | Update hint strings, add "COLLAGE" header, refactor buttons to ghost icons |

---

## Visual Mockup (ASCII)

Before (cluttered buttons):
```text
┌─────────────────────────────────────────┐
│ Drag to rearrange...     [Download PNG] │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │       COLLAGE PREVIEW           │    │
│  └─────────────────────────────────┘    │
│                                         │
│      [★ Regenerate Collage]             │
└─────────────────────────────────────────┘
```

After (clean icons):
```text
┌─────────────────────────────────────────┐
│ COLLAGE                        ↻  ↓     │  ← header with icons
│ Drag to rearrange • Tap ★ to feature    │
│  ┌─────────────────────────────────┐    │
│  │       COLLAGE PREVIEW           │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

