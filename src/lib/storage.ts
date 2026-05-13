/**
 * IndexedDB storage layer for bookmark-tidy
 *
 * Uses a single database with two object stores:
 * - 'fetched': stores ProcessedBookmark objects (key: id)
 * - 'checkpoint': stores checkpoint state (key: 'current')
 */

import { ProcessedBookmark } from '../types';

const DB_NAME = 'bookmark-tidy';
const DB_VERSION = 1;
const FETCHED_STORE = 'fetched';
const CHECKPOINT_STORE = 'checkpoint';

/**
 * Checkpoint state for resumable organization
 */
export interface FetchCheckpoint {
  id: 'current';  // Always use 'current' as key
  phase: 'fetching' | 'categorizing' | 'organizing' | 'complete';
  totalBookmarks: number;
  fetchedIds: string[];
  pendingIds: string[];
  startedAt: number;
  lastUpdated: number;
}

/**
 * Sparse vector representation for TF-IDF
 * Only stores non-zero values to save memory
 */
export interface SparseVector {
  indices: number[];  // Term indices with non-zero values
  values: number[];   // TF-IDF values
}

/**
 * Open the IndexedDB database and create object stores if needed
 */
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;

      // Store for fetched bookmark data
      if (!db.objectStoreNames.contains(FETCHED_STORE)) {
        db.createObjectStore(FETCHED_STORE, { keyPath: 'id' });
      }

      // Store for checkpoint state
      if (!db.objectStoreNames.contains(CHECKPOINT_STORE)) {
        db.createObjectStore(CHECKPOINT_STORE, { keyPath: 'id' });
      }
    };
  });
}

// ===== FETCHED BOOKMARK OPERATIONS =====

/**
 * Store fetched bookmarks to IndexedDB
 */
export async function storeFetched(bookmarks: ProcessedBookmark[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(FETCHED_STORE, 'readwrite');
  const store = tx.objectStore(FETCHED_STORE);

  for (const bookmark of bookmarks) {
    store.put(bookmark);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Load all fetched bookmarks from IndexedDB
 */
export async function loadAllFetched(): Promise<ProcessedBookmark[]> {
  const db = await openDB();
  const tx = db.transaction(FETCHED_STORE, 'readonly');
  const store = tx.objectStore(FETCHED_STORE);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get count of fetched bookmarks
 */
export async function getFetchedCount(): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(FETCHED_STORE, 'readonly');
  const store = tx.objectStore(FETCHED_STORE);

  return new Promise((resolve, reject) => {
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all fetched bookmarks from IndexedDB
 */
export async function clearFetched(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(FETCHED_STORE, 'readwrite');
  tx.objectStore(FETCHED_STORE).clear();

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ===== CHECKPOINT OPERATIONS =====

/**
 * Save checkpoint state to IndexedDB
 */
export async function saveCheckpoint(checkpoint: Omit<FetchCheckpoint, 'id'>): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(CHECKPOINT_STORE, 'readwrite');
  const store = tx.objectStore(CHECKPOINT_STORE);

  store.put({ ...checkpoint, id: 'current' });

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Load checkpoint state from IndexedDB
 */
export async function loadCheckpoint(): Promise<FetchCheckpoint | null> {
  const db = await openDB();
  const tx = db.transaction(CHECKPOINT_STORE, 'readonly');
  const store = tx.objectStore(CHECKPOINT_STORE);

  return new Promise((resolve, reject) => {
    const request = store.get('current');
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear checkpoint state from IndexedDB
 */
export async function clearCheckpoint(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(CHECKPOINT_STORE, 'readwrite');
  tx.objectStore(CHECKPOINT_STORE).delete('current');

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Clear all data (for cleanup after completion)
 */
export async function clearAll(): Promise<void> {
  await Promise.all([clearFetched(), clearCheckpoint()]);
}
