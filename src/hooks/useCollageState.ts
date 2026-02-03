import { useState, useCallback } from 'react';
import { PhotoItem, CollageSettings, CollageLayout, CollageState } from '@/types/collage';

const STORAGE_KEY = 'smart-collage-state';

const defaultSettings: CollageSettings = {
  orientation: 'landscape',
  gapColor: '#000000',
  gapSize: 8,
};

const defaultState: CollageState = {
  photos: [],
  settings: defaultSettings,
  layout: null,
  step: 'upload',
};

function loadFromStorage(): CollageState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Reset processing state on load
      if (parsed.photos) {
        parsed.photos = parsed.photos.map((p: PhotoItem) => ({
          ...p,
          isProcessing: false,
        }));
      }
      return { ...defaultState, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load collage state:', e);
  }
  return defaultState;
}

function saveToStorage(state: CollageState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save collage state:', e);
  }
}

// Helper to update state and persist in one operation
function updateAndPersist(
  setState: React.Dispatch<React.SetStateAction<CollageState>>,
  updater: (prev: CollageState) => CollageState
) {
  setState((prev) => {
    const next = updater(prev);
    saveToStorage(next);
    return next;
  });
}

export function useCollageState() {
  const [state, setState] = useState<CollageState>(loadFromStorage);

  const addPhotos = useCallback((newPhotos: PhotoItem[]) => {
    updateAndPersist(setState, (prev) => ({
      ...prev,
      photos: [...prev.photos, ...newPhotos],
    }));
  }, []);

  const removePhoto = useCallback((photoId: string) => {
    updateAndPersist(setState, (prev) => ({
      ...prev,
      photos: prev.photos.filter((p) => p.id !== photoId),
    }));
  }, []);

  const updatePhoto = useCallback((photoId: string, updates: Partial<PhotoItem>) => {
    updateAndPersist(setState, (prev) => ({
      ...prev,
      photos: prev.photos.map((p) =>
        p.id === photoId ? { ...p, ...updates } : p
      ),
    }));
  }, []);

  const updateSettings = useCallback((updates: Partial<CollageSettings>) => {
    updateAndPersist(setState, (prev) => ({
      ...prev,
      settings: { ...prev.settings, ...updates },
    }));
  }, []);

  const setLayout = useCallback((layout: CollageLayout | null) => {
    updateAndPersist(setState, (prev) => ({
      ...prev,
      layout,
    }));
  }, []);

  const setStep = useCallback((step: CollageState['step']) => {
    updateAndPersist(setState, (prev) => ({
      ...prev,
      step,
    }));
  }, []);

  const updateLayoutCells = useCallback((cells: CollageLayout['cells']) => {
    updateAndPersist(setState, (prev) => ({
      ...prev,
      layout: prev.layout ? { ...prev.layout, cells } : null,
    }));
  }, []);

  const clearAll = useCallback(() => {
    setState(defaultState);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    state,
    addPhotos,
    removePhoto,
    updatePhoto,
    updateSettings,
    setLayout,
    setStep,
    updateLayoutCells,
    clearAll,
  };
}
