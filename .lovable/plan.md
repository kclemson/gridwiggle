

# Remove Toast Notifications

Toast notifications are being removed in favor of inline feedback. The UI should make state changes clear through direct visual updates.

---

## Current Toast Usages

| Location | Type | Message | Replacement Strategy |
|----------|------|---------|---------------------|
| Smart crop failure | error | "Smart crop failed for one photo" | Already handled - error overlay on thumbnail |
| Export success | success | "Collage downloaded!" | Remove - browser download dialog is feedback |
| Export failure | error | "Failed to export collage" | Add inline error state in collage step |
| Regenerate success | success | "Layout regenerated" | Remove - layout visually updates |
| Clear all success | success | "All photos cleared" | Remove - photos disappear from screen |

---

## Files to Modify

### 1. `src/pages/Index.tsx`

**Remove:**
- Import of `toast` from `sonner`
- All 5 toast calls

**Add:**
- `exportError` state for showing export failures inline
- Inline error message in the collage step UI when export fails

**Changes to handlers:**
- `processSmartCrops`: Remove toast.error (thumbnail already shows error overlay)
- `handleExport`: Remove toast.success, add setExportError for failures
- `handleRegenerateLayout`: Remove toast.success
- `clearAll` onClick: Remove toast.success

### 2. `src/App.tsx`

**Remove:**
- Import of `Toaster` from `@/components/ui/toaster`
- Import of `Toaster as Sonner` from `@/components/ui/sonner`
- Both `<Toaster />` and `<Sonner />` components from JSX

### 3. Delete Toast Infrastructure Files

- `src/components/ui/sonner.tsx`
- `src/components/ui/toaster.tsx`
- `src/components/ui/toast.tsx`
- `src/components/ui/use-toast.ts`
- `src/hooks/use-toast.ts`

---

## Inline Error UI for Export Failures

In the collage step, add an inline error message below the action buttons:

```text
┌─────────────────────────────────────────┐
│  [Regenerate]  [Download PNG]           │
│                                         │
│  ⚠ Failed to export collage. Try again. │  ← Only shown when exportError is set
└─────────────────────────────────────────┘
```

The error clears when the user clicks Download again or navigates away.

---

## Why This Is Better

- **Success feedback**: The UI itself changes (photos disappear, layout updates, download starts)
- **Error feedback**: Inline text stays visible until addressed, unlike toasts that auto-dismiss
- **Simpler architecture**: Removes ~300 lines of toast infrastructure code
- **More accessible**: Inline errors are easier for screen readers to associate with context

