

# Refactor Index.tsx into Custom Hooks

Extract three focused hooks from the 875-line Index.tsx, reducing it to a ~350-line orchestrator.

## Design

Three hooks, each owning a clear domain:

```text
Index.tsx (orchestrator, ~350 lines)
  |-- useSmartCropProcessing (smart crop state + batch/single processing)
  |-- useCollageGeneration (layout generation via worker, debug capture)
  |-- useCollageExport (PNG export + share/download)
```

## Hook 1: `useSmartCropProcessing`

**File**: `src/hooks/useSmartCropProcessing.ts`

**Moves out of Index.tsx**:
- State: `smartCropProgress`, `isProcessingSmartCrop`, `processingStatus`, `currentlyProcessingId`, `smartCroppingPhotoId`
- Functions: `processSmartCrops` (batch), `handleSingleSmartCrop`, `handleUndoSmartCrop`, `gcDelay`
- The `processSmartCropsRef` pattern for recovery callback

**Interface**:
```typescript
function useSmartCropProcessing(deps: {
  photos: PhotoItem[];
  layout: CollageLayout | null;
  updatePhoto: (id: string, updates: Partial<PhotoItem>) => void;
  regenerateCollage: () => void;
}) => {
  // State for UI
  isProcessingSmartCrop: boolean;
  smartCropProgress: number;
  processingStatus: string;
  currentlyProcessingId: string | null;
  smartCroppingPhotoId: string | null;
  // Callbacks
  processSmartCrops: (photos: PhotoItem[]) => Promise<ProcessedDims[]>;
  processSmartCropsRef: React.RefObject;
  handleSingleSmartCrop: (photoId: string) => Promise<void>;
  handleUndoSmartCrop: (photoId: string) => void;
}
```

## Hook 2: `useCollageGeneration`

**File**: `src/hooks/useCollageGeneration.ts`

**Moves out of Index.tsx**:
- State: `debugLogs`, `lastDurationMs`, `layoutError`, `isGenerating`, `softRejection`, `layoutMeta`, `v3Tuning`
- The entire `regenerateCollage` function (lines 117-284) including dev capture logic
- `latestRequestIdRef` for stale detection
- `handleV3TuningChange`

**Interface**:
```typescript
function useCollageGeneration(deps: {
  photos: PhotoItem[];
  settings: CollageSettingsType;
  layout: CollageLayout | null;
  setLayout: (layout: CollageLayout | null) => void;
}) => {
  // State for UI
  isGenerating: boolean;
  layoutError: string | null;
  softRejection: { reason: string; details: Record<string, unknown> } | null;
  layoutMeta: Record<string, unknown> | null;
  debugLogs: LogEntry[];
  lastDurationMs: number | undefined;
  v3Tuning: V3Tuning;
  // Callbacks
  regenerateCollage: (options?: RegenerateOptions) => Promise<void>;
  handleV3TuningChange: (key: keyof V3Tuning, value: number) => void;
}
```

The `RegenerateOptions` interface moves into this hook file (or into `types/collage.ts`).

## Hook 3: `useCollageExport`

**File**: `src/hooks/useCollageExport.ts`

**Moves out of Index.tsx**:
- State: `isExporting`, `exportError`
- The `handleExport` function (lines 613-638)

**Interface**:
```typescript
function useCollageExport(deps: {
  photos: PhotoItem[];
  layout: CollageLayout | null;
  settings: CollageSettingsType;
}) => {
  isExporting: boolean;
  exportError: string | null;
  handleExport: () => Promise<void>;
}
```

## What stays in Index.tsx

- `useCollageState` initialization (with recovery wiring)
- `editingPhotoId` / `navigatorOpen` (pure UI state)
- `fileInputRef` and `handleFileInputChange`
- Thin handler wrappers that coordinate between hooks: `handlePhotosAdded`, `handleRemovePhoto`, `handleSaveCrop`, `handleToggleHero`, `handleUpdateSettings`, `handleSwapPhotos`, `handleCreateCollage`
- All JSX

## Risk Mitigation

- No logic changes -- every line of code moves verbatim into hooks
- Each hook is tested by the existing app behavior (upload photos, generate, export)
- The `photosRef` pattern stays intact inside `useCollageGeneration` to avoid stale closures
- The `processSmartCropsRef` recovery pattern is preserved in `useSmartCropProcessing`

## Technical Details

### Dependency Flow
```text
useCollageState (existing)
    |
    v
useCollageGeneration (needs: photos, settings, layout, setLayout)
    |
    v
useSmartCropProcessing (needs: photos, layout, updatePhoto, regenerateCollage)
    |
    v
useCollageExport (needs: photos, layout, settings)
```

Hooks are initialized in this order in Index.tsx. `useSmartCropProcessing` receives `regenerateCollage` from `useCollageGeneration` -- this is safe because it only calls it inside callbacks (not during render).

### File Count
- 3 new files created
- 1 file edited (Index.tsx shrinks from 875 to ~350 lines)
- 0 files deleted

