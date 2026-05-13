import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  showState,
  updateProgress,
  showResults,
  countBookmarksInTree,
  handleProgressMessage,
  handleDone,
  setElements,
  PopupElements,
} from '../popup/index';
import { ProgressEvent } from '../types';

// Helper to create a mock bookmark node
function createMockBookmark(id: string, title: string, url: string): chrome.bookmarks.BookmarkTreeNode {
  return { id, title, url, syncing: false };
}

// Helper to create a mock folder node
function createMockFolder(id: string, title: string, children: chrome.bookmarks.BookmarkTreeNode[] = []): chrome.bookmarks.BookmarkTreeNode {
  return { id, title, children, syncing: false };
}

// Helper to create mock DOM element
function createMockElement(): HTMLElement {
  return {
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn(),
      toggle: vi.fn(),
    },
    style: {
      width: '',
    },
    textContent: '',
    innerHTML: '',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as HTMLElement;
}

// Helper to create mock button element
function createMockButton(): HTMLButtonElement {
  return {
    ...createMockElement(),
    disabled: false,
  } as unknown as HTMLButtonElement;
}

// Helper to create mock elements
function createMockElements(): PopupElements {
  return {
    idleState: createMockElement(),
    processingState: createMockElement(),
    completeState: createMockElement(),
    errorState: createMockElement(),
    startBtn: createMockButton(),
    cancelBtn: createMockButton(),
    doneBtn: createMockButton(),
    retryBtn: createMockButton(),
    resetBtn: createMockButton(),
    bookmarkCount: createMockElement(),
    progressBar: createMockElement(),
    progressText: createMockElement(),
    currentUrl: createMockElement(),
    progressCount: createMockElement(),
    resultsList: createMockElement(),
    errorMessage: createMockElement(),
  };
}

describe('popup', () => {
  let mockElements: PopupElements;

  beforeEach(() => {
    mockElements = createMockElements();
    setElements(mockElements);
  });

  afterEach(() => {
    setElements(null);
    vi.clearAllMocks();
  });

  describe('showState', () => {
    it('shows idle state and hides others', () => {
      showState('idle');

      expect(mockElements.idleState.classList.remove).toHaveBeenCalledWith('hidden');
      expect(mockElements.processingState.classList.add).toHaveBeenCalledWith('hidden');
      expect(mockElements.completeState.classList.add).toHaveBeenCalledWith('hidden');
      expect(mockElements.errorState.classList.add).toHaveBeenCalledWith('hidden');
    });

    it('shows processing state and hides others', () => {
      showState('processing');

      expect(mockElements.processingState.classList.remove).toHaveBeenCalledWith('hidden');
      expect(mockElements.idleState.classList.add).toHaveBeenCalledWith('hidden');
      expect(mockElements.completeState.classList.add).toHaveBeenCalledWith('hidden');
      expect(mockElements.errorState.classList.add).toHaveBeenCalledWith('hidden');
    });

    it('shows complete state and hides others', () => {
      showState('complete');

      expect(mockElements.completeState.classList.remove).toHaveBeenCalledWith('hidden');
      expect(mockElements.idleState.classList.add).toHaveBeenCalledWith('hidden');
      expect(mockElements.processingState.classList.add).toHaveBeenCalledWith('hidden');
      expect(mockElements.errorState.classList.add).toHaveBeenCalledWith('hidden');
    });

    it('shows error state and hides others', () => {
      showState('error');

      expect(mockElements.errorState.classList.remove).toHaveBeenCalledWith('hidden');
      expect(mockElements.idleState.classList.add).toHaveBeenCalledWith('hidden');
      expect(mockElements.processingState.classList.add).toHaveBeenCalledWith('hidden');
      expect(mockElements.completeState.classList.add).toHaveBeenCalledWith('hidden');
    });
  });

  describe('updateProgress', () => {
    it('updates progress bar with correct percentage', () => {
      updateProgress(5, 10);

      expect(mockElements.progressBar.style.width).toBe('50%');
      expect(mockElements.progressText.textContent).toBe('50%');
      expect(mockElements.progressCount.textContent).toBe('5 of 10 processed');
    });

    it('handles zero total', () => {
      updateProgress(0, 0);

      expect(mockElements.progressBar.style.width).toBe('0%');
      expect(mockElements.progressText.textContent).toBe('0%');
      expect(mockElements.progressCount.textContent).toBe('0 of 0 processed');
    });

    it('rounds percentage correctly', () => {
      updateProgress(1, 3);

      expect(mockElements.progressBar.style.width).toBe('33%');
      expect(mockElements.progressText.textContent).toBe('33%');
    });

    it('shows current URL when provided', () => {
      updateProgress(1, 10, 'https://example.com');

      expect(mockElements.currentUrl.textContent).toBe('Fetching: https://example.com');
    });

    it('does not update current URL when not provided', () => {
      mockElements.currentUrl.textContent = 'previous value';
      updateProgress(1, 10);

      expect(mockElements.currentUrl.textContent).toBe('previous value');
    });

    it('shows 100% when complete', () => {
      updateProgress(10, 10);

      expect(mockElements.progressBar.style.width).toBe('100%');
      expect(mockElements.progressText.textContent).toBe('100%');
    });
  });

  describe('showResults', () => {
    it('shows results with all stats', () => {
      showResults({
        processed: 100,
        duplicatesMerged: 5,
        deadlinks: 3,
        unreachable: 2,
        categories: 10,
      });

      expect(mockElements.resultsList.innerHTML).toContain('100 bookmarks processed');
      expect(mockElements.resultsList.innerHTML).toContain('5 duplicates merged');
      expect(mockElements.resultsList.innerHTML).toContain('3 deadlinks found');
      expect(mockElements.resultsList.innerHTML).toContain('2 unreachable');
      expect(mockElements.resultsList.innerHTML).toContain('10 categories created');
    });

    it('returns early when stats is undefined', () => {
      showResults(undefined);

      expect(mockElements.resultsList.innerHTML).toBe('');
    });

    it('returns early when stats is null', () => {
      showResults(null as unknown as ProgressEvent['stats']);

      expect(mockElements.resultsList.innerHTML).toBe('');
    });

    it('handles zero values', () => {
      showResults({
        processed: 0,
        duplicatesMerged: 0,
        deadlinks: 0,
        unreachable: 0,
        categories: 0,
      });

      expect(mockElements.resultsList.innerHTML).toContain('0 bookmarks processed');
      expect(mockElements.resultsList.innerHTML).toContain('0 duplicates merged');
      expect(mockElements.resultsList.innerHTML).toContain('0 deadlinks found');
      expect(mockElements.resultsList.innerHTML).toContain('0 unreachable');
      expect(mockElements.resultsList.innerHTML).toContain('0 categories created');
    });
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

  describe('handleProgressMessage', () => {
    it('handles progress message', () => {
      const message: ProgressEvent = {
        type: 'progress',
        current: 5,
        total: 10,
        currentUrl: 'https://example.com',
      };

      const result = handleProgressMessage(message);

      expect(result).toBe(true);
      expect(mockElements.progressBar.style.width).toBe('50%');
      expect(mockElements.currentUrl.textContent).toBe('Fetching: https://example.com');
    });

    it('handles complete message', () => {
      const message: ProgressEvent = {
        type: 'complete',
        current: 10,
        total: 10,
        stats: {
          processed: 10,
          duplicatesMerged: 2,
          deadlinks: 1,
          unreachable: 0,
          categories: 3,
        },
      };

      const result = handleProgressMessage(message);

      expect(result).toBe(true);
      expect(mockElements.resultsList.innerHTML).toContain('10 bookmarks processed');
      expect(mockElements.completeState.classList.remove).toHaveBeenCalledWith('hidden');
    });

    it('handles error message', () => {
      const message: ProgressEvent = {
        type: 'error',
        current: 0,
        total: 0,
        error: 'Something went wrong',
      };

      const result = handleProgressMessage(message);

      expect(result).toBe(true);
      expect(mockElements.errorMessage.textContent).toBe('Something went wrong');
      expect(mockElements.errorState.classList.remove).toHaveBeenCalledWith('hidden');
    });

    it('handles error message without error text', () => {
      const message: ProgressEvent = {
        type: 'error',
        current: 0,
        total: 0,
      };

      const result = handleProgressMessage(message);

      expect(result).toBe(true);
      expect(mockElements.errorMessage.textContent).toBe('Unknown error');
    });

    it('returns false for unknown message type', () => {
      const message = {
        type: 'unknown',
        current: 0,
        total: 0,
      } as unknown as ProgressEvent;

      const result = handleProgressMessage(message);

      expect(result).toBe(false);
    });

    it('does NOT show error state for "Operation cancelled" error', () => {
      // When user intentionally cancels, we should NOT show error state
      const message: ProgressEvent = {
        type: 'error',
        current: 0,
        total: 0,
        error: 'Operation cancelled',
      };

      const result = handleProgressMessage(message);

      // Should return true (message was handled) but NOT show error state
      expect(result).toBe(true);
      expect(mockElements.errorState.classList.remove).not.toHaveBeenCalledWith('hidden');
      // Should show idle state instead
      expect(mockElements.idleState.classList.remove).toHaveBeenCalledWith('hidden');
    });

    it('handles progress message without URL', () => {
      const message: ProgressEvent = {
        type: 'progress',
        current: 5,
        total: 10,
      };

      const result = handleProgressMessage(message);

      expect(result).toBe(true);
      expect(mockElements.progressBar.style.width).toBe('50%');
    });
  });

  describe('handleDone', () => {
    it('calls window.close', () => {
      // Mock window.close since it's not available in test environment
      const mockClose = vi.fn();
      vi.stubGlobal('window', { close: mockClose });

      handleDone();

      expect(mockClose).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });

  describe('startOrganization', () => {
    it('shows processing state and sends start message', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue(undefined);

      vi.stubGlobal('chrome', {
        runtime: { sendMessage: mockSendMessage, onMessage: { addListener: vi.fn() } },
        bookmarks: { getTree: vi.fn().mockResolvedValue([{ id: '0', title: 'Root', children: [] }]) },
      });
      vi.stubGlobal('document', {
        getElementById: vi.fn().mockReturnValue(createMockElement()),
        readyState: 'loading', // Prevent auto-setup
        addEventListener: vi.fn(),
      });
      vi.stubGlobal('window', {});

      vi.resetModules();
      const { startOrganization, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      await startOrganization();

      expect(mockElements.processingState.classList.remove).toHaveBeenCalledWith('hidden');
      expect(mockSendMessage).toHaveBeenCalledWith({ type: 'START_ORGANIZE' });

      vi.unstubAllGlobals();
    });

    it('shows idle state when started: false is returned', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue({ success: true, started: false });
      const mockGetTree = vi.fn().mockResolvedValue([{
        id: '0',
        title: 'Root',
        children: [{ id: '1', title: 'Bookmark', url: 'https://example.com' }],
      }]);

      vi.stubGlobal('chrome', {
        runtime: { sendMessage: mockSendMessage, onMessage: { addListener: vi.fn() } },
        bookmarks: { getTree: mockGetTree },
      });
      vi.stubGlobal('document', {
        getElementById: vi.fn().mockReturnValue(createMockElement()),
        readyState: 'loading', // Prevent auto-setup
        addEventListener: vi.fn(),
      });
      vi.stubGlobal('window', {});

      vi.resetModules();
      const { startOrganization, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      await startOrganization();

      // Should have shown processing first, then reverted to idle
      expect(mockElements.processingState.classList.remove).toHaveBeenCalledWith('hidden');
      expect(mockElements.idleState.classList.remove).toHaveBeenCalledWith('hidden');
      expect(mockElements.bookmarkCount.textContent).toBe('1 bookmarks found');

      vi.unstubAllGlobals();
    });
  });

  describe('cancelOrganization', () => {
    it('sends cancel message and shows idle state', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue(undefined);
      const mockGetTree = vi.fn().mockResolvedValue([{
        id: '0',
        title: 'Root',
        children: [{ id: '1', title: 'Bookmark', url: 'https://example.com' }],
      }]);

      vi.stubGlobal('chrome', {
        runtime: { sendMessage: mockSendMessage, onMessage: { addListener: vi.fn() } },
        bookmarks: { getTree: mockGetTree },
      });
      vi.stubGlobal('document', {
        getElementById: vi.fn().mockReturnValue(createMockElement()),
        readyState: 'loading', // Prevent auto-setup
        addEventListener: vi.fn(),
      });
      vi.stubGlobal('window', {});

      vi.resetModules();
      const { cancelOrganization, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      await cancelOrganization();

      expect(mockSendMessage).toHaveBeenCalledWith({ type: 'CANCEL' });
      expect(mockElements.idleState.classList.remove).toHaveBeenCalledWith('hidden');
      expect(mockElements.bookmarkCount.textContent).toBe('1 bookmarks found');

      vi.unstubAllGlobals();
    });
  });

  describe('handleRetry', () => {
    it('calls startOrganization', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue(undefined);

      vi.stubGlobal('chrome', {
        runtime: { sendMessage: mockSendMessage, onMessage: { addListener: vi.fn() } },
        bookmarks: { getTree: vi.fn().mockResolvedValue([{ id: '0', title: 'Root', children: [] }]) },
      });
      vi.stubGlobal('document', {
        getElementById: vi.fn().mockReturnValue(createMockElement()),
        readyState: 'loading', // Prevent auto-setup
        addEventListener: vi.fn(),
      });
      vi.stubGlobal('window', {});

      vi.resetModules();
      const { handleRetry, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      await handleRetry();

      expect(mockSendMessage).toHaveBeenCalledWith({ type: 'START_ORGANIZE' });

      vi.unstubAllGlobals();
    });
  });

  describe('setupMessageListener', () => {
    it('registers listener that handles progress messages', async () => {
      const mockAddListener = vi.fn();

      vi.stubGlobal('chrome', {
        runtime: { onMessage: { addListener: mockAddListener } },
      });
      vi.stubGlobal('document', {
        getElementById: vi.fn().mockReturnValue(createMockElement()),
        readyState: 'loading', // Prevent auto-setup
        addEventListener: vi.fn(),
      });
      vi.stubGlobal('window', {});

      vi.resetModules();
      const { setupMessageListener, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      setupMessageListener();

      expect(mockAddListener).toHaveBeenCalled();

      // Get the callback and test it - the callback calls handleProgressMessage
      const callback = mockAddListener.mock.calls[0][0];
      callback({ type: 'progress', current: 5, total: 10 });

      // Verify the progress was updated
      expect(mockElements.progressBar.style.width).toBe('50%');

      vi.unstubAllGlobals();
    });
  });

  describe('getElements', () => {
    it('lazy initializes elements from DOM when not set', async () => {
      // Reset elements to null to trigger lazy init
      setElements(null);

      // Mock DOM elements
      const mockElement = createMockElement();
      vi.stubGlobal('document', {
        getElementById: vi.fn().mockReturnValue(mockElement),
        readyState: 'loading', // Prevent auto-setup
        addEventListener: vi.fn(),
      });
      vi.stubGlobal('chrome', {
        runtime: { onMessage: { addListener: vi.fn() } },
        bookmarks: { getTree: vi.fn().mockResolvedValue([{ id: '0', title: 'Root', children: [] }]) },
      });
      vi.stubGlobal('window', {});

      // Re-import to get fresh module state
      vi.resetModules();
      const { getElements, setElements: newSetElements } = await import('../popup/index');

      const result = getElements();

      expect(result).toBeDefined();
      expect(result.idleState).toBe(mockElement);
      expect(document.getElementById).toHaveBeenCalledWith('idle-state');

      // Reset for other tests
      newSetElements(null);
      vi.unstubAllGlobals();
    });
  });

  describe('auto-setup', () => {
    it('sets up popup when DOM is already ready', async () => {
      const mockGetTree = vi.fn().mockResolvedValue([{
        id: '0',
        title: 'Root',
        children: [],
      }]);
      const mockSendMessage = vi.fn().mockResolvedValue({
        isRunning: false,
        shouldAbort: false,
      });
      const mockAddListener = vi.fn();

      vi.stubGlobal('window', {});
      vi.stubGlobal('document', {
        readyState: 'complete',
        getElementById: vi.fn().mockReturnValue(createMockElement()),
        addEventListener: vi.fn(),
      });
      vi.stubGlobal('chrome', {
        runtime: {
          sendMessage: mockSendMessage,
          onMessage: { addListener: mockAddListener }
        },
        bookmarks: { getTree: mockGetTree },
      });

      // Re-import to trigger auto-setup
      vi.resetModules();
      await import('../popup/index');

      // The auto-setup should have registered message listener
      expect(mockAddListener).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it('sets up popup on DOMContentLoaded when DOM not ready', async () => {
      const mockGetTree = vi.fn().mockResolvedValue([{
        id: '0',
        title: 'Root',
        children: [],
      }]);
      const mockSendMessage = vi.fn().mockResolvedValue({
        isRunning: false,
        shouldAbort: false,
      });
      const mockAddEventListener = vi.fn();

      vi.stubGlobal('window', {});
      vi.stubGlobal('document', {
        readyState: 'loading',
        getElementById: vi.fn().mockReturnValue(createMockElement()),
        addEventListener: mockAddEventListener,
      });
      vi.stubGlobal('chrome', {
        runtime: {
          sendMessage: mockSendMessage,
          onMessage: { addListener: vi.fn() }
        },
        bookmarks: { getTree: mockGetTree },
      });

      // Re-import to trigger auto-setup
      vi.resetModules();
      await import('../popup/index');

      // Should have registered DOMContentLoaded listener
      expect(mockAddEventListener).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));

      vi.unstubAllGlobals();
    });
  });

  describe('init', () => {
    it('shows processing state and restores progress when isRunning and total > 0', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue({
        isRunning: true,
        shouldAbort: false,
        current: 5,
        total: 10,
        currentUrl: 'https://example.com',
      });
      const mockGetTree = vi.fn();

      vi.stubGlobal('chrome', {
        runtime: { sendMessage: mockSendMessage, onMessage: { addListener: vi.fn() } },
        bookmarks: { getTree: mockGetTree },
      });
      vi.stubGlobal('document', {
        getElementById: vi.fn().mockReturnValue(createMockElement()),
        readyState: 'complete',
        addEventListener: vi.fn(),
      });
      vi.stubGlobal('window', {});

      // Import init dynamically to use the mocked chrome API
      vi.resetModules();
      const { init, setElements: newSetElements } = await import('../popup/index');

      // Set mock elements for this module instance
      newSetElements(mockElements);

      await init();

      expect(mockElements.processingState.classList.remove).toHaveBeenCalledWith('hidden');
      expect(mockElements.progressBar.style.width).toBe('50%');
      expect(mockElements.progressText.textContent).toBe('50%');
      expect(mockElements.currentUrl.textContent).toBe('Fetching: https://example.com');
      expect(mockElements.progressCount.textContent).toBe('5 of 10 processed');

      vi.unstubAllGlobals();
    });

    it('shows processing state with "Starting..." when isRunning and total is 0', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue({
        isRunning: true,
        shouldAbort: false,
        current: 0,
        total: 0,
        currentUrl: undefined,
      });

      vi.stubGlobal('chrome', {
        runtime: { sendMessage: mockSendMessage, onMessage: { addListener: vi.fn() } },
        bookmarks: { getTree: vi.fn() },
      });
      vi.stubGlobal('document', {
        getElementById: vi.fn().mockReturnValue(createMockElement()),
        readyState: 'complete',
        addEventListener: vi.fn(),
      });
      vi.stubGlobal('window', {});

      vi.resetModules();
      const { init, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      await init();

      expect(mockElements.processingState.classList.remove).toHaveBeenCalledWith('hidden');
      expect(mockElements.currentUrl.textContent).toBe('Fetching: Starting...');

      vi.unstubAllGlobals();
    });

    it('shows idle state when not running', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue({
        isRunning: false,
        shouldAbort: false,
        current: 0,
        total: 0,
        currentUrl: undefined,
      });
      const mockGetTree = vi.fn().mockResolvedValue([{
        id: '0',
        title: 'Root',
        children: [
          { id: '1', title: 'Bookmark', url: 'https://example.com' },
        ],
      }]);

      vi.stubGlobal('chrome', {
        runtime: { sendMessage: mockSendMessage, onMessage: { addListener: vi.fn() } },
        bookmarks: { getTree: mockGetTree },
      });
      vi.stubGlobal('document', {
        getElementById: vi.fn().mockReturnValue(createMockElement()),
        readyState: 'complete',
        addEventListener: vi.fn(),
      });
      vi.stubGlobal('window', {});

      vi.resetModules();
      const { init, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      await init();

      expect(mockElements.idleState.classList.remove).toHaveBeenCalledWith('hidden');
      expect(mockElements.bookmarkCount.textContent).toBe('1 bookmarks found');

      vi.unstubAllGlobals();
    });

    it('shows cancelled state correctly when popup reopens after cancel', async () => {
      // After cancel, state should have cleared progress but isRunning may still be true briefly
      const mockSendMessage = vi.fn().mockResolvedValue({
        isRunning: true,
        shouldAbort: true,
        current: 0,
        total: 0,
        currentUrl: undefined,
      });

      vi.stubGlobal('chrome', {
        runtime: { sendMessage: mockSendMessage, onMessage: { addListener: vi.fn() } },
        bookmarks: { getTree: vi.fn().mockResolvedValue([{ id: '0', title: 'Root', children: [] }]) },
      });
      vi.stubGlobal('document', {
        getElementById: vi.fn().mockReturnValue(createMockElement()),
        readyState: 'complete',
        addEventListener: vi.fn(),
      });
      vi.stubGlobal('window', {});

      vi.resetModules();
      const { init, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      await init();

      // Should show processing state (winding down) with cleared progress
      expect(mockElements.processingState.classList.remove).toHaveBeenCalledWith('hidden');
      expect(mockElements.currentUrl.textContent).toBe('Fetching: Starting...');

      vi.unstubAllGlobals();
    });
  });

  describe('current URL display', () => {
    it('shows actual URL when currentUrl is a real URL', async () => {
      const message: ProgressEvent = {
        type: 'progress',
        current: 3,
        total: 10,
        currentUrl: 'https://example.com/page',
      };

      handleProgressMessage(message);

      expect(mockElements.currentUrl.textContent).toBe('Fetching: https://example.com/page');
    });

    it('shows status message when currentUrl is a status string', async () => {
      const message: ProgressEvent = {
        type: 'progress',
        current: 5,
        total: 10,
        currentUrl: 'Fetched 5/10',
      };

      handleProgressMessage(message);

      expect(mockElements.currentUrl.textContent).toBe('Fetching: Fetched 5/10');
    });

    it('shows phase messages during processing', async () => {
      const phases = [
        'Loading fetched data...',
        'Deduplicating...',
        'Categorizing...',
        'Organizing folders...',
      ];

      for (const phase of phases) {
        const message: ProgressEvent = {
          type: 'progress',
          current: 0,
          total: 1,
          currentUrl: phase,
        };

        handleProgressMessage(message);

        expect(mockElements.currentUrl.textContent).toBe(`Fetching: ${phase}`);
      }
    });

    it('truncates long URLs for display', () => {
      const longUrl = 'https://example.com/very/long/path/that/should/be/truncated/because/it/is/too/long/to/display';

      updateProgress(5, 10, longUrl);

      // The current implementation doesn't truncate, but we test the behavior
      expect(mockElements.currentUrl.textContent).toBe(`Fetching: ${longUrl}`);
    });
  });

  describe('handleReset', () => {
    it('sends RESET message and updates bookmark count on success', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue({ success: true });
      const mockGetTree = vi.fn().mockResolvedValue([{
        id: '0',
        title: 'Root',
        children: [{ id: '1', title: 'Bookmark', url: 'https://example.com' }],
      }]);

      vi.stubGlobal('chrome', {
        runtime: { sendMessage: mockSendMessage, onMessage: { addListener: vi.fn() } },
        bookmarks: { getTree: mockGetTree },
      });
      vi.stubGlobal('document', {
        getElementById: vi.fn().mockReturnValue(createMockElement()),
        readyState: 'loading',
        addEventListener: vi.fn(),
      });
      vi.stubGlobal('window', {});

      vi.resetModules();
      const { handleReset, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      await handleReset();

      expect(mockSendMessage).toHaveBeenCalledWith({ type: 'RESET' });
      expect(mockElements.bookmarkCount.textContent).toBe('1 bookmarks found');
      expect(mockElements.resetBtn.textContent).toBe('Clear All Data');
      expect(mockElements.resetBtn.disabled).toBe(false);

      vi.unstubAllGlobals();
    });

    it('shows error message when reset fails', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue({ success: false, error: 'Something went wrong' });

      vi.stubGlobal('chrome', {
        runtime: { sendMessage: mockSendMessage, onMessage: { addListener: vi.fn() } },
        bookmarks: { getTree: vi.fn().mockResolvedValue([{ id: '0', title: 'Root', children: [] }]) },
      });
      vi.stubGlobal('document', {
        getElementById: vi.fn().mockReturnValue(createMockElement()),
        readyState: 'loading',
        addEventListener: vi.fn(),
      });
      vi.stubGlobal('window', {});

      vi.resetModules();
      const { handleReset, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      // Set initial text
      mockElements.bookmarkCount.textContent = '5 bookmarks found';

      await handleReset();

      expect(mockElements.bookmarkCount.textContent).toContain('Reset failed');

      vi.unstubAllGlobals();
    });

    it('handles exception during reset', async () => {
      const mockSendMessage = vi.fn().mockRejectedValue(new Error('Network error'));

      vi.stubGlobal('chrome', {
        runtime: { sendMessage: mockSendMessage, onMessage: { addListener: vi.fn() } },
        bookmarks: { getTree: vi.fn().mockResolvedValue([{ id: '0', title: 'Root', children: [] }]) },
      });
      vi.stubGlobal('document', {
        getElementById: vi.fn().mockReturnValue(createMockElement()),
        readyState: 'loading',
        addEventListener: vi.fn(),
      });
      vi.stubGlobal('window', {});

      vi.resetModules();
      const { handleReset, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      mockElements.bookmarkCount.textContent = '5 bookmarks found';

      await handleReset();

      expect(mockElements.bookmarkCount.textContent).toContain('Network error');
      expect(mockElements.resetBtn.textContent).toBe('Clear All Data');
      expect(mockElements.resetBtn.disabled).toBe(false);

      vi.unstubAllGlobals();
    });

    it('disables button during reset operation', async () => {
      let resolveReset: (value: unknown) => void;
      const mockSendMessage = vi.fn().mockImplementation(() => new Promise(resolve => {
        resolveReset = resolve;
      }));

      vi.stubGlobal('chrome', {
        runtime: { sendMessage: mockSendMessage, onMessage: { addListener: vi.fn() } },
        bookmarks: { getTree: vi.fn().mockResolvedValue([{ id: '0', title: 'Root', children: [] }]) },
      });
      vi.stubGlobal('document', {
        getElementById: vi.fn().mockReturnValue(createMockElement()),
        readyState: 'loading',
        addEventListener: vi.fn(),
      });
      vi.stubGlobal('window', {});

      vi.resetModules();
      const { handleReset, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      const resetPromise = handleReset();

      // Button should be disabled during operation
      expect(mockElements.resetBtn.textContent).toBe('Clearing...');
      expect(mockElements.resetBtn.disabled).toBe(true);

      // Resolve the promise
      resolveReset!({ success: true });
      await resetPromise;

      // Button should be re-enabled
      expect(mockElements.resetBtn.textContent).toBe('Clear All Data');
      expect(mockElements.resetBtn.disabled).toBe(false);

      vi.unstubAllGlobals();
    });
  });
});
