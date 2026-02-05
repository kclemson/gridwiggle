import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  PhotoItem, 
  PhotoMetadata, 
  CollageSettings, 
  CollageLayout, 
  CollageState,
  PersistedCollageState 
} from '@/types/collage';
import { 
  savePhoto, 
  getAllPhotos, 
  deletePhoto, 
  clearAllPhotos,
  isStorageAvailable,
  StoredPhoto
} from '@/lib/photoStorage';
import { toast } from 'sonner';

const STORAGE_KEY = 'smart-collage-state';

const defaultSettings: CollageSettings = {
  shape: 'auto',
  gapColor: '#000000',
  gapSize: 8,
};

const defaultState: CollageState = {
  photos: [],
  settings: defaultSettings,
  layout: null,
};

/**
 * Load metadata from localStorage (no image data).
 */
function loadMetadataFromStorage(): PersistedCollageState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // One-time migration from orientation to shape
      if ('orientation' in parsed.settings && !('shape' in parsed.settings)) {
        parsed.settings.shape = parsed.settings.orientation;
        delete parsed.settings.orientation;
      }
      return {
        photos: parsed.photos || [],
        settings: { ...defaultSettings, ...parsed.settings },
        layout: parsed.layout || null,
      };
    }
  } catch (e) {
    console.error('Failed to load collage metadata:', e);
  }
  return { photos: [], settings: defaultSettings, layout: null };
}

/**
 * Save metadata to localStorage (no image data).
 */
function saveMetadataToStorage(state: CollageState) {
  try {
    const persisted: PersistedCollageState = {
      photos: state.photos.map((p) => ({
        id: p.id,
        originalWidth: p.originalWidth,
        originalHeight: p.originalHeight,
        smartCrop: p.smartCrop,
        manualCrop: p.manualCrop,
        priority: p.priority,
      })),
      settings: state.settings,
      layout: state.layout,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch (e) {
    console.error('Failed to save collage metadata:', e);
  }
}

/**
 * Merge IndexedDB blobs with localStorage metadata to create PhotoItems.
 */
function hydratePhotos(
  metadata: PhotoMetadata[],
  storedPhotos: StoredPhoto[]
): PhotoItem[] {
  const blobMap = new Map(storedPhotos.map((p) => [p.id, p]));
  const hydrated: PhotoItem[] = [];
  const orphanedIds: string[] = [];

  for (const meta of metadata) {
    const stored = blobMap.get(meta.id);
    if (stored) {
      hydrated.push({
        id: meta.id,
        objectUrl: URL.createObjectURL(stored.blob),
        blob: stored.blob,
        originalWidth: meta.originalWidth,
        originalHeight: meta.originalHeight,
        smartCrop: meta.smartCrop,
        manualCrop: meta.manualCrop,
        isProcessing: false,
        error: null,
        priority: meta.priority ?? 3,
      });
    } else {
      orphanedIds.push(meta.id);
    }
  }

  if (orphanedIds.length > 0) {
    console.warn('[hydratePhotos] Orphaned metadata (no blobs):', orphanedIds);
  }

  return hydrated;
}

export function useCollageState() {
  const [state, setState] = useState<CollageState>(defaultState);
  const [isLoading, setIsLoading] = useState(true);
  const [storageAvailable, setStorageAvailable] = useState(true);
  
  // Track Object URLs for cleanup
  const objectUrlsRef = useRef<Set<string>>(new Set());

  // Initialize: load from storage on mount
  useEffect(() => {
    let mounted = true;

    async function initialize() {
      // Check if IndexedDB is available
      const available = await isStorageAvailable();
      if (!available) {
        setStorageAvailable(false);
        toast.warning('Photo storage unavailable. Photos will not persist after refresh.');
      }

      // Load metadata from localStorage
      const persisted = loadMetadataFromStorage();

      // Load blobs from IndexedDB
      let storedPhotos: StoredPhoto[] = [];
      try {
        storedPhotos = await getAllPhotos();
      } catch (e) {
        console.error('Failed to load photos from IndexedDB:', e);
        toast.error('Failed to load saved photos. Storage may be corrupted.');
      }

      if (!mounted) return;

      // Hydrate photos (merge metadata + blobs)
      const photos = hydratePhotos(persisted.photos, storedPhotos);
      
      // Single summary log for debugging (not per-photo spam)
      console.log('[useCollageState] Hydrated', {
        metadataCount: persisted.photos.length,
        blobCount: storedPhotos.length,
        hydratedCount: photos.length,
      });
      
      // Track Object URLs for cleanup
      photos.forEach((p) => objectUrlsRef.current.add(p.objectUrl));

      // If there were orphaned metadata entries, clean them up
      if (photos.length !== persisted.photos.length) {
        const validIds = new Set(photos.map((p) => p.id));
        persisted.photos = persisted.photos.filter((m) => validIds.has(m.id));
        
        // Also clean up layout if it references missing photos
        if (persisted.layout) {
          persisted.layout.cells = persisted.layout.cells.filter(
            (cell) => validIds.has(cell.photoId)
          );
        }
      }

      setState({
        photos,
        settings: persisted.settings,
        layout: persisted.layout,
      });
      setIsLoading(false);
    }

    initialize();

    // Cleanup Object URLs on unmount
    return () => {
      mounted = false;
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const addPhotos = useCallback(async (newPhotos: PhotoItem[]): Promise<{ succeeded: PhotoItem[]; failed: PhotoItem[] }> => {
    const succeeded: PhotoItem[] = [];
    const failed: PhotoItem[] = [];

    for (const photo of newPhotos) {
      try {
        await savePhoto({
          id: photo.id,
          blob: photo.blob,
          width: photo.originalWidth,
          height: photo.originalHeight,
        });
        succeeded.push(photo);
        objectUrlsRef.current.add(photo.objectUrl);
      } catch (e) {
        console.error('Failed to save photo to IndexedDB:', photo.id, e);
        failed.push(photo);
        URL.revokeObjectURL(photo.objectUrl);
      }
    }

    if (failed.length > 0) {
      toast.error(`Failed to save ${failed.length} photo(s). Storage may be full.`);
    }

    if (succeeded.length > 0) {
      setState((prev) => {
        const next = {
          ...prev,
          photos: [...prev.photos, ...succeeded],
        };
        saveMetadataToStorage(next);
        return next;
      });
    }

    return { succeeded, failed };
  }, []);

  const removePhoto = useCallback(async (photoId: string) => {
    setState((prev) => {
      const photo = prev.photos.find((p) => p.id === photoId);
      if (photo) {
        // Revoke Object URL
        URL.revokeObjectURL(photo.objectUrl);
        objectUrlsRef.current.delete(photo.objectUrl);
      }

      const next = {
        ...prev,
        photos: prev.photos.filter((p) => p.id !== photoId),
      };
      saveMetadataToStorage(next);
      return next;
    });

    // Delete from IndexedDB
    try {
      await deletePhoto(photoId);
    } catch (e) {
      console.error('Failed to delete photo from IndexedDB:', photoId, e);
    }
  }, []);

  const updatePhoto = useCallback((photoId: string, updates: Partial<PhotoItem>) => {
    setState((prev) => {
      const next = {
        ...prev,
        photos: prev.photos.map((p) =>
          p.id === photoId ? { ...p, ...updates } : p
        ),
      };
      saveMetadataToStorage(next);
      return next;
    });
  }, []);

  const updateSettings = useCallback((updates: Partial<CollageSettings>) => {
    setState((prev) => {
      const next = {
        ...prev,
        settings: { ...prev.settings, ...updates },
      };
      saveMetadataToStorage(next);
      return next;
    });
  }, []);

  const setLayout = useCallback((layout: CollageLayout | null) => {
    setState((prev) => {
      const next = {
        ...prev,
        layout,
      };
      saveMetadataToStorage(next);
      return next;
    });
  }, []);

  const updateLayoutCells = useCallback((cells: CollageLayout['cells']) => {
    setState((prev) => {
      const next = {
        ...prev,
        layout: prev.layout ? { ...prev.layout, cells } : null,
      };
      saveMetadataToStorage(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(async () => {
    // Revoke all Object URLs
    state.photos.forEach((p) => {
      URL.revokeObjectURL(p.objectUrl);
      objectUrlsRef.current.delete(p.objectUrl);
    });

    setState(defaultState);
    localStorage.removeItem(STORAGE_KEY);

    // Clear IndexedDB
    try {
      await clearAllPhotos();
    } catch (e) {
      console.error('Failed to clear photos from IndexedDB:', e);
    }
  }, [state.photos]);

  return {
    state,
    isLoading,
    storageAvailable,
    addPhotos,
    removePhoto,
    updatePhoto,
    updateSettings,
    setLayout,
    updateLayoutCells,
    clearAll,
  };
}
