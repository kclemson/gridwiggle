
## Alternative Styling for Orientation Toggle

### Problem
The selected toggle state uses `bg-accent` which is the same purple (`262 83% 58%`) as the primary CTA button. This creates visual competition where both elements demand equal attention.

### Solution Options

I recommend using a **subtle border/underline approach** instead of a filled background:

**Option: Border + Text Weight (Recommended)**
- Selected state: White text with a bottom border indicator
- Unselected state: Muted text, no border
- This keeps the toggle clearly readable but neutral, letting the purple CTA stand out

### Visual Result

Before (competing purple):
```
Orientation: [████Landscape████] [Portrait]    ⟵ Purple fill
             ↓
         [████ Create Collage ████]            ⟵ Also purple
```

After (subtle selection):
```
Orientation: [Landscape̲] [Portrait]    ⟵ White text + underline
                   ↓
         [████ Create Collage ████]    ⟵ Purple stands alone
```

### Technical Changes

**File: `src/components/CollageSettings.tsx`**

Override the default toggle styling by adding custom classes to the `ToggleGroupItem` components:

```tsx
<ToggleGroupItem 
  value="landscape" 
  size="sm"
  className="data-[state=on]:bg-transparent data-[state=on]:text-foreground data-[state=on]:border-b-2 data-[state=on]:border-foreground data-[state=on]:rounded-b-none data-[state=off]:text-muted-foreground"
>
  <span className="text-xs">Landscape</span>
</ToggleGroupItem>
```

Key style changes:
- `data-[state=on]:bg-transparent` - Remove the purple fill
- `data-[state=on]:text-foreground` - White text when selected
- `data-[state=on]:border-b-2 data-[state=on]:border-foreground` - Underline indicator
- `data-[state=on]:rounded-b-none` - Square bottom for clean underline
- `data-[state=off]:text-muted-foreground` - Gray text when not selected

### Files to Modify

| File | Change |
|------|--------|
| `src/components/CollageSettings.tsx` | Add custom classes to ToggleGroupItem to use underline instead of purple fill |
