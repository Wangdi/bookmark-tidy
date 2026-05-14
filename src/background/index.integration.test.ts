import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAllBookmarks,
  sendProgress,
  runOrganization,
  setupMessageListener,
  resetState,
  state,
  cancelOperation,
  handleMessage,
  resetStorage,
  config,
} from '../background/index';

// Set short timeout for category editor tests
config.categoryEditTimeoutMs = 100;
config.categoryEditPollIntervalMs = 10;

// Mock Chrome APIs
const mockGetTree = vi.fn();
const mockSendMessage = vi.fn();
const mockAddListener = vi.fn();
const mockStorageSyncGet = vi.fn().mockResolvedValue({});
const mockConnect = vi.fn();
const mockNotificationsCreate = vi.fn().mockResolvedValue('notification-id');
const mockNotificationsClear = vi.fn().mockResolvedValue(true);
const mockNotificationsOnClicked = { addListener: vi.fn() };

vi.stubGlobal('chrome', {
  bookmarks: {
    getTree: mockGetTree,
  },
  runtime: {
    sendMessage: mockSendMessage,
    connect: mockConnect,
    onMessage: {
      addListener: mockAddListener,
      removeListener: vi.fn(),
    },
  },
  storage: {
    sync: {
      get: mockStorageSyncGet,
    },
  },
  notifications: {
    create: mockNotificationsCreate,
    clear: mockNotificationsClear,
    onClicked: mockNotificationsOnClicked,
  },
  action: {
    openPopup: vi.fn().mockRejectedValue(new Error('Popup not available')),
  },
  tabs: {
    create: vi.fn().mockResolvedValue({}),
  },
});

// Mock IndexedDB storage module
const mockStoredBookmarks: Array<{ id: string; url: string; title: string; meta: object; headings: string[]; status: string }> = [];
const mockEditedCategories: Array<{ id: string; name: string; bookmarkIds: string[] }> = [];

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
  saveEditedCategories: vi.fn(async (categories: unknown[]) => {
    mockEditedCategories.length = 0;
    mockEditedCategories.push(...(categories as Array<{ id: string; name: string; bookmarkIds: string[] }>));
  }),
  getEditedCategories: vi.fn(async () => [...mockEditedCategories]),
  clearEditedCategories: vi.fn(async () => {
    mockEditedCategories.length = 0;
  }),
  estimateStorageSize: vi.fn(async () => 1024),
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
  clearOrganizedFolder: vi.fn(async () => {}),
}));

describe('background integration tests', () => {
  beforeEach(() => {
    resetState();
    vi.clearAllMocks();
    mockStoredBookmarks.length = 0;  // Clear stored bookmarks between tests
    mockEditedCategories.length = 0; // Clear edited categories between tests

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

  describe('handleMessage START_ORGANIZE', () => {
    it('returns started: true when operation starts', async () => {
      const responses: unknown[] = [];
      const sendResponse = (response: unknown) => {
        responses.push(response);
      };

      handleMessage({ type: 'START_ORGANIZE' }, {} as chrome.runtime.MessageSender, sendResponse);

      // Wait for runOrganization to start
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(responses[0]).toEqual({ success: true, started: true });
    });

    it('returns started: false when already running', async () => {
      state.isRunning = true;

      const responses: unknown[] = [];
      const sendResponse = (response: unknown) => {
        responses.push(response);
      };

      handleMessage({ type: 'START_ORGANIZE' }, {} as chrome.runtime.MessageSender, sendResponse);

      // Need to wait for promise microtask to complete
      await Promise.resolve();

      expect(responses[0]).toEqual({ success: true, started: false });
    });
  });

  describe('cancelOperation', () => {
    it('sets shouldAbort flag', () => {
      cancelOperation();

      expect(state.shouldAbort).toBe(true);
    });

    it('clears progress state immediately', () => {
      // Set up some progress state
      state.current = 5;
      state.total = 10;
      state.currentUrl = 'https://example.com';

      cancelOperation();

      // Progress state should be cleared immediately
      expect(state.current).toBe(0);
      expect(state.total).toBe(0);
      expect(state.currentUrl).toBeUndefined();
    });

    it('clears progress state even when already aborted', () => {
      state.shouldAbort = true;
      state.current = 8;
      state.total = 15;
      state.currentUrl = 'https://test.com';

      cancelOperation();

      expect(state.current).toBe(0);
      expect(state.total).toBe(0);
      expect(state.currentUrl).toBeUndefined();
    });
  });

  describe('cancellation DB consistency', () => {
    it('discards partial batch results when cancelled during fetch', async () => {
      // Create enough bookmarks for multiple batches
      mockGetTree.mockResolvedValueOnce([
        {
          id: '0',
          title: 'Root',
          children: Array(25).fill(null).map((_, i) => ({
            id: `${i + 1}`,
            title: `Bookmark ${i}`,
            url: `https://example${i}.com`,
          })),
        },
      ]);

      // Set abort during first batch fetch
      let fetchCount = 0;
      const { fetchBookmark } = await import('../modules/fetcher');
      vi.mocked(fetchBookmark).mockImplementation(async (b) => {
        fetchCount++;
        if (fetchCount === 5) {
          // During first batch, set abort
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

      // State should be cleared
      expect(state.current).toBe(0);
      expect(state.total).toBe(0);
    });

    it('saves checkpoint after each completed batch if not cancelled', async () => {
      // Create enough bookmarks for multiple batches
      mockGetTree.mockResolvedValueOnce([
        {
          id: '0',
          title: 'Root',
          children: Array(25).fill(null).map((_, i) => ({
            id: `${i + 1}`,
            title: `Bookmark ${i}`,
            url: `https://example${i}.com`,
          })),
        },
      ]);

      await runOrganization();

      // Verify saveCheckpoint was called with fetchedIds
      const { saveCheckpoint } = await import('../lib/storage');
      expect(vi.mocked(saveCheckpoint)).toHaveBeenCalledWith(
        expect.objectContaining({
          pendingIds: expect.any(Array),
        })
      );
    });

    it('does not save partial batch results when cancelled during batch', async () => {
      // Create bookmarks for one batch
      mockGetTree.mockResolvedValueOnce([
        {
          id: '0',
          title: 'Root',
          children: Array(10).fill(null).map((_, i) => ({
            id: `${i + 1}`,
            title: `Bookmark ${i}`,
            url: `https://example${i}.com`,
          })),
        },
      ]);

      // Simulate cancellation happening during fetch (before batch completes)
      const { fetchBookmark } = await import('../modules/fetcher');
      let fetchStarted = false;
      vi.mocked(fetchBookmark).mockImplementation(async (b) => {
        if (!fetchStarted) {
          fetchStarted = true;
          // Cancel during first fetch
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

      // The batch still completes (Promise.all), but abort is detected at next iteration
      // So the fetched bookmarks should still be stored
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          error: 'Operation cancelled',
        })
      );
    });

    it('clears isRunning and shouldAbort after cancellation error', async () => {
      mockGetTree.mockResolvedValueOnce([
        {
          id: '0',
          title: 'Root',
          children: [{ id: '1', title: 'Bookmark', url: 'https://example.com' }],
        },
      ]);

      const { fetchBookmark } = await import('../modules/fetcher');
      vi.mocked(fetchBookmark).mockImplementationOnce(async (b) => {
        state.shouldAbort = true;
        return { ...b, meta: {}, headings: [], status: 'ok' as const };
      });

      await runOrganization();

      expect(state.isRunning).toBe(false);
      expect(state.shouldAbort).toBe(false);
    });
  });

  describe('state consistency on popup reopen', () => {
    it('returns cleared state after cancellation', async () => {
      // Simulate: user starts, progress updates, user cancels, popup reopens
      state.current = 5;
      state.total = 10;
      state.currentUrl = 'https://example.com';
      state.isRunning = true;

      // User cancels
      cancelOperation();

      // Popup reopens and calls getState (via GET_STATE message)
      const currentState = {
        isRunning: state.isRunning,
        shouldAbort: state.shouldAbort,
        current: state.current,
        total: state.total,
        currentUrl: state.currentUrl,
      };

      // State should show cleared progress
      expect(currentState.current).toBe(0);
      expect(currentState.total).toBe(0);
      expect(currentState.currentUrl).toBeUndefined();
      // But shouldAbort should be true (operation still winding down)
      expect(currentState.shouldAbort).toBe(true);
    });
  });

  describe('resetStorage', () => {
    it('clears IndexedDB storage and organized folder', async () => {
      // Add some data to storage
      mockStoredBookmarks.push({
        id: '1',
        url: 'https://example.com',
        title: 'Test',
        meta: {},
        headings: [],
        status: 'ok',
      });

      await resetStorage();

      // Verify storage was cleared
      const { clearAll } = await import('../lib/storage');
      expect(vi.mocked(clearAll)).toHaveBeenCalled();

      // Verify organized folder was cleared
      const { clearOrganizedFolder } = await import('../modules/organizer');
      expect(vi.mocked(clearOrganizedFolder)).toHaveBeenCalled();
    });

    it('cancels running operation before reset', async () => {
      state.isRunning = true;
      state.current = 5;
      state.total = 10;

      await resetStorage();

      // Operation should be cancelled
      expect(state.shouldAbort).toBe(true);
    });

    it('clears storage even when not running', async () => {
      state.isRunning = false;

      await resetStorage();

      const { clearAll } = await import('../lib/storage');
      expect(vi.mocked(clearAll)).toHaveBeenCalled();
    });
  });

  describe('handleMessage RESET', () => {
    it('returns success when reset completes', async () => {
      const responses: unknown[] = [];
      const sendResponse = (response: unknown) => {
        responses.push(response);
      };

      handleMessage({ type: 'RESET' }, {} as chrome.runtime.MessageSender, sendResponse);

      // Wait for async resetStorage to complete
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(responses[0]).toEqual({ success: true });
    });

    it('returns error when reset fails', async () => {
      const { clearAll } = await import('../lib/storage');
      vi.mocked(clearAll).mockRejectedValueOnce(new Error('Storage error'));

      const responses: unknown[] = [];
      const sendResponse = (response: unknown) => {
        responses.push(response);
      };

      handleMessage({ type: 'RESET' }, {} as chrome.runtime.MessageSender, sendResponse);

      // Wait for async resetStorage to complete
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(responses[0]).toEqual({ success: false, error: 'Storage error' });
    });
  });

  describe('handleMessage category editor', () => {
    it('handles APPLY_CATEGORY_EDIT message', async () => {
      const sendResponse = vi.fn();

      handleMessage(
        {
          type: 'APPLY_CATEGORY_EDIT',
          categories: [
            { id: 'cat-1', name: 'Edited', bookmarkIds: ['bm-1'] },
          ],
        },
        {} as chrome.runtime.MessageSender,
        sendResponse
      );

      // Wait for async
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(sendResponse).toHaveBeenCalledWith({ success: true });

      // Verify categories saved
      const { getEditedCategories } = await import('../lib/storage');
      const stored = await vi.mocked(getEditedCategories)();
      expect(stored).toEqual([
        { id: 'cat-1', name: 'Edited', bookmarkIds: ['bm-1'] },
      ]);
    });

    it('handles REGENERATE_CATEGORIES message', async () => {
      const sendResponse = vi.fn();

      // Reset state
      resetState();
      state.regenerateRequested = false;

      handleMessage(
        { type: 'REGENERATE_CATEGORIES' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      );

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(state.regenerateRequested).toBe(true);
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('runOrganization category editor', () => {
    it('sends categories after categorization phase', async () => {
      // Mock categorizer to return known categories
      const { categorizeBookmarks } = await import('../modules/categorizer');
      vi.mocked(categorizeBookmarks).mockImplementationOnce((bookmarks) => ({
        bookmarks: bookmarks.map((b, i) => ({
          ...b,
          category: i < 1 ? 'Development' : 'News',
        })),
        categoryNames: ['Development', 'News'],
      }));

      resetState();
      vi.clearAllMocks();

      await runOrganization();

      // Should send categories in progress message during categorization phase
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'progress',
          categories: expect.arrayContaining([
            expect.objectContaining({ name: 'Development' }),
            expect.objectContaining({ name: 'News' }),
          ]),
        })
      );
    });

    it('waits for edited categories before organizing', async () => {
      const { categorizeBookmarks } = await import('../modules/categorizer');
      vi.mocked(categorizeBookmarks).mockImplementationOnce((bookmarks) => ({
        bookmarks: bookmarks.map((b, i) => ({
          ...b,
          category: i < 1 ? 'Development' : 'News',
        })),
        categoryNames: ['Development', 'News'],
      }));

      const { getEditedCategories, clearEditedCategories } = await import('../lib/storage');

      // Mock edited categories to be returned after a delay
      let callCount = 0;
      vi.mocked(getEditedCategories).mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) return []; // First few calls return empty
        // Later call returns edited categories
        return [
          { id: 'coding', name: 'Coding', bookmarkIds: ['1'] },
          { id: 'news', name: 'News', bookmarkIds: ['2'] },
        ];
      });

      resetState();
      vi.clearAllMocks();
      await runOrganization();

      // Verify clearEditedCategories was called after using edited categories
      expect(vi.mocked(clearEditedCategories)).toHaveBeenCalled();
    });

    it('uses original categories if no edits received within timeout', async () => {
      const { categorizeBookmarks } = await import('../modules/categorizer');
      vi.mocked(categorizeBookmarks).mockImplementationOnce((bookmarks) => ({
        bookmarks: bookmarks.map((b, i) => ({
          ...b,
          category: i < 1 ? 'Development' : 'News',
        })),
        categoryNames: ['Development', 'News'],
      }));

      const { getEditedCategories } = await import('../lib/storage');
      // Always return empty - simulating timeout waiting for user edits
      vi.mocked(getEditedCategories).mockResolvedValue([]);

      resetState();
      vi.clearAllMocks();
      await runOrganization();

      // Should still complete successfully
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'complete',
        })
      );
    });
  });
});
