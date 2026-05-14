import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  countBookmarksInTree,
  extractBookmarksFromTree,
  getState,
  cancelOperation,
  resetState,
  state,
  handleMessage,
  generateTrialFolderName,
  findFolderByTitle,
  getUserPreferences,
  setUserPreferences,
  navigateToBookmarksManager,
} from '../background/index';

// Mock Chrome APIs for handleMessage tests
const mockGetTree = vi.fn().mockResolvedValue([]);
const mockSendMessage = vi.fn().mockResolvedValue(undefined);
const mockStorageSyncGet = vi.fn().mockResolvedValue({});
const mockStorageSyncSet = vi.fn().mockResolvedValue(undefined);
const mockConnect = vi.fn();
const mockTabsQuery = vi.fn().mockResolvedValue([]);
const mockTabsCreate = vi.fn().mockResolvedValue({});
const mockTabsUpdate = vi.fn().mockResolvedValue({});
const mockWindowsUpdate = vi.fn().mockResolvedValue({});

vi.stubGlobal('chrome', {
  bookmarks: {
    getTree: mockGetTree,
  },
  runtime: {
    sendMessage: mockSendMessage,
    connect: mockConnect,
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  storage: {
    sync: {
      get: mockStorageSyncGet,
      set: mockStorageSyncSet,
    },
  },
  notifications: {
    create: vi.fn().mockResolvedValue('notification-id'),
    clear: vi.fn().mockResolvedValue(true),
    onClicked: { addListener: vi.fn() },
  },
  action: {
    openPopup: vi.fn().mockRejectedValue(new Error('Popup not available')),
  },
  tabs: {
    create: mockTabsCreate,
    query: mockTabsQuery,
    update: mockTabsUpdate,
  },
  windows: {
    update: mockWindowsUpdate,
  },
});

// Mock storage module
vi.mock('../lib/storage', () => ({
  storeFetched: vi.fn(async () => {}),
  loadAllFetched: vi.fn(async () => []),
  clearAll: vi.fn(async () => {}),
  saveCheckpoint: vi.fn(async () => {}),
  loadCheckpoint: vi.fn(async () => null),
}));

// Mock modules that runOrganization needs
vi.mock('../modules/fetcher', () => ({
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
    bookmarks: [],
    categoryNames: [],
  })),
  categorizeBookmarksSparse: vi.fn((bookmarks) => ({
    bookmarks: [],
    categoryNames: [],
  })),
}));

vi.mock('../modules/organizer', () => ({
  organizeBookmarks: vi.fn(async () => ({
    success: true,
    stats: {
      processed: 0,
      duplicatesMerged: 0,
      deadlinks: 0,
      unreachable: 0,
      categories: 0,
    },
  })),
  clearOrganizedFolder: vi.fn(async () => {}),
}));

// Helper to create a mock bookmark node
function createMockBookmark(id: string, title: string, url: string, parentId?: string): chrome.bookmarks.BookmarkTreeNode {
  return { id, title, url, parentId, syncing: false };
}

// Helper to create a mock folder node
function createMockFolder(id: string, title: string, children: chrome.bookmarks.BookmarkTreeNode[] = []): chrome.bookmarks.BookmarkTreeNode {
  return { id, title, children, syncing: false };
}

describe('OrganizationOptions type', () => {
  it('accepts undefined maxBookmarks for full mode', () => {
    const options: import('../types').OrganizationOptions = {};
    expect(options.maxBookmarks).toBeUndefined();
  });

  it('accepts number for trial mode', () => {
    const options: import('../types').OrganizationOptions = { maxBookmarks: 50 };
    expect(options.maxBookmarks).toBe(50);
  });
});

describe('Trial mode constants', () => {
  it('defines minimum trial count as 10', async () => {
    const { TRIAL_MIN_BOOKMARKS } = await import('../background/index');
    expect(TRIAL_MIN_BOOKMARKS).toBe(10);
  });

  it('defines maximum trial count as 500', async () => {
    const { TRIAL_MAX_BOOKMARKS } = await import('../background/index');
    expect(TRIAL_MAX_BOOKMARKS).toBe(500);
  });

  it('defines default trial count as 50', async () => {
    const { TRIAL_DEFAULT_BOOKMARKS } = await import('../background/index');
    expect(TRIAL_DEFAULT_BOOKMARKS).toBe(50);
  });
});

describe('ProgressEvent trial mode', () => {
  it('includes isTrialMode flag in progress event', () => {
    const event: import('../types').ProgressEvent = {
      type: 'progress',
      current: 5,
      total: 25,
      isTrialMode: true,
      trialInfo: {
        folderName: '📁Organized (Trial 25) - 2026-05-14',
        processedCount: 25,
        totalCount: 100,
      },
    };
    expect(event.isTrialMode).toBe(true);
    expect(event.trialInfo?.folderName).toContain('Trial 25');
  });
});

describe('generateTrialFolderName', () => {
  it('generates folder name with trial count and date', async () => {
    const name = generateTrialFolderName(25);

    expect(name).toContain('📁Organized (Trial 25)');
    expect(name).toMatch(/\d{4}-\d{2}-\d{2}/);  // Contains date YYYY-MM-DD
  });

  it('uses provided date', async () => {
    const name = generateTrialFolderName(50, '2026-05-14');

    expect(name).toBe('📁Organized (Trial 50) - 2026-05-14');
  });

  it('handles different counts', async () => {
    expect(generateTrialFolderName(10)).toContain('Trial 10');
    expect(generateTrialFolderName(500)).toContain('Trial 500');
  });
});

describe('shuffleArray', () => {
  it('returns array of same length', async () => {
    const { shuffleArray } = await import('../background/index');
    const arr = [1, 2, 3, 4, 5];
    expect(shuffleArray(arr)).toHaveLength(5);
  });

  it('contains all original elements', async () => {
    const { shuffleArray } = await import('../background/index');
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray(arr);
    expect(shuffled.sort()).toEqual(arr.sort());
  });

  it('does not modify original array', async () => {
    const { shuffleArray } = await import('../background/index');
    const arr = [1, 2, 3, 4, 5];
    const original = [...arr];
    shuffleArray(arr);
    expect(arr).toEqual(original);
  });

  it('produces different orders on multiple calls', async () => {
    const { shuffleArray } = await import('../background/index');
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const results = new Set();

    for (let i = 0; i < 100; i++) {
      results.add(shuffleArray(arr).join(','));
    }

    expect(results.size).toBeGreaterThan(1);
  });
});

describe('selectRandomBookmarks', () => {
  const createBookmark = (id: string) => ({
    id,
    url: `https://example.com/${id}`,
    title: `Bookmark ${id}`,
  });

  it('returns all bookmarks when count >= total', async () => {
    const { selectRandomBookmarks } = await import('../background/index');
    const bookmarks = [createBookmark('1'), createBookmark('2'), createBookmark('3')];
    expect(selectRandomBookmarks(bookmarks, 5)).toHaveLength(3);
  });

  it('returns exactly N bookmarks', async () => {
    const { selectRandomBookmarks } = await import('../background/index');
    const bookmarks = [
      createBookmark('1'), createBookmark('2'), createBookmark('3'),
      createBookmark('4'), createBookmark('5')
    ];
    expect(selectRandomBookmarks(bookmarks, 3)).toHaveLength(3);
  });

  it('returns subset of original bookmarks', async () => {
    const { selectRandomBookmarks } = await import('../background/index');
    const bookmarks = [
      createBookmark('1'), createBookmark('2'), createBookmark('3'),
      createBookmark('4'), createBookmark('5')
    ];
    const selected = selectRandomBookmarks(bookmarks, 3);
    selected.forEach(b => {
      expect(bookmarks.find(bm => bm.id === b.id)).toBeDefined();
    });
  });

  it('returns empty array when count is 0', async () => {
    const { selectRandomBookmarks } = await import('../background/index');
    const bookmarks = [createBookmark('1'), createBookmark('2')];
    expect(selectRandomBookmarks(bookmarks, 0)).toHaveLength(0);
  });
});

describe('background unit tests', () => {
  beforeEach(() => {
    resetState();
    vi.clearAllMocks();
    mockGetTree.mockResolvedValue([]);
    mockSendMessage.mockResolvedValue(undefined);
    mockStorageSyncGet.mockResolvedValue({});
    mockStorageSyncSet.mockResolvedValue(undefined);
    mockConnect.mockReturnValue({
      disconnect: vi.fn(),
    });
    mockTabsQuery.mockResolvedValue([]);
    mockTabsCreate.mockResolvedValue({});
    mockTabsUpdate.mockResolvedValue({});
    mockWindowsUpdate.mockResolvedValue({});
  });

  afterEach(() => {
    resetState();
  });

  describe('countBookmarksInTree', () => {
    it('counts bookmarks in flat tree', () => {
      const tree: chrome.bookmarks.BookmarkTreeNode[] = [
        createMockFolder('1', 'Root', [
          createMockBookmark('2', 'Bookmark 1', 'https://example1.com'),
          createMockBookmark('3', 'Bookmark 2', 'https://example2.com'),
        ]),
      ];

      expect(countBookmarksInTree(tree)).toBe(2);
    });

    it('counts bookmarks in nested tree', () => {
      const tree: chrome.bookmarks.BookmarkTreeNode[] = [
        createMockFolder('1', 'Root', [
          createMockFolder('2', 'Folder', [
            createMockBookmark('3', 'Bookmark 1', 'https://example1.com'),
            createMockBookmark('4', 'Bookmark 2', 'https://example2.com'),
          ]),
          createMockBookmark('5', 'Bookmark 3', 'https://example3.com'),
        ]),
      ];

      expect(countBookmarksInTree(tree)).toBe(3);
    });

    it('returns 0 for empty tree', () => {
      expect(countBookmarksInTree([])).toBe(0);
    });

    it('returns 0 for tree with only folders', () => {
      const tree: chrome.bookmarks.BookmarkTreeNode[] = [
        createMockFolder('1', 'Root', [
          createMockFolder('2', 'Folder', []),
        ]),
      ];

      expect(countBookmarksInTree(tree)).toBe(0);
    });

    it('handles multiple root nodes', () => {
      const tree: chrome.bookmarks.BookmarkTreeNode[] = [
        createMockFolder('1', 'Root 1', [
          createMockBookmark('2', 'Bookmark 1', 'https://example1.com'),
        ]),
        createMockFolder('3', 'Root 2', [
          createMockBookmark('4', 'Bookmark 2', 'https://example2.com'),
        ]),
      ];

      expect(countBookmarksInTree(tree)).toBe(2);
    });

    it('handles deeply nested structure', () => {
      const tree: chrome.bookmarks.BookmarkTreeNode[] = [
        createMockFolder('1', 'Root', [
          createMockFolder('2', 'Level 1', [
            createMockFolder('3', 'Level 2', [
              createMockFolder('4', 'Level 3', [
                createMockBookmark('5', 'Deep Bookmark', 'https://example.com'),
              ]),
            ]),
          ]),
        ]),
      ];

      expect(countBookmarksInTree(tree)).toBe(1);
    });
  });

  describe('extractBookmarksFromTree', () => {
    it('extracts bookmarks with all properties', () => {
      const tree: chrome.bookmarks.BookmarkTreeNode[] = [
        createMockFolder('1', 'Root', [
          createMockBookmark('2', 'Bookmark 1', 'https://example.com', '1'),
        ]),
      ];

      const bookmarks = extractBookmarksFromTree(tree);

      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0]).toEqual({
        id: '2',
        title: 'Bookmark 1',
        url: 'https://example.com',
        parentId: '1',
      });
    });

    it('extracts multiple bookmarks', () => {
      const tree: chrome.bookmarks.BookmarkTreeNode[] = [
        createMockFolder('1', 'Root', [
          createMockBookmark('2', 'Bookmark 1', 'https://example1.com'),
          createMockBookmark('3', 'Bookmark 2', 'https://example2.com'),
          createMockBookmark('4', 'Bookmark 3', 'https://example3.com'),
        ]),
      ];

      const bookmarks = extractBookmarksFromTree(tree);

      expect(bookmarks).toHaveLength(3);
    });

    it('returns empty array for empty tree', () => {
      expect(extractBookmarksFromTree([])).toEqual([]);
    });

    it('skips folders without URLs', () => {
      const tree: chrome.bookmarks.BookmarkTreeNode[] = [
        createMockFolder('1', 'Root', [
          createMockBookmark('2', 'Bookmark', 'https://example.com'),
          createMockFolder('3', 'Folder', []),
        ]),
      ];

      const bookmarks = extractBookmarksFromTree(tree);

      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].title).toBe('Bookmark');
    });

    it('extracts from nested folders', () => {
      const tree: chrome.bookmarks.BookmarkTreeNode[] = [
        createMockFolder('1', 'Root', [
          createMockFolder('2', 'Folder A', [
            createMockBookmark('3', 'Inner Bookmark', 'https://example.com'),
          ]),
        ]),
      ];

      const bookmarks = extractBookmarksFromTree(tree);

      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].title).toBe('Inner Bookmark');
    });
  });

  describe('state management', () => {
    it('initial state is not running', () => {
      expect(state.isRunning).toBe(false);
      expect(state.shouldAbort).toBe(false);
    });

    it('getState returns copy of state', () => {
      const currentState = getState();
      expect(currentState).toEqual({ isRunning: false, shouldAbort: false, current: 0, total: 0, currentUrl: undefined, isTrialMode: false, regenerateRequested: false });

      // Modifying returned object doesn't affect original
      currentState.isRunning = true;
      expect(state.isRunning).toBe(false);
    });

    it('cancelOperation sets shouldAbort', () => {
      cancelOperation();
      expect(state.shouldAbort).toBe(true);
    });

    it('resetState clears all flags', () => {
      state.isRunning = true;
      state.shouldAbort = true;
      state.current = 10;
      state.total = 100;
      state.currentUrl = 'https://example.com';

      resetState();

      expect(state.isRunning).toBe(false);
      expect(state.shouldAbort).toBe(false);
      expect(state.current).toBe(0);
      expect(state.total).toBe(0);
      expect(state.currentUrl).toBeUndefined();
    });
  });

  describe('handleMessage', () => {
    it('responds to GET_STATE', () => {
      const sendResponse = vi.fn();

      handleMessage({ type: 'GET_STATE' }, {} as chrome.runtime.MessageSender, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({ isRunning: false, shouldAbort: false, current: 0, total: 0, currentUrl: undefined, isTrialMode: false, regenerateRequested: false });
    });

    it('responds to CANCEL', () => {
      const sendResponse = vi.fn();

      handleMessage({ type: 'CANCEL' }, {} as chrome.runtime.MessageSender, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({ success: true });
      expect(state.shouldAbort).toBe(true);
    });

    it('responds to START_ORGANIZE', async () => {
      const sendResponse = vi.fn();

      handleMessage({ type: 'START_ORGANIZE' }, {} as chrome.runtime.MessageSender, sendResponse);

      // Wait for async response
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(sendResponse).toHaveBeenCalledWith({ success: true, started: true });
    });

    it('returns true to keep message channel open', () => {
      const sendResponse = vi.fn();

      const result = handleMessage({ type: 'GET_STATE' }, {} as chrome.runtime.MessageSender, sendResponse);

      expect(result).toBe(true);
    });

    it('handles unknown message type gracefully', () => {
      const sendResponse = vi.fn();

      const result = handleMessage({ type: 'UNKNOWN' }, {} as chrome.runtime.MessageSender, sendResponse);

      expect(result).toBe(true);
      // sendResponse is not called for unknown types
      expect(sendResponse).not.toHaveBeenCalled();
    });
  });
});

describe('UserPreferences type', () => {
  it('has autoNavigate property with default true', () => {
    const prefs: import('../types').UserPreferences = {
      autoNavigate: true,
    };
    expect(prefs.autoNavigate).toBe(true);
  });
});

describe('OrganizedFolderInfo type', () => {
  it('contains folder ID and title', () => {
    const info: import('../types').OrganizedFolderInfo = {
      id: '123',
      title: '📁Organized',
    };
    expect(info.id).toBe('123');
  });
});

describe('findFolderByTitle', () => {
  beforeEach(() => {
    resetState();
    vi.clearAllMocks();
  });

  it('returns null when folder not found', async () => {
    mockGetTree.mockResolvedValue([
      createMockFolder('0', 'Root', [
        createMockFolder('1', 'Other Folder', []),
      ]),
    ]);

    const result = await findFolderByTitle('📁Organized');
    expect(result).toBeNull();
  });

  it('finds folder by exact title match', async () => {
    mockGetTree.mockResolvedValue([
      createMockFolder('0', 'Root', [
        createMockFolder('1', '📁Organized', [
          createMockBookmark('2', 'Bookmark', 'https://example.com'),
        ]),
      ]),
    ]);

    const result = await findFolderByTitle('📁Organized');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('1');
    expect(result?.title).toBe('📁Organized');
    expect(result?.isTrial).toBe(false);
  });

  it('finds trial folder and sets isTrial flag', async () => {
    mockGetTree.mockResolvedValue([
      createMockFolder('0', 'Root', [
        createMockFolder('1', '📁Organized (Trial 25) - 2026-05-14', []),
      ]),
    ]);

    const result = await findFolderByTitle('📁Organized (Trial 25) - 2026-05-14');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('1');
    expect(result?.isTrial).toBe(true);
  });

  it('finds folder in nested structure', async () => {
    mockGetTree.mockResolvedValue([
      createMockFolder('0', 'Root', [
        createMockFolder('1', 'Bookmarks Bar', [
          createMockFolder('2', 'Other', []),
          createMockFolder('3', '📁Organized', []),
        ]),
      ]),
    ]);

    const result = await findFolderByTitle('📁Organized');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('3');
  });

  it('skips bookmarks with matching title', async () => {
    mockGetTree.mockResolvedValue([
      createMockFolder('0', 'Root', [
        createMockBookmark('1', '📁Organized', 'https://example.com'),
        createMockFolder('2', '📁Organized', []),
      ]),
    ]);

    const result = await findFolderByTitle('📁Organized');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('2'); // Returns folder, not bookmark
  });

  it('returns first match when multiple folders exist', async () => {
    mockGetTree.mockResolvedValue([
      createMockFolder('0', 'Root', [
        createMockFolder('1', '📁Organized', []),
        createMockFolder('2', '📁Organized', []), // Duplicate
      ]),
    ]);

    const result = await findFolderByTitle('📁Organized');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('1'); // Returns first found
  });
});

describe('getUserPreferences', () => {
  beforeEach(() => {
    resetState();
    vi.clearAllMocks();
  });

  it('returns default preferences when none stored', async () => {
    mockStorageSyncGet.mockResolvedValue({});

    const result = await getUserPreferences();
    expect(result).toEqual({ autoNavigate: true });
  });

  it('returns stored preferences', async () => {
    mockStorageSyncGet.mockResolvedValue({
      userPreferences: { autoNavigate: false },
    });

    const result = await getUserPreferences();
    expect(result).toEqual({ autoNavigate: false });
  });

  it('handles partial preferences', async () => {
    mockStorageSyncGet.mockResolvedValue({
      userPreferences: {},
    });

    const result = await getUserPreferences();
    expect(result).toEqual({});
  });
});

describe('setUserPreferences', () => {
  beforeEach(() => {
    resetState();
    vi.clearAllMocks();
  });

  it('stores preferences to sync storage', async () => {
    const prefs: import('../types').UserPreferences = { autoNavigate: false };
    await setUserPreferences(prefs);

    expect(mockStorageSyncSet).toHaveBeenCalledWith({ userPreferences: prefs });
  });

  it('stores empty preferences', async () => {
    await setUserPreferences({});

    expect(mockStorageSyncSet).toHaveBeenCalledWith({ userPreferences: {} });
  });
});

describe('navigateToBookmarksManager', () => {
  beforeEach(() => {
    resetState();
    vi.clearAllMocks();
  });

  it('opens bookmarks page when no tab exists', async () => {
    mockTabsQuery.mockResolvedValue([]);

    await navigateToBookmarksManager();

    expect(mockTabsCreate).toHaveBeenCalledWith({ url: 'chrome://bookmarks/' });
  });

  it('opens bookmarks page with folder ID', async () => {
    mockTabsQuery.mockResolvedValue([]);

    await navigateToBookmarksManager('folder-123');

    expect(mockTabsCreate).toHaveBeenCalledWith({ url: 'chrome://bookmarks/#folder-123' });
  });

  it('focuses existing bookmarks tab', async () => {
    const existingTab = { id: 5, windowId: 10 };
    mockTabsQuery.mockResolvedValue([existingTab]);

    await navigateToBookmarksManager();

    expect(mockTabsUpdate).toHaveBeenCalledWith(5, { active: true });
    expect(mockWindowsUpdate).toHaveBeenCalledWith(10, { focused: true });
    expect(mockTabsCreate).not.toHaveBeenCalled();
  });

  it('focuses existing tab and navigates to folder', async () => {
    const existingTab = { id: 5, windowId: 10 };
    mockTabsQuery.mockResolvedValue([existingTab]);

    await navigateToBookmarksManager('folder-123');

    expect(mockTabsUpdate).toHaveBeenCalledWith(5, { active: true });
    expect(mockWindowsUpdate).toHaveBeenCalledWith(10, { focused: true });
    expect(mockTabsUpdate).toHaveBeenCalledWith(5, { url: 'chrome://bookmarks/#folder-123' });
  });

  it('handles multiple existing tabs (focuses first)', async () => {
    const tabs = [
      { id: 5, windowId: 10 },
      { id: 7, windowId: 11 },
    ];
    mockTabsQuery.mockResolvedValue(tabs);

    await navigateToBookmarksManager();

    expect(mockTabsUpdate).toHaveBeenCalledWith(5, { active: true });
    expect(mockWindowsUpdate).toHaveBeenCalledWith(10, { focused: true });
  });
});

describe('DetailedMetrics types', () => {
  it('FetchMetrics has all required properties', () => {
    const metrics: import('../types').FetchMetrics = {
      totalUrls: 100,
      successful: 95,
      failed: 3,
      timedOut: 2,
      averageTime: 250,
      totalTime: 25000,
    };
    expect(metrics.totalUrls).toBe(100);
    expect(metrics.successful).toBe(95);
    expect(metrics.failed).toBe(3);
    expect(metrics.timedOut).toBe(2);
    expect(metrics.averageTime).toBe(250);
    expect(metrics.totalTime).toBe(25000);
  });

  it('StorageMetrics has all required properties', () => {
    const metrics: import('../types').StorageMetrics = {
      indexedDbWrites: 100,
      indexedDbReads: 10,
      checkpointSaves: 5,
      estimatedSize: 1024000,
    };
    expect(metrics.indexedDbWrites).toBe(100);
    expect(metrics.indexedDbReads).toBe(10);
    expect(metrics.checkpointSaves).toBe(5);
    expect(metrics.estimatedSize).toBe(1024000);
  });

  it('CategorizationMetrics has all required properties', () => {
    const metrics: import('../types').CategorizationMetrics = {
      vocabularySize: 5000,
      vectorDimensions: 5000,
      clusters: 15,
      iterations: 20,
      convergenceTime: 1500,
    };
    expect(metrics.vocabularySize).toBe(5000);
    expect(metrics.vectorDimensions).toBe(5000);
    expect(metrics.clusters).toBe(15);
    expect(metrics.iterations).toBe(20);
    expect(metrics.convergenceTime).toBe(1500);
  });

  it('OrganizationMetrics has all required properties', () => {
    const metrics: import('../types').OrganizationMetrics = {
      foldersCreated: 20,
      bookmarksCreated: 100,
      batches: 10,
      averageBatchTime: 500,
    };
    expect(metrics.foldersCreated).toBe(20);
    expect(metrics.bookmarksCreated).toBe(100);
    expect(metrics.batches).toBe(10);
    expect(metrics.averageBatchTime).toBe(500);
  });

  it('PerformanceMetrics has all required properties', () => {
    const metrics: import('../types').PerformanceMetrics = {
      totalElapsed: 30000,
      averagePerBookmark: 30,
      memoryEstimate: 6291456,
    };
    expect(metrics.totalElapsed).toBe(30000);
    expect(metrics.averagePerBookmark).toBe(30);
    expect(metrics.memoryEstimate).toBe(6291456);
  });

  it('DetailedMetrics can have optional nested metrics', () => {
    const metrics: import('../types').DetailedMetrics = {
      fetch: {
        totalUrls: 100,
        successful: 95,
        failed: 3,
        timedOut: 2,
        averageTime: 250,
        totalTime: 25000,
      },
    };
    expect(metrics.fetch?.successful).toBe(95);
    expect(metrics.storage).toBeUndefined();
  });

  it('DetailedMetrics can combine all metrics', () => {
    const metrics: import('../types').DetailedMetrics = {
      fetch: {
        totalUrls: 100,
        successful: 95,
        failed: 3,
        timedOut: 2,
        averageTime: 250,
        totalTime: 25000,
      },
      storage: {
        indexedDbWrites: 100,
        indexedDbReads: 10,
        checkpointSaves: 5,
        estimatedSize: 1024000,
      },
      categorization: {
        vocabularySize: 5000,
        vectorDimensions: 5000,
        clusters: 15,
        iterations: 20,
        convergenceTime: 1500,
      },
      organization: {
        foldersCreated: 20,
        bookmarksCreated: 100,
        batches: 10,
        averageBatchTime: 500,
      },
      performance: {
        totalElapsed: 30000,
        averagePerBookmark: 30,
        memoryEstimate: 6291456,
      },
    };
    expect(metrics.fetch?.successful).toBe(95);
    expect(metrics.storage?.indexedDbWrites).toBe(100);
    expect(metrics.categorization?.clusters).toBe(15);
    expect(metrics.organization?.foldersCreated).toBe(20);
    expect(metrics.performance?.totalElapsed).toBe(30000);
  });
});

describe('ProgressEvent with detailedMetrics', () => {
  it('accepts optional detailedMetrics in progress event', () => {
    const event: import('../types').ProgressEvent = {
      type: 'progress',
      current: 50,
      total: 100,
      detailedMetrics: {
        fetch: {
          totalUrls: 50,
          successful: 48,
          failed: 1,
          timedOut: 1,
          averageTime: 200,
          totalTime: 10000,
        },
      },
    };
    expect(event.detailedMetrics?.fetch?.successful).toBe(48);
  });

  it('works without detailedMetrics (backward compatible)', () => {
    const event: import('../types').ProgressEvent = {
      type: 'complete',
      current: 100,
      total: 100,
      stats: {
        processed: 100,
        duplicatesMerged: 5,
        deadlinks: 3,
        unreachable: 2,
        categories: 12,
      },
    };
    expect(event.detailedMetrics).toBeUndefined();
  });

  it('includes detailedMetrics with all nested metrics on complete', () => {
    const event: import('../types').ProgressEvent = {
      type: 'complete',
      current: 100,
      total: 100,
      stats: {
        processed: 100,
        duplicatesMerged: 5,
        deadlinks: 3,
        unreachable: 2,
        categories: 12,
      },
      detailedMetrics: {
        fetch: {
          totalUrls: 100,
          successful: 95,
          failed: 3,
          timedOut: 2,
          averageTime: 250,
          totalTime: 25000,
        },
        storage: {
          indexedDbWrites: 100,
          indexedDbReads: 1,
          checkpointSaves: 10,
          estimatedSize: 1024000,
        },
        categorization: {
          vocabularySize: 5000,
          vectorDimensions: 5000,
          clusters: 12,
          iterations: 20,
          convergenceTime: 1500,
        },
        organization: {
          foldersCreated: 15,
          bookmarksCreated: 100,
          batches: 10,
          averageBatchTime: 500,
        },
        performance: {
          totalElapsed: 30000,
          averagePerBookmark: 300,
          memoryEstimate: 6291456,
        },
      },
    };
    expect(event.type).toBe('complete');
    expect(event.stats?.categories).toBe(12);
    expect(event.detailedMetrics?.categorization?.clusters).toBe(12);
    expect(event.detailedMetrics?.organization?.foldersCreated).toBe(15);
  });
});

describe('Category editor types', () => {
  it('accepts EditedCategory with name and bookmarks', () => {
    const category: import('../types').EditedCategory = {
      id: 'cat-1',
      name: 'Development',
      bookmarkIds: ['bm-1', 'bm-2', 'bm-3'],
    };
    expect(category.name).toBe('Development');
    expect(category.bookmarkIds).toHaveLength(3);
  });

  it('accepts CategoryEditAction for rename', () => {
    const action: import('../types').CategoryEditAction = {
      type: 'rename',
      categoryId: 'cat-1',
      newName: 'Programming',
    };
    expect(action.type).toBe('rename');
  });

  it('accepts CategoryEditAction for merge', () => {
    const action: import('../types').CategoryEditAction = {
      type: 'merge',
      sourceCategoryId: 'cat-1',
      targetCategoryId: 'cat-2',
    };
    expect(action.type).toBe('merge');
  });

  it('accepts CategoryEditAction for delete', () => {
    const action: import('../types').CategoryEditAction = {
      type: 'delete',
      categoryId: 'cat-1',
    };
    expect(action.type).toBe('delete');
  });
});

describe('ProgressEvent category structure', () => {
  it('includes categories in progress event', () => {
    const event: import('../types').ProgressEvent = {
      type: 'progress',
      current: 50,
      total: 100,
      categories: [
        { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1', 'bm-2'] },
        { id: 'cat-2', name: 'News', bookmarkIds: ['bm-3'] },
      ],
    };
    expect(event.categories).toHaveLength(2);
  });

  it('categories field is optional for backward compatibility', () => {
    const event: import('../types').ProgressEvent = {
      type: 'progress',
      current: 50,
      total: 100,
    };
    expect(event.categories).toBeUndefined();
  });

  it('can include categories in complete event with stats', () => {
    const event: import('../types').ProgressEvent = {
      type: 'complete',
      current: 100,
      total: 100,
      stats: {
        processed: 100,
        duplicatesMerged: 5,
        deadlinks: 3,
        unreachable: 2,
        categories: 15,
      },
      categories: [
        { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1', 'bm-2', 'bm-3'] },
        { id: 'cat-2', name: 'News', bookmarkIds: ['bm-4'] },
      ],
    };
    expect(event.categories).toHaveLength(2);
    expect(event.stats?.categories).toBe(15);
  });
});

describe('applyCategoryEdit', () => {
  const createCategory = (id: string, name: string, bookmarkIds: string[] = []): import('../types').EditedCategory => ({
    id,
    name,
    bookmarkIds,
  });

  it('renames category', async () => {
    const { applyCategoryEdit } = await import('../background/index');
    const categories = [
      createCategory('cat-1', 'Development', ['bm-1']),
      createCategory('cat-2', 'News', ['bm-2']),
    ];

    const result = applyCategoryEdit(categories, {
      type: 'rename',
      categoryId: 'cat-1',
      newName: 'Programming',
    });

    expect(result[0].name).toBe('Programming');
    expect(result[1].name).toBe('News');
  });

  it('merges two categories', async () => {
    const { applyCategoryEdit } = await import('../background/index');
    const categories = [
      createCategory('cat-1', 'Development', ['bm-1', 'bm-2']),
      createCategory('cat-2', 'Programming', ['bm-3']),
    ];

    const result = applyCategoryEdit(categories, {
      type: 'merge',
      sourceCategoryId: 'cat-1',
      targetCategoryId: 'cat-2',
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cat-2');
    expect(result[0].bookmarkIds).toEqual(['bm-3', 'bm-1', 'bm-2']);
  });

  it('deletes category and moves bookmarks to Uncategorized', async () => {
    const { applyCategoryEdit } = await import('../background/index');
    const categories = [
      createCategory('cat-1', 'Development', ['bm-1', 'bm-2']),
      createCategory('cat-2', 'News', ['bm-3']),
    ];

    const result = applyCategoryEdit(categories, {
      type: 'delete',
      categoryId: 'cat-1',
    });

    expect(result).toHaveLength(2);
    expect(result.find(c => c.id === 'cat-1')).toBeUndefined();
    const uncategorized = result.find(c => c.name === 'Uncategorized');
    expect(uncategorized?.bookmarkIds).toEqual(['bm-1', 'bm-2']);
  });

  it('throws error for invalid category ID on rename', async () => {
    const { applyCategoryEdit } = await import('../background/index');
    const categories = [createCategory('cat-1', 'Test', [])];

    expect(() => applyCategoryEdit(categories, {
      type: 'rename',
      categoryId: 'invalid',
      newName: 'New',
    })).toThrow('Category not found');
  });

  it('throws error for invalid source category ID on merge', async () => {
    const { applyCategoryEdit } = await import('../background/index');
    const categories = [createCategory('cat-1', 'Test', [])];

    expect(() => applyCategoryEdit(categories, {
      type: 'merge',
      sourceCategoryId: 'invalid',
      targetCategoryId: 'cat-1',
    })).toThrow('Category not found');
  });

  it('throws error for invalid target category ID on merge', async () => {
    const { applyCategoryEdit } = await import('../background/index');
    const categories = [createCategory('cat-1', 'Test', [])];

    expect(() => applyCategoryEdit(categories, {
      type: 'merge',
      sourceCategoryId: 'cat-1',
      targetCategoryId: 'invalid',
    })).toThrow('Category not found');
  });

  it('throws error for invalid category ID on delete', async () => {
    const { applyCategoryEdit } = await import('../background/index');
    const categories = [createCategory('cat-1', 'Test', [])];

    expect(() => applyCategoryEdit(categories, {
      type: 'delete',
      categoryId: 'invalid',
    })).toThrow('Category not found');
  });

  it('creates Uncategorized folder when deleting category with bookmarks if none exists', async () => {
    const { applyCategoryEdit } = await import('../background/index');
    const categories = [
      createCategory('cat-1', 'Development', ['bm-1']),
    ];

    const result = applyCategoryEdit(categories, {
      type: 'delete',
      categoryId: 'cat-1',
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Uncategorized');
    expect(result[0].bookmarkIds).toEqual(['bm-1']);
  });

  it('deletes empty category without creating Uncategorized', async () => {
    const { applyCategoryEdit } = await import('../background/index');
    const categories = [
      createCategory('cat-1', 'Development', []),
      createCategory('cat-2', 'News', ['bm-1']),
    ];

    const result = applyCategoryEdit(categories, {
      type: 'delete',
      categoryId: 'cat-1',
    });

    expect(result).toHaveLength(1);
    expect(result.find(c => c.name === 'Uncategorized')).toBeUndefined();
  });

  it('adds to existing Uncategorized when deleting another category', async () => {
    const { applyCategoryEdit } = await import('../background/index');
    const categories = [
      createCategory('cat-1', 'Development', ['bm-1']),
      createCategory('uncat', 'Uncategorized', ['bm-2']),
    ];

    const result = applyCategoryEdit(categories, {
      type: 'delete',
      categoryId: 'cat-1',
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Uncategorized');
    expect(result[0].bookmarkIds).toEqual(['bm-2', 'bm-1']);
  });
});
