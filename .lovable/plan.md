

# Plan: Move Configure Section Below Collage as Collapsible with Persisted State

## Summary

Move the "Configure" section to appear below the collage preview, hide it until a collage is generated, make it collapsible (collapsed by default), lay out each setting on its own row, and persist the collapse state to localStorage.

---

## Changes Overview

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Remove CollageSettings from current location (line 384-389), move it inside the collage section (after CollagePreview, around line 458) |
| `src/components/CollageSettings.tsx` | Complete restructure: add Collapsible wrapper with localStorage persistence, row-based layout for each setting |

---

## Detailed Changes

### 1. `src/pages/Index.tsx`

**Remove CollageSettings from current location (lines 383-389):**
```tsx
{/* Settings */}
<CollageSettings
  settings={state.settings}
  onUpdate={handleUpdateSettings}
  photoCount={state.photos.length}
  hasHeroes={state.photos.some(p => p.priority === 1)}
/>
```

**Add CollageSettings inside the collage preview section (after the CollagePreview div, around line 458):**
```tsx
<div className="rounded-xl overflow-hidden border border-border bg-surface p-4">
  <CollagePreview ... />
</div>

{/* Configure - only shown when collage exists */}
<CollageSettings
  settings={state.settings}
  onUpdate={handleUpdateSettings}
  photoCount={state.photos.length}
  hasHeroes={state.photos.some(p => p.priority === 1)}
/>
```

---

### 2. `src/components/CollageSettings.tsx`

**A) Add imports:**
```typescript
import { useState, useEffect } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
```

**B) Add localStorage-backed state for collapse:**
```typescript
const STORAGE_KEY = 'collage-settings-collapsed';

export function CollageSettings({ ... }: CollageSettingsProps) {
  // Initialize from localStorage, default to collapsed (true)
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'true'; // 'true' means open, default (null/false) means closed
    } catch {
      return false;
    }
  });

  // Persist to localStorage on change - in the event handler, not useEffect
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    try {
      localStorage.setItem(STORAGE_KEY, String(open));
    } catch {
      // Silent - localStorage might be unavailable
    }
  };
  
  // ... rest of component
}
```

**C) Wrap content in Collapsible with styled trigger:**
```tsx
return (
  <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
    <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-1 hover:bg-muted/50 rounded transition-colors">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Configure
      </h3>
      <ChevronDown className={cn(
        "h-4 w-4 text-muted-foreground transition-transform duration-200",
        isOpen && "rotate-180"
      )} />
    </CollapsibleTrigger>
    
    <CollapsibleContent>
      {/* Settings rows */}
    </CollapsibleContent>
  </Collapsible>
);
```

**D) Reformat settings to individual rows:**
```tsx
<CollapsibleContent>
  <div className="space-y-3 pt-2 pb-1">
    {/* Background color row */}
    <div className="flex items-center justify-between px-1">
      <span className="text-sm text-muted-foreground">Background color</span>
      <input
        type="color"
        value={settings.gapColor}
        onChange={(e) => onUpdate({ gapColor: e.target.value })}
        className="w-7 h-7 rounded cursor-pointer ..."
        aria-label="Background color"
      />
    </div>
    
    {/* Gap row */}
    <div className="flex items-center justify-between px-1">
      <span className="text-sm text-muted-foreground">Gap</span>
      <div className="flex items-center gap-2">
        <Slider
          value={[settings.gapSize]}
          onValueChange={([value]) => onUpdate({ gapSize: value })}
          min={0}
          max={32}
          step={2}
          className="w-24 [&>span:first-child]:bg-muted-foreground/30"
        />
        <span className="text-xs text-muted-foreground w-8 text-right">{settings.gapSize}px</span>
      </div>
    </div>
    
    {/* Shape row */}
    <div 
      className="flex items-center justify-between px-1"
      title={hasHeroes ? "Shape is set to Auto when photos are marked as heroes" : undefined}
    >
      <div className="flex items-center gap-1">
        <span className="text-sm text-muted-foreground">Shape</span>
        {shapeHint && (
          <span className="text-xs text-muted-foreground/60 italic">{shapeHint}</span>
        )}
      </div>
      <Select
        value={settings.shape}
        onValueChange={(value) => onUpdate({ shape: value as CollageSettingsType['shape'] })}
        disabled={shapeDisabled}
      >
        <SelectTrigger className="h-7 w-28 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">Auto</SelectItem>
          {canLandscape && <SelectItem value="landscape">Landscape</SelectItem>}
          {canPortrait && <SelectItem value="portrait">Portrait</SelectItem>}
          {canSquare && <SelectItem value="square">Square-ish</SelectItem>}
        </SelectContent>
      </Select>
    </div>
  </div>
</CollapsibleContent>
```

---

## UI Before/After

**Before:**
```text
┌─ Photos ─────────────────────────┐
│  [thumbnails]                    │
└──────────────────────────────────┘

┌─ Configure ──────────────────────┐
│ Background: ■ | Gap: ━━ | Shape  │
└──────────────────────────────────┘

┌─ Collage ────────────────────────┐
│  [collage preview]               │
└──────────────────────────────────┘
```

**After (collapsed - default):**
```text
┌─ Photos ─────────────────────────┐
│  [thumbnails]                    │
└──────────────────────────────────┘

┌─ Collage ────────────────────────┐
│  [collage preview]               │
│                                  │
│  CONFIGURE                     ▼ │  ← tap to expand
└──────────────────────────────────┘
```

**After (expanded):**
```text
┌─ Collage ────────────────────────┐
│  [collage preview]               │
│                                  │
│  CONFIGURE                     ▲ │
│  Background color          [■]   │
│  Gap                   ━━━ 8px   │
│  Shape                   [Auto]  │
└──────────────────────────────────┘
```

---

## localStorage Persistence

| Key | Value | Behavior |
|-----|-------|----------|
| `collage-settings-collapsed` | `'true'` or `'false'` | Saved on toggle in event handler (not useEffect) |

The persistence happens directly in the click handler, following the user's custom guidance to avoid useEffect for localStorage writes.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No collage generated | Configure section hidden entirely |
| User clears all photos | Configure section disappears with collage |
| localStorage unavailable | Falls back to default (collapsed), silent error handling |
| User expands, refreshes page | Stays expanded (persisted) |

