import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAllBookmarks,
  sendProgress,
  runOrganization,
  setupMessageListener,
  resetState,
  state,
} from '../background/index';

// Mock Chrome APIs
const mockGetTree = vi.fn();
const mockSendMessage = vi.fn();
const mockAddListener = vi.fn();

vi.stubGlobal('chrome', {
  bookmarks: {
    getTree: mockGetTree,
  },
  runtime: {
    sendMessage: mockSendMessage,
    onMessage: {
      addListener: mockAddListener,
      removeListener: vi.fn(),
    },
  },
});

// Mock IndexedDB storage module
const mockStoredBookmarks: Array<{ id: string; url: string; title: string; meta: object; headings: string[]; status: string }> = [];

vi.mock('../lib/storage', () => ({
  storeFetched: vi.fn(async (bookmarks: unknown[]) => {
    mockStoredBookmarks.push(...(bookmarks as Array<{ id: string; url: string; title: string; meta: object; headings: string[]; status: string }>));
  }),
  loadAllFetched: vi.fn(async () => mockStoredBookmarks),
  clearAll: vi.fn(async () => {
    mockStoredBookmarks.length = 0;
  }),
  saveCheckpoint: vi.fn(async () => {}),
  loadCheckpoint: vi.fn(async () => null),
}));

// Mock modules
vi.mock('../modules/fetcher', () => ({
  fetchBookmarks: vi.fn(async (bookmarks, options) => ({
    bookmarks: bookmarks.map((b: { id: string; url: string; title: string }) => ({
      ...b,
      meta: {},
      headings: [],
      status: 'ok',
    })),
    deadlinks: [],
    unreachable: [],
  })),
  fetchBookmark: vi.fn(async (b: { id: string; url: string; title: string }) => ({
    ...b,
    meta: {},
    headings: [],
    status: 'ok',
  })),
}));

vi.mock('../modules/deduper', () => ({
  dedupeBookmarks: vi.fn((bookmarks) => ({
    bookmarks,
    duplicatesMerged: 0,
  })),
}));

vi.mock('../modules/categorizer', () => ({
  categorizeBookmarks: vi.fn((bookmarks) => ({
    bookmarks: bookmarks.map((b: { id: string; url: string; title: string }) => ({
      ...b,
      category: 'General',
    })),
    categoryNames: ['General'],
  })),
  categorizeBookmarksSparse: vi.fn((bookmarks) => ({
    bookmarks: bookmarks.map((b: { id: string; url: string; title: string }) => ({
      ...b,
      category: 'General',
    })),
    categoryNames: ['General'],
  })),
}));

vi.mock('../modules/organizer', () => ({
  organizeBookmarks: vi.fn(async () => ({
    success: true,
    stats: {
      processed: 1,
      duplicatesMerged: 0,
      deadlinks: 0,
      unreachable: 0,
      categories: 1,
    },
  })),
}));

describe('background integration tests', () => {
  beforeEach(() => {
    resetState();
    vi.clearAllMocks();
    mockStoredBookmarks.length = 0;  // Clear stored bookmarks between tests

    // Default mock responses
    mockGetTree.mockResolvedValue([
      {
        id: '0',
        title: 'Root',
        children: [
          { id: '1', title: 'Bookmark 1', url: 'https://example1.com' },
          { id: '2', title: 'Bookmark 2', url: 'https://example2.com' },
        ],
      },
    ]);
    mockSendMessage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetState();
    vi.clearAllMocks();
  });

  describe('getAllBookmarks', () => {
    it('extracts bookmarks from Chrome tree', async () => {
      const bookmarks = await getAllBookmarks();

      expect(mockGetTree).toHaveBeenCalled();
      expect(bookmarks).toHaveLength(2);
      expect(bookmarks[0].url).toBe('https://example1.com');
      expect(bookmarks[1].url).toBe('https://example2.com');
    });

    it('returns empty array for empty tree', async () => {
      mockGetTree.mockResolvedValueOnce([
        {
          id: '0',
          title: 'Root',
          children: [],
        },
      ]);

      const bookmarks = await getAllBookmarks();

      expect(bookmarks).toHaveLength(0);
    });
  });

  describe('sendProgress', () => {
    it('sends progress event via Chrome API', async () => {
      await sendProgress({
        type: 'progress',
        current: 5,
        total: 10,
        currentUrl: 'https://example.com',
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'progress',
        current: 5,
        total: 10,
        currentUrl: 'https://example.com',
      });
    });

    it('handles errors gracefully (popup closed)', async () => {
      mockSendMessage.mockRejectedValueOnce(new Error('Popup closed'));

      // Should not throw
      await expect(sendProgress({
        type: 'progress',
        current: 0,
        total: 0,
      })).resolves.toBeUndefined();
    });

    it('updates state with progress info on progress event', async () => {
      await sendProgress({
        type: 'progress',
        current: 5,
        total: 10,
        currentUrl: 'https://example.com',
      });

      expect(state.current).toBe(5);
      expect(state.total).toBe(10);
      expect(state.currentUrl).toBe('https://example.com');
    });

    it('clears progress state on complete event', async () => {
      // Set some initial progress state
      state.current = 8;
      state.total = 10;
      state.currentUrl = 'https://example.com';

      await sendProgress({
        type: 'complete',
        current: 10,
        total: 10,
        stats: {
          processed: 10,
          duplicatesMerged: 0,
          deadlinks: 0,
          unreachable: 0,
          categories: 5,
        },
      });

      expect(state.current).toBe(0);
      expect(state.total).toBe(0);
      expect(state.currentUrl).toBeUndefined();
    });

    it('clears progress state on error event', async () => {
      // Set some initial progress state
      state.current = 5;
      state.total = 10;
      state.currentUrl = 'https://example.com';

      await sendProgress({
        type: 'error',
        current: 0,
        total: 0,
        error: 'Something went wrong',
      });

      expect(state.current).toBe(0);
      expect(state.total).toBe(0);
      expect(state.currentUrl).toBeUndefined();
    });
  });

  describe('runOrganization', () => {
    it('does nothing if already running', async () => {
      state.isRunning = true;

      await runOrganization();

      expect(mockGetTree).not.toHaveBeenCalled();
    });

    it('sends error when no bookmarks found', async () => {
      mockGetTree.mockResolvedValueOnce([
        {
          id: '0',
          title: 'Root',
          children: [],
        },
      ]);

      await runOrganization();

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          error: 'No bookmarks found',
        })
      );
    });

    it('runs full pipeline and sends completion', async () => {
      await runOrganization();

      // Check that it sent progress messages
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'progress',
        })
      );

      // Check that it sent completion
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'complete',
          stats: expect.objectContaining({
            processed: 1,
          }),
        })
      );
    });

    it('resets state after completion', async () => {
      await runOrganization();

      expect(state.isRunning).toBe(false);
      expect(state.shouldAbort).toBe(false);
    });

    it('handles cancellation', async () => {
      // Mock fetchBookmark to set shouldAbort during execution
      // This simulates the user clicking cancel while fetch is in progress
      const { fetchBookmark } = await import('../modules/fetcher');
      vi.mocked(fetchBookmark).mockImplementationOnce(async (b) => {
        // Simulate cancel happening during fetch
        state.shouldAbort = true;
        return {
          ...b,
          meta: {},
          headings: [],
          status: 'ok' as const,
        };
      });

      await runOrganization();

      // Should send cancelled error since shouldAbort was set during fetch
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          error: 'Operation cancelled',
        })
      );
    });

    it('handles cancellation between batches', async () => {
      // Create enough bookmarks for multiple batches (> 10)
      mockGetTree.mockResolvedValueOnce([
        {
          id: '0',
          title: 'Root',
          children: Array(15).fill(null).map((_, i) => ({
            id: `${i + 1}`,
            title: `Bookmark ${i}`,
            url: `https://example${i}.com`,
          })),
        },
      ]);

      // Set abort before the second batch iteration
      let batchCount = 0;
      const { fetchBookmark } = await import('../modules/fetcher');
      vi.mocked(fetchBookmark).mockImplementation(async (b) => {
        batchCount++;
        if (batchCount > 10) {
          // After first batch of 10, abort
          state.shouldAbort = true;
        }
        return {
          ...b,
          meta: {},
          headings: [],
          status: 'ok' as const,
        };
      });

      await runOrganization();

      // Should send cancelled error
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          error: 'Operation cancelled',
        })
      );
    });

    it('saves checkpoint with pendingIds during fetch', async () => {
      // Create enough bookmarks for multiple batches
      mockGetTree.mockResolvedValueOnce([
        {
          id: '0',
          title: 'Root',
          children: Array(15).fill(null).map((_, i) => ({
            id: `${i + 1}`,
            title: `Bookmark ${i}`,
            url: `https://example${i}.com`,
          })),
        },
      ]);

      await runOrganization();

      // Verify saveCheckpoint was called with pendingIds
      const { saveCheckpoint } = await import('../lib/storage');
      expect(vi.mocked(saveCheckpoint)).toHaveBeenCalledWith(
        expect.objectContaining({
          pendingIds: expect.any(Array),
        })
      );
    });
  });

  describe('setupMessageListener', () => {
    it('registers message handler', () => {
      setupMessageListener();

      expect(mockAddListener).toHaveBeenCalled();
    });
  });
});
