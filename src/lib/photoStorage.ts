/**
 * IndexedDB storage for photo blobs.
 * All photos stay client-side - no server round-trips.
 */

const DB_NAME = 'smart-collage';
const DB_VERSION = 1;
const PHOTOS_STORE = 'photos';

export interface StoredPhoto {
  id: string;
  blob: Blob;
  width: number;
  height: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      dbPromise = null;
      reject(new Error('Failed to open IndexedDB'));
    };
    
    request.onsuccess = () => {
      resolve(request.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(PHOTOS_STORE)) {
        db.createObjectStore(PHOTOS_STORE, { keyPath: 'id' });
      }
    };
  });
  
  return dbPromise;
}

export async function savePhoto(photo: StoredPhoto): Promise<void> {
  const db = await getDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTOS_STORE, 'readwrite');
    const store = transaction.objectStore(PHOTOS_STORE);
    const request = store.put(photo);
    
    request.onerror = () => reject(new Error('Failed to save photo'));
    request.onsuccess = () => resolve();
  });
}

export async function getPhoto(id: string): Promise<StoredPhoto | undefined> {
  const db = await getDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTOS_STORE, 'readonly');
    const store = transaction.objectStore(PHOTOS_STORE);
    const request = store.get(id);
    
    request.onerror = () => reject(new Error('Failed to get photo'));
    request.onsuccess = () => resolve(request.result || undefined);
  });
}

export async function getAllPhotos(): Promise<StoredPhoto[]> {
  const db = await getDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTOS_STORE, 'readonly');
    const store = transaction.objectStore(PHOTOS_STORE);
    const request = store.getAll();
    
    request.onerror = () => reject(new Error('Failed to get all photos'));
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await getDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTOS_STORE, 'readwrite');
    const store = transaction.objectStore(PHOTOS_STORE);
    const request = store.delete(id);
    
    request.onerror = () => reject(new Error('Failed to delete photo'));
    request.onsuccess = () => resolve();
  });
}

export async function clearAllPhotos(): Promise<void> {
  const db = await getDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTOS_STORE, 'readwrite');
    const store = transaction.objectStore(PHOTOS_STORE);
    const request = store.clear();
    
    request.onerror = () => reject(new Error('Failed to clear photos'));
    request.onsuccess = () => resolve();
  });
}

/**
 * Check if IndexedDB is available and working.
 * Some browsers (e.g., Safari private mode) may have limited support.
 */
export async function isStorageAvailable(): Promise<boolean> {
  try {
    await getDatabase();
    return true;
  } catch {
    return false;
  }
}
