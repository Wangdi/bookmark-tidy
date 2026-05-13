import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';

// Import storage module once - shared across tests
let storage: typeof import('./storage');

describe('storage module', () => {
  beforeEach(async () => {
    // Import once and reuse
    if (!storage) {
      storage = await import('./storage');
    }
    // Clear all data between tests using the module's own clearAll
    await storage.clearAll();
  });

  afterEach(async () => {
    await storage.clearAll();
  });

  describe('storeFetched', () => {
    it('stores fetched bookmarks to IndexedDB', async () => {
      const bookmarks = [
        { id: '1', url: 'https://example.com', title: 'Example', meta: {}, headings: [], status: 'ok' as const },
        { id: '2', url: 'https://test.com', title: 'Test', meta: {}, headings: [], status: 'ok' as const },
      ];

      await storage.storeFetched(bookmarks);

      const result = await storage.loadAllFetched();
      expect(result).toHaveLength(2);
      expect(result.map(b => b.id).sort()).toEqual(['1', '2']);
    });

    it('overwrites existing bookmarks with same id', async () => {
      await storage.storeFetched([
        { id: '1', url: 'https://example.com', title: 'Original', meta: {}, headings: [], status: 'ok' as const },
      ]);

      await storage.storeFetched([
        { id: '1', url: 'https://example.com', title: 'Updated', meta: {}, headings: [], status: 'ok' as const },
      ]);

      const result = await storage.loadAllFetched();
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Updated');
    });
  });

  describe('loadAllFetched', () => {
    it('returns empty array when no bookmarks stored', async () => {
      const result = await storage.loadAllFetched();
      expect(result).toEqual([]);
    });

    it('loads all fetched bookmarks from IndexedDB', async () => {
      const bookmarks = [
        { id: '1', url: 'https://example.com', title: 'Example', meta: {}, headings: [], status: 'ok' as const },
      ];
      await storage.storeFetched(bookmarks);

      const result = await storage.loadAllFetched();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].title).toBe('Example');
    });
  });

  describe('getFetchedCount', () => {
    it('returns 0 when no bookmarks stored', async () => {
      const count = await storage.getFetchedCount();
      expect(count).toBe(0);
    });

    it('returns count of fetched bookmarks', async () => {
      const bookmarks = [
        { id: '1', url: 'https://example.com', title: 'Example', meta: {}, headings: [], status: 'ok' as const },
        { id: '2', url: 'https://test.com', title: 'Test', meta: {}, headings: [], status: 'ok' as const },
      ];
      await storage.storeFetched(bookmarks);

      const count = await storage.getFetchedCount();
      expect(count).toBe(2);
    });
  });

  describe('clearFetched', () => {
    it('clears all fetched bookmarks', async () => {
      const bookmarks = [
        { id: '1', url: 'https://example.com', title: 'Example', meta: {}, headings: [], status: 'ok' as const },
      ];
      await storage.storeFetched(bookmarks);

      expect(await storage.getFetchedCount()).toBe(1);

      await storage.clearFetched();

      expect(await storage.getFetchedCount()).toBe(0);
    });
  });

  describe('saveCheckpoint', () => {
    it('saves checkpoint to IndexedDB', async () => {
      await storage.saveCheckpoint({
        phase: 'fetching',
        totalBookmarks: 100,
        fetchedIds: ['1', '2'],
        pendingIds: ['3', '4'],
        startedAt: Date.now(),
        lastUpdated: Date.now(),
      });

      const checkpoint = await storage.loadCheckpoint();
      expect(checkpoint).not.toBeNull();
      expect(checkpoint?.phase).toBe('fetching');
      expect(checkpoint?.totalBookmarks).toBe(100);
    });

    it('overwrites existing checkpoint', async () => {
      await storage.saveCheckpoint({
        phase: 'fetching',
        totalBookmarks: 50,
        fetchedIds: ['1'],
        pendingIds: ['2'],
        startedAt: 12345,
        lastUpdated: 12346,
      });

      await storage.saveCheckpoint({
        phase: 'categorizing',
        totalBookmarks: 50,
        fetchedIds: ['1', '2'],
        pendingIds: [],
        startedAt: 12345,
        lastUpdated: 12347,
      });

      const result = await storage.loadCheckpoint();
      expect(result?.phase).toBe('categorizing');
      expect(result?.fetchedIds).toEqual(['1', '2']);
    });
  });

  describe('loadCheckpoint', () => {
    it('returns null when no checkpoint exists', async () => {
      const result = await storage.loadCheckpoint();
      expect(result).toBeNull();
    });

    it('loads saved checkpoint', async () => {
      await storage.saveCheckpoint({
        phase: 'fetching',
        totalBookmarks: 50,
        fetchedIds: ['1'],
        pendingIds: ['2'],
        startedAt: 12345,
        lastUpdated: 12346,
      });

      const result = await storage.loadCheckpoint();

      expect(result).not.toBeNull();
      expect(result?.phase).toBe('fetching');
      expect(result?.totalBookmarks).toBe(50);
      expect(result?.startedAt).toBe(12345);
    });
  });

  describe('clearCheckpoint', () => {
    it('clears checkpoint from IndexedDB', async () => {
      await storage.saveCheckpoint({
        phase: 'fetching',
        totalBookmarks: 10,
        fetchedIds: [],
        pendingIds: ['1'],
        startedAt: Date.now(),
        lastUpdated: Date.now(),
      });

      expect(await storage.loadCheckpoint()).not.toBeNull();

      await storage.clearCheckpoint();

      expect(await storage.loadCheckpoint()).toBeNull();
    });
  });

  describe('clearAll', () => {
    it('clears both fetched data and checkpoint', async () => {
      const bookmarks = [
        { id: '1', url: 'https://example.com', title: 'Example', meta: {}, headings: [], status: 'ok' as const },
      ];
      await storage.storeFetched(bookmarks);
      await storage.saveCheckpoint({
        phase: 'fetching',
        totalBookmarks: 1,
        fetchedIds: ['1'],
        pendingIds: [],
        startedAt: Date.now(),
        lastUpdated: Date.now(),
      });

      expect(await storage.getFetchedCount()).toBe(1);
      expect(await storage.loadCheckpoint()).not.toBeNull();

      await storage.clearAll();

      expect(await storage.getFetchedCount()).toBe(0);
      expect(await storage.loadCheckpoint()).toBeNull();
    });
  });

  describe('database initialization', () => {
    it('creates object stores on first open', async () => {
      // First operation should create the database and object stores
      await storage.storeFetched([
        { id: '1', url: 'https://example.com', title: 'Example', meta: {}, headings: [], status: 'ok' as const },
      ]);

      // Verify data was stored (object stores were created successfully)
      const result = await storage.loadAllFetched();
      expect(result).toHaveLength(1);
    });

    it('reuses existing database on subsequent calls', async () => {
      // First call
      await storage.storeFetched([
        { id: '1', url: 'https://example.com', title: 'First', meta: {}, headings: [], status: 'ok' as const },
      ]);

      // Second call should reuse the same database
      await storage.storeFetched([
        { id: '2', url: 'https://test.com', title: 'Second', meta: {}, headings: [], status: 'ok' as const },
      ]);

      const result = await storage.loadAllFetched();
      expect(result).toHaveLength(2);
    });
  });
});
