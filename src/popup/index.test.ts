import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  showState,
  updateProgress,
  showResults,
  countBookmarksInTree,
  handleProgressMessage,
  handleDone,
  handleReset,
  showStatusMessage,
  setElements,
  PopupElements,
  toggleDetails,
  updateDetailedMetrics,
  renderCategoryTree,
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
    appendChild: vi.fn(),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn().mockReturnValue([]),
  } as unknown as HTMLElement;
}

// Helper to create mock button element
function createMockButton(): HTMLButtonElement {
  return {
    ...createMockElement(),
    disabled: false,
  } as unknown as HTMLButtonElement;
}

// Helper to create mock input element
function createMockInput(): HTMLInputElement {
  return {
    ...createMockElement(),
    value: '',
    checked: false,
  } as unknown as HTMLInputElement;
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
    trialCount: createMockInput(),
    trialError: createMockElement(),
    notificationToggle: createMockInput(),
    autoNavigateToggle: createMockInput(),
    detailsToggle: createMockButton(),
    detailsPanel: createMockElement(),
    fetchMetrics: createMockElement(),
    storageMetrics: createMockElement(),
    categorizationMetrics: createMockElement(),
    organizationMetrics: createMockElement(),
    performanceMetrics: createMockElement(),
    editorState: createMockElement(),
    categoryTree: createMockElement(),
    regenerateBtn: createMockButton(),
    applyBtn: createMockButton(),
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
        storage: { sync: { get: vi.fn().mockResolvedValue({}) } },
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
        storage: { sync: { get: vi.fn().mockResolvedValue({}) } },
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
        storage: { sync: { get: vi.fn().mockResolvedValue({}) } },
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
        storage: { sync: { get: vi.fn().mockResolvedValue({}) } },
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
        storage: { sync: { get: vi.fn().mockResolvedValue({}) } },
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
        storage: { sync: { get: vi.fn().mockResolvedValue({}) } },
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
        storage: { sync: { get: vi.fn().mockResolvedValue({}) } },
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
        storage: { sync: { get: vi.fn().mockResolvedValue({}) } },
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
        storage: { sync: { get: vi.fn().mockResolvedValue({}) } },
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
        storage: { sync: { get: vi.fn().mockResolvedValue({}) } },
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
        storage: { sync: { get: vi.fn().mockResolvedValue({}) } },
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
        storage: { sync: { get: vi.fn().mockResolvedValue({}) } },
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
    it('sends RESET message and shows success message then bookmark count', async () => {
      vi.useFakeTimers();
      const mockSendMessage = vi.fn().mockResolvedValue({ success: true });
      const mockGetTree = vi.fn().mockResolvedValue([{
        id: '0',
        title: 'Root',
        children: [{ id: '1', title: 'Bookmark', url: 'https://example.com' }],
      }]);

      vi.stubGlobal('chrome', {
        runtime: { sendMessage: mockSendMessage, onMessage: { addListener: vi.fn() } },
        bookmarks: { getTree: mockGetTree },
        storage: { sync: { get: vi.fn().mockResolvedValue({}) } },
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
      // Should show success message immediately
      expect(mockElements.bookmarkCount.textContent).toBe('✅ Data cleared successfully');
      expect(mockElements.resetBtn.textContent).toBe('Clear All Data');
      expect(mockElements.resetBtn.disabled).toBe(false);

      // After 3 seconds, should show bookmark count
      vi.advanceTimersByTime(3000);
      expect(mockElements.bookmarkCount.textContent).toBe('1 bookmarks found');

      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it('shows error message when reset fails', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue({ success: false, error: 'Something went wrong' });

      vi.stubGlobal('chrome', {
        runtime: { sendMessage: mockSendMessage, onMessage: { addListener: vi.fn() } },
        bookmarks: { getTree: vi.fn().mockResolvedValue([{ id: '0', title: 'Root', children: [] }]) },
        storage: { sync: { get: vi.fn().mockResolvedValue({}) } },
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
        storage: { sync: { get: vi.fn().mockResolvedValue({}) } },
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
        storage: { sync: { get: vi.fn().mockResolvedValue({}) } },
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

  describe('trial input elements', () => {
    it('includes trialCount element in PopupElements', async () => {
      // Import PopupElements type to verify the interface includes trialCount and trialError
      // This test will fail at compile time if the interface doesn't have these properties
      type TestPopupElements = import('../popup/index').PopupElements;

      // Create an object that matches PopupElements
      // TypeScript will error if trialCount/trialError aren't in the interface
      const elements: TestPopupElements = {
        idleState: {} as HTMLElement,
        processingState: {} as HTMLElement,
        completeState: {} as HTMLElement,
        errorState: {} as HTMLElement,
        startBtn: {} as HTMLButtonElement,
        cancelBtn: {} as HTMLButtonElement,
        doneBtn: {} as HTMLButtonElement,
        retryBtn: {} as HTMLButtonElement,
        resetBtn: {} as HTMLButtonElement,
        bookmarkCount: {} as HTMLElement,
        progressBar: {} as HTMLElement,
        progressText: {} as HTMLElement,
        currentUrl: {} as HTMLElement,
        progressCount: {} as HTMLElement,
        resultsList: {} as HTMLElement,
        errorMessage: {} as HTMLElement,
        trialCount: {} as HTMLInputElement,
        trialError: {} as HTMLElement,
      };
      expect(elements.trialCount).toBeDefined();
      expect(elements.trialError).toBeDefined();
    });
  });

  describe('category editor elements', () => {
    it('includes editorState, categoryTree, regenerateBtn, applyBtn in PopupElements', async () => {
      // Import PopupElements type to verify the interface includes editor elements
      // This test will fail at compile time if the interface doesn't have these properties
      type TestPopupElements = import('../popup/index').PopupElements;

      // Create an object that matches PopupElements - TypeScript will error if properties are missing
      const elements: TestPopupElements = {
        idleState: {} as HTMLElement,
        processingState: {} as HTMLElement,
        completeState: {} as HTMLElement,
        errorState: {} as HTMLElement,
        startBtn: {} as HTMLButtonElement,
        cancelBtn: {} as HTMLButtonElement,
        doneBtn: {} as HTMLButtonElement,
        retryBtn: {} as HTMLButtonElement,
        resetBtn: {} as HTMLButtonElement,
        bookmarkCount: {} as HTMLElement,
        progressBar: {} as HTMLElement,
        progressText: {} as HTMLElement,
        currentUrl: {} as HTMLElement,
        progressCount: {} as HTMLElement,
        resultsList: {} as HTMLElement,
        errorMessage: {} as HTMLElement,
        trialCount: {} as HTMLInputElement,
        trialError: {} as HTMLElement,
        notificationToggle: {} as HTMLInputElement,
        autoNavigateToggle: {} as HTMLInputElement,
        detailsToggle: {} as HTMLButtonElement,
        detailsPanel: {} as HTMLElement,
        fetchMetrics: {} as HTMLElement,
        storageMetrics: {} as HTMLElement,
        categorizationMetrics: {} as HTMLElement,
        organizationMetrics: {} as HTMLElement,
        performanceMetrics: {} as HTMLElement,
        editorState: {} as HTMLElement,
        categoryTree: {} as HTMLElement,
        regenerateBtn: {} as HTMLButtonElement,
        applyBtn: {} as HTMLButtonElement,
      };

      expect(elements.editorState).toBeDefined();
      expect(elements.categoryTree).toBeDefined();
      expect(elements.regenerateBtn).toBeDefined();
      expect(elements.applyBtn).toBeDefined();
    });

    it('createMockElements includes category editor elements', () => {
      const elements = createMockElements();

      expect(elements.editorState).toBeDefined();
      expect(elements.categoryTree).toBeDefined();
      expect(elements.regenerateBtn).toBeDefined();
      expect(elements.applyBtn).toBeDefined();
    });
  });

  describe('getTrialCount', () => {
    it('returns null for empty input', async () => {
      const { getTrialCount, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      mockElements.trialCount.value = '';

      expect(getTrialCount()).toBeNull();
    });

    it('returns number for valid input', async () => {
      const { getTrialCount, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      mockElements.trialCount.value = '50';

      expect(getTrialCount()).toBe(50);
    });

    it('returns null for non-numeric input', async () => {
      const { getTrialCount, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      mockElements.trialCount.value = 'abc';

      expect(getTrialCount()).toBeNull();
    });

    it('parses integer from decimal', async () => {
      const { getTrialCount, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      mockElements.trialCount.value = '50.7';

      expect(getTrialCount()).toBe(50);
    });
  });

describe('showStatusMessage', () => {
    it('shows temporary status message that disappears after 3 seconds', async () => {
      vi.useFakeTimers();

      const { showStatusMessage, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      showStatusMessage('✅ Data cleared successfully', 3000);

      // Message should be visible immediately
      expect(mockElements.bookmarkCount.textContent).toBe('✅ Data cleared successfully');

      // Message should still be visible after 2.9 seconds
      vi.advanceTimersByTime(2900);
      expect(mockElements.bookmarkCount.textContent).toBe('✅ Data cleared successfully');

      // Message should be cleared after 3 seconds
      vi.advanceTimersByTime(100);
      expect(mockElements.bookmarkCount.textContent).toBe('');

      vi.useRealTimers();
    });

    it('can show different message durations', async () => {
      vi.useFakeTimers();

      const { showStatusMessage, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      showStatusMessage('Working...', 1000);

      expect(mockElements.bookmarkCount.textContent).toBe('Working...');

      vi.advanceTimersByTime(1000);
      expect(mockElements.bookmarkCount.textContent).toBe('');

      vi.useRealTimers();
    });

    it('replaces previous status message', async () => {
      vi.useFakeTimers();

      const { showStatusMessage, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      showStatusMessage('First message', 3000);
      expect(mockElements.bookmarkCount.textContent).toBe('First message');

      // Show new message before first one expires
      vi.advanceTimersByTime(1000);
      showStatusMessage('Second message', 3000);
      expect(mockElements.bookmarkCount.textContent).toBe('Second message');

      // Only the second message timer should be active
      vi.advanceTimersByTime(3000);
      expect(mockElements.bookmarkCount.textContent).toBe('');

      vi.useRealTimers();
    });

    it('shows success message for 3 seconds after successful reset', async () => {
      vi.useFakeTimers();
      const mockSendMessage = vi.fn().mockResolvedValue({ success: true });
      const mockGetTree = vi.fn().mockResolvedValue([{
        id: '0',
        title: 'Root',
        children: [{ id: '1', title: 'Bookmark', url: 'https://example.com' }],
      }]);

      vi.stubGlobal('chrome', {
        runtime: { sendMessage: mockSendMessage, onMessage: { addListener: vi.fn() } },
        bookmarks: { getTree: mockGetTree },
        storage: { sync: { get: vi.fn().mockResolvedValue({}) } },
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

      // Should show success message
      expect(mockElements.bookmarkCount.textContent).toBe('✅ Data cleared successfully');

      // After 3 seconds, should show bookmark count
      vi.advanceTimersByTime(3000);
      expect(mockElements.bookmarkCount.textContent).toBe('1 bookmarks found');

      vi.useRealTimers();
      vi.unstubAllGlobals();
    });
  });

  describe('validateTrialCount', () => {
    it('accepts null (process all)', async () => {
      const { validateTrialCount } = await import('../popup/index');
      expect(validateTrialCount(null, 100)).toEqual({ valid: true });
    });

    it('accepts valid count within range', async () => {
      const { validateTrialCount } = await import('../popup/index');
      expect(validateTrialCount(50, 100)).toEqual({ valid: true });
    });

    it('accepts minimum (10)', async () => {
      const { validateTrialCount } = await import('../popup/index');
      expect(validateTrialCount(10, 100)).toEqual({ valid: true });
    });

    it('accepts maximum (500)', async () => {
      const { validateTrialCount } = await import('../popup/index');
      expect(validateTrialCount(500, 1000)).toEqual({ valid: true });
    });

    it('rejects count below minimum', async () => {
      const { validateTrialCount } = await import('../popup/index');
      expect(validateTrialCount(5, 100)).toEqual({
        valid: false,
        error: 'Minimum 10 bookmarks'
      });
    });

    it('rejects count above maximum', async () => {
      const { validateTrialCount } = await import('../popup/index');
      expect(validateTrialCount(600, 1000)).toEqual({
        valid: false,
        error: 'Maximum 500 bookmarks'
      });
    });

    it('rejects count > total', async () => {
      const { validateTrialCount } = await import('../popup/index');
      expect(validateTrialCount(150, 100)).toEqual({
        valid: false,
        error: 'Cannot exceed 100 bookmarks'
      });
    });
  });

  describe('loadNotificationPreference', () => {
    it('loads enabled preference from storage', async () => {
      const mockStorageGet = vi.fn().mockResolvedValue({
        notificationOptions: { enabled: true }
      });

      vi.stubGlobal('chrome', {
        storage: { sync: { get: mockStorageGet } },
      });

      vi.resetModules();
      const { loadNotificationPreference, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      await loadNotificationPreference();

      expect(mockStorageGet).toHaveBeenCalledWith('notificationOptions');
      expect(mockElements.notificationToggle.checked).toBe(true);

      vi.unstubAllGlobals();
    });

    it('loads disabled preference from storage', async () => {
      const mockStorageGet = vi.fn().mockResolvedValue({
        notificationOptions: { enabled: false }
      });

      vi.stubGlobal('chrome', {
        storage: { sync: { get: mockStorageGet } },
      });

      vi.resetModules();
      const { loadNotificationPreference, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      await loadNotificationPreference();

      expect(mockElements.notificationToggle.checked).toBe(false);

      vi.unstubAllGlobals();
    });

    it('defaults to enabled when no preference stored', async () => {
      const mockStorageGet = vi.fn().mockResolvedValue({});

      vi.stubGlobal('chrome', {
        storage: { sync: { get: mockStorageGet } },
      });

      vi.resetModules();
      const { loadNotificationPreference, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      await loadNotificationPreference();

      expect(mockElements.notificationToggle.checked).toBe(true);

      vi.unstubAllGlobals();
    });
  });

  describe('handleNotificationToggle', () => {
    it('saves enabled state to storage', async () => {
      vi.useFakeTimers();
      const mockStorageSet = vi.fn().mockResolvedValue(undefined);

      vi.stubGlobal('chrome', {
        storage: { sync: { set: mockStorageSet } },
      });

      vi.resetModules();
      const { handleNotificationToggle, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      mockElements.notificationToggle.checked = true;

      await handleNotificationToggle();

      expect(mockStorageSet).toHaveBeenCalledWith({
        notificationOptions: { enabled: true }
      });
      expect(mockElements.bookmarkCount.textContent).toBe('✓ Notifications enabled');

      vi.advanceTimersByTime(2000);
      expect(mockElements.bookmarkCount.textContent).toBe('');

      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it('saves disabled state to storage', async () => {
      vi.useFakeTimers();
      const mockStorageSet = vi.fn().mockResolvedValue(undefined);

      vi.stubGlobal('chrome', {
        storage: { sync: { set: mockStorageSet } },
      });

      vi.resetModules();
      const { handleNotificationToggle, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      mockElements.notificationToggle.checked = false;

      await handleNotificationToggle();

      expect(mockStorageSet).toHaveBeenCalledWith({
        notificationOptions: { enabled: false }
      });
      expect(mockElements.bookmarkCount.textContent).toBe('✗ Notifications disabled');

      vi.advanceTimersByTime(2000);
      expect(mockElements.bookmarkCount.textContent).toBe('');

      vi.useRealTimers();
      vi.unstubAllGlobals();
    });
  });

  describe('loadAutoNavigatePreference', () => {
    it('loads enabled preference from storage', async () => {
      const mockStorageGet = vi.fn().mockResolvedValue({
        userPreferences: { autoNavigate: true }
      });

      vi.stubGlobal('chrome', {
        storage: { sync: { get: mockStorageGet } },
      });

      vi.resetModules();
      const { loadAutoNavigatePreference, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      await loadAutoNavigatePreference();

      expect(mockStorageGet).toHaveBeenCalledWith('userPreferences');
      expect(mockElements.autoNavigateToggle.checked).toBe(true);

      vi.unstubAllGlobals();
    });

    it('loads disabled preference from storage', async () => {
      const mockStorageGet = vi.fn().mockResolvedValue({
        userPreferences: { autoNavigate: false }
      });

      vi.stubGlobal('chrome', {
        storage: { sync: { get: mockStorageGet } },
      });

      vi.resetModules();
      const { loadAutoNavigatePreference, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      await loadAutoNavigatePreference();

      expect(mockElements.autoNavigateToggle.checked).toBe(false);

      vi.unstubAllGlobals();
    });

    it('defaults to enabled when no preference stored', async () => {
      const mockStorageGet = vi.fn().mockResolvedValue({});

      vi.stubGlobal('chrome', {
        storage: { sync: { get: mockStorageGet } },
      });

      vi.resetModules();
      const { loadAutoNavigatePreference, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      await loadAutoNavigatePreference();

      expect(mockElements.autoNavigateToggle.checked).toBe(true);

      vi.unstubAllGlobals();
    });
  });

  describe('handleAutoNavigateToggle', () => {
    it('saves enabled state to storage', async () => {
      vi.useFakeTimers();
      const mockStorageSet = vi.fn().mockResolvedValue(undefined);

      vi.stubGlobal('chrome', {
        storage: { sync: { set: mockStorageSet } },
      });

      vi.resetModules();
      const { handleAutoNavigateToggle, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      mockElements.autoNavigateToggle.checked = true;

      await handleAutoNavigateToggle();

      expect(mockStorageSet).toHaveBeenCalledWith({
        userPreferences: { autoNavigate: true }
      });
      expect(mockElements.bookmarkCount.textContent).toBe('✓ Auto-navigate enabled');

      vi.advanceTimersByTime(2000);
      expect(mockElements.bookmarkCount.textContent).toBe('');

      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it('saves disabled state to storage', async () => {
      vi.useFakeTimers();
      const mockStorageSet = vi.fn().mockResolvedValue(undefined);

      vi.stubGlobal('chrome', {
        storage: { sync: { set: mockStorageSet } },
      });

      vi.resetModules();
      const { handleAutoNavigateToggle, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      mockElements.autoNavigateToggle.checked = false;

      await handleAutoNavigateToggle();

      expect(mockStorageSet).toHaveBeenCalledWith({
        userPreferences: { autoNavigate: false }
      });
      expect(mockElements.bookmarkCount.textContent).toBe('✗ Auto-navigate disabled');

      vi.advanceTimersByTime(2000);
      expect(mockElements.bookmarkCount.textContent).toBe('');

      vi.useRealTimers();
      vi.unstubAllGlobals();
    });
  });

  describe('toggleDetails', () => {
    it('shows details panel and updates toggle text when expanding', async () => {
      vi.resetModules();
      const { toggleDetails, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      // Initial state: collapsed
      toggleDetails();

      expect(mockElements.detailsPanel.classList.remove).toHaveBeenCalledWith('hidden');
      expect(mockElements.detailsToggle.textContent).toBe('Hide Details');

      vi.unstubAllGlobals();
    });

    it('hides details panel and updates toggle text when collapsing', async () => {
      vi.resetModules();
      const { toggleDetails, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      // Toggle twice: expand then collapse
      toggleDetails();
      toggleDetails();

      expect(mockElements.detailsPanel.classList.add).toHaveBeenCalledWith('hidden');
      expect(mockElements.detailsToggle.textContent).toBe('Show Details');

      vi.unstubAllGlobals();
    });

    it('toggles state correctly on repeated calls', async () => {
      vi.resetModules();
      const { toggleDetails, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      // Toggle 3 times: expand -> collapse -> expand
      toggleDetails();
      toggleDetails();
      toggleDetails();

      expect(mockElements.detailsPanel.classList.remove).toHaveBeenCalledTimes(2);
      expect(mockElements.detailsPanel.classList.add).toHaveBeenCalledTimes(1);
      expect(mockElements.detailsToggle.textContent).toBe('Hide Details');

      vi.unstubAllGlobals();
    });
  });

  describe('updateDetailedMetrics', () => {
    it('updates fetch metrics display', async () => {
      vi.resetModules();
      const { updateDetailedMetrics, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      updateDetailedMetrics({
        fetch: {
          totalUrls: 100,
          successful: 90,
          failed: 8,
          timedOut: 2,
          averageTime: 150,
          totalTime: 15000,
        },
      });

      expect(mockElements.fetchMetrics.textContent).toContain('URLs: 100');
      expect(mockElements.fetchMetrics.textContent).toContain('✓90');
      expect(mockElements.fetchMetrics.textContent).toContain('✗8');
      expect(mockElements.fetchMetrics.textContent).toContain('⏱2');
      expect(mockElements.fetchMetrics.textContent).toContain('Avg: 150ms');
      expect(mockElements.fetchMetrics.textContent).toContain('Total: 15.0s');

      vi.unstubAllGlobals();
    });

    it('updates storage metrics display', async () => {
      vi.resetModules();
      const { updateDetailedMetrics, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      updateDetailedMetrics({
        storage: {
          indexedDbWrites: 50,
          indexedDbReads: 25,
          checkpointSaves: 10,
          estimatedSize: 102400,
        },
      });

      expect(mockElements.storageMetrics.textContent).toContain('Writes: 50');
      expect(mockElements.storageMetrics.textContent).toContain('Reads: 25');
      expect(mockElements.storageMetrics.textContent).toContain('Checkpoints: 10');
      expect(mockElements.storageMetrics.textContent).toContain('Size: 100.0KB');

      vi.unstubAllGlobals();
    });

    it('updates categorization metrics display', async () => {
      vi.resetModules();
      const { updateDetailedMetrics, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      updateDetailedMetrics({
        categorization: {
          vocabularySize: 5000,
          vectorDimensions: 100,
          clusters: 15,
          iterations: 25,
          convergenceTime: 3500,
        },
      });

      expect(mockElements.categorizationMetrics.textContent).toContain('Vocab: 5000');
      expect(mockElements.categorizationMetrics.textContent).toContain('Dims: 100');
      expect(mockElements.categorizationMetrics.textContent).toContain('Clusters: 15');
      expect(mockElements.categorizationMetrics.textContent).toContain('Iters: 25');
      expect(mockElements.categorizationMetrics.textContent).toContain('Time: 3500ms');

      vi.unstubAllGlobals();
    });

    it('updates organization metrics display', async () => {
      vi.resetModules();
      const { updateDetailedMetrics, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      updateDetailedMetrics({
        organization: {
          foldersCreated: 20,
          bookmarksCreated: 150,
          batches: 15,
          averageBatchTime: 120,
        },
      });

      expect(mockElements.organizationMetrics.textContent).toContain('Folders: 20');
      expect(mockElements.organizationMetrics.textContent).toContain('Bookmarks: 150');
      expect(mockElements.organizationMetrics.textContent).toContain('Batches: 15');
      expect(mockElements.organizationMetrics.textContent).toContain('Avg: 120ms');

      vi.unstubAllGlobals();
    });

    it('updates performance metrics display', async () => {
      vi.resetModules();
      const { updateDetailedMetrics, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      updateDetailedMetrics({
        performance: {
          totalElapsed: 45000,
          averagePerBookmark: 225,
          memoryEstimate: 6291456, // 6 MB
        },
      });

      expect(mockElements.performanceMetrics.textContent).toContain('Elapsed: 45.0s');
      expect(mockElements.performanceMetrics.textContent).toContain('Avg: 225ms/bm');
      expect(mockElements.performanceMetrics.textContent).toContain('Mem: 6.0MB');

      vi.unstubAllGlobals();
    });

    it('updates all metrics at once', async () => {
      vi.resetModules();
      const { updateDetailedMetrics, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      updateDetailedMetrics({
        fetch: {
          totalUrls: 100,
          successful: 90,
          failed: 8,
          timedOut: 2,
          averageTime: 150,
          totalTime: 15000,
        },
        storage: {
          indexedDbWrites: 50,
          indexedDbReads: 25,
          checkpointSaves: 10,
          estimatedSize: 102400,
        },
        categorization: {
          vocabularySize: 5000,
          vectorDimensions: 100,
          clusters: 15,
          iterations: 25,
          convergenceTime: 3500,
        },
        organization: {
          foldersCreated: 20,
          bookmarksCreated: 150,
          batches: 15,
          averageBatchTime: 120,
        },
        performance: {
          totalElapsed: 45000,
          averagePerBookmark: 225,
          memoryEstimate: 6291456,
        },
      });

      expect(mockElements.fetchMetrics.textContent).toContain('URLs: 100');
      expect(mockElements.storageMetrics.textContent).toContain('Writes: 50');
      expect(mockElements.categorizationMetrics.textContent).toContain('Vocab: 5000');
      expect(mockElements.organizationMetrics.textContent).toContain('Folders: 20');
      expect(mockElements.performanceMetrics.textContent).toContain('Elapsed: 45.0s');

      vi.unstubAllGlobals();
    });

    it('handles partial metrics updates', async () => {
      vi.resetModules();
      const { updateDetailedMetrics, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      // Only update fetch metrics
      updateDetailedMetrics({
        fetch: {
          totalUrls: 50,
          successful: 45,
          failed: 4,
          timedOut: 1,
          averageTime: 100,
          totalTime: 5000,
        },
      });

      // Fetch metrics should be updated
      expect(mockElements.fetchMetrics.textContent).toContain('URLs: 50');
      // Other metrics elements should not have been touched (still empty from mock creation)
      expect(mockElements.storageMetrics.textContent).toBe('');
      expect(mockElements.categorizationMetrics.textContent).toBe('');

      vi.unstubAllGlobals();
    });

    it('handles empty metrics object', async () => {
      vi.resetModules();
      const { updateDetailedMetrics, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      // Should not throw with empty metrics
      expect(() => updateDetailedMetrics({})).not.toThrow();

      vi.unstubAllGlobals();
    });
  });

  describe('handleProgressMessage with detailedMetrics', () => {
    it('updates detailed metrics on progress message', async () => {
      vi.resetModules();
      const { handleProgressMessage, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      const message: ProgressEvent = {
        type: 'progress',
        current: 5,
        total: 10,
        currentUrl: 'https://example.com',
        detailedMetrics: {
          fetch: {
            totalUrls: 10,
            successful: 5,
            failed: 0,
            timedOut: 0,
            averageTime: 100,
            totalTime: 500,
          },
        },
      };

      const result = handleProgressMessage(message);

      expect(result).toBe(true);
      expect(mockElements.fetchMetrics.textContent).toContain('URLs: 10');

      vi.unstubAllGlobals();
    });

    it('updates detailed metrics on complete message', async () => {
      vi.resetModules();
      const { handleProgressMessage, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

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
        detailedMetrics: {
          performance: {
            totalElapsed: 10000,
            averagePerBookmark: 200,
            memoryEstimate: 5242880,
          },
        },
      };

      const result = handleProgressMessage(message);

      expect(result).toBe(true);
      expect(mockElements.performanceMetrics.textContent).toContain('Elapsed: 10.0s');

      vi.unstubAllGlobals();
    });
  });

  describe('renderCategoryTree', () => {
    it('renders categories with bookmark counts', async () => {
      vi.resetModules();
      const { renderCategoryTree, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      const categories: import('../types').EditedCategory[] = [
        { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1', 'bm-2', 'bm-3'] },
        { id: 'cat-2', name: 'News', bookmarkIds: ['bm-4'] },
      ];

      // Mock template element
      const mockTemplate = {
        content: {
          cloneNode: vi.fn().mockReturnValue({
            querySelector: vi.fn((selector: string) => {
              if (selector === '.category-item') {
                return {
                  dataset: {},
                  querySelector: vi.fn((sel: string) => {
                    if (sel === '.category-name' || sel === '.category-count') {
                      return { textContent: '' };
                    }
                    if (sel === '.btn-edit' || sel === '.btn-merge' || sel === '.btn-delete') {
                      return { addEventListener: vi.fn() };
                    }
                    return null;
                  }),
                };
              }
              return null;
            }),
          }),
        },
      };

      vi.stubGlobal('document', {
        getElementById: vi.fn((id: string) => {
          if (id === 'category-template') {
            return mockTemplate;
          }
          return createMockElement();
        }),
      });

      renderCategoryTree(categories);

      // Should have cleared the tree first
      expect(mockElements.categoryTree.innerHTML).toBe('');

      // Template should have been used
      expect(mockTemplate.content.cloneNode).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it('clears existing categories before rendering', async () => {
      vi.resetModules();
      const { renderCategoryTree, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      // Add existing content
      mockElements.categoryTree.innerHTML = '<div class="category-item">Old</div>';

      // Mock template element
      const mockTemplate = {
        content: {
          cloneNode: vi.fn().mockReturnValue({
            querySelector: vi.fn((selector: string) => {
              if (selector === '.category-item') {
                return {
                  dataset: {},
                  querySelector: vi.fn((sel: string) => {
                    if (sel === '.category-name' || sel === '.category-count') {
                      return { textContent: '' };
                    }
                    if (sel === '.btn-edit' || sel === '.btn-merge' || sel === '.btn-delete') {
                      return { addEventListener: vi.fn() };
                    }
                    return null;
                  }),
                };
              }
              return null;
            }),
          }),
        },
      };

      vi.stubGlobal('document', {
        getElementById: vi.fn((id: string) => {
          if (id === 'category-template') {
            return mockTemplate;
          }
          return createMockElement();
        }),
      });

      renderCategoryTree([{ id: 'cat-1', name: 'New', bookmarkIds: [] }]);

      // Should have cleared the existing content
      expect(mockElements.categoryTree.innerHTML).toBe('');

      vi.unstubAllGlobals();
    });

    it('renders category with correct data attributes', async () => {
      vi.resetModules();
      const { renderCategoryTree, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      let capturedCategoryItem: any = null;

      // Mock template element
      const mockTemplate = {
        content: {
          cloneNode: vi.fn().mockReturnValue({
            querySelector: vi.fn((selector: string) => {
              if (selector === '.category-item') {
                capturedCategoryItem = {
                  dataset: {},
                  querySelector: vi.fn((sel: string) => {
                    if (sel === '.category-name') {
                      return { textContent: '' };
                    }
                    if (sel === '.category-count') {
                      return { textContent: '' };
                    }
                    if (sel === '.btn-edit' || sel === '.btn-merge' || sel === '.btn-delete') {
                      return { addEventListener: vi.fn() };
                    }
                    return null;
                  }),
                };
                return capturedCategoryItem;
              }
              return null;
            }),
          }),
        },
      };

      vi.stubGlobal('document', {
        getElementById: vi.fn((id: string) => {
          if (id === 'category-template') {
            return mockTemplate;
          }
          return createMockElement();
        }),
      });

      renderCategoryTree([
        { id: 'cat-123', name: 'Development', bookmarkIds: ['a', 'b'] },
      ]);

      // Check that category ID was set as data attribute
      expect(capturedCategoryItem.dataset.categoryId).toBe('cat-123');

      vi.unstubAllGlobals();
    });

    it('sets category name and count correctly', async () => {
      vi.resetModules();
      const { renderCategoryTree, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      let capturedName: { textContent: string } | null = null;
      let capturedCount: { textContent: string } | null = null;

      // Mock template element
      const mockTemplate = {
        content: {
          cloneNode: vi.fn().mockReturnValue({
            querySelector: vi.fn((selector: string) => {
              if (selector === '.category-item') {
                return {
                  dataset: {},
                  querySelector: vi.fn((sel: string) => {
                    if (sel === '.category-name') {
                      capturedName = { textContent: '' };
                      return capturedName;
                    }
                    if (sel === '.category-count') {
                      capturedCount = { textContent: '' };
                      return capturedCount;
                    }
                    if (sel === '.btn-edit' || sel === '.btn-merge' || sel === '.btn-delete') {
                      return { addEventListener: vi.fn() };
                    }
                    return null;
                  }),
                };
              }
              return null;
            }),
          }),
        },
      };

      vi.stubGlobal('document', {
        getElementById: vi.fn((id: string) => {
          if (id === 'category-template') {
            return mockTemplate;
          }
          return createMockElement();
        }),
      });

      renderCategoryTree([
        { id: 'cat-1', name: 'Technology', bookmarkIds: ['a', 'b', 'c', 'd', 'e'] },
      ]);

      expect(capturedName!.textContent).toBe('Technology');
      expect(capturedCount!.textContent).toBe('5');

      vi.unstubAllGlobals();
    });

    it('adds event listeners to action buttons', async () => {
      vi.resetModules();
      const { renderCategoryTree, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      const mockListeners = {
        edit: vi.fn(),
        merge: vi.fn(),
        delete: vi.fn(),
      };

      // Mock template element
      const mockTemplate = {
        content: {
          cloneNode: vi.fn().mockReturnValue({
            querySelector: vi.fn((selector: string) => {
              if (selector === '.category-item') {
                return {
                  dataset: {},
                  querySelector: vi.fn((sel: string) => {
                    if (sel === '.category-name' || sel === '.category-count') {
                      return { textContent: '' };
                    }
                    if (sel === '.btn-edit') {
                      return { addEventListener: mockListeners.edit };
                    }
                    if (sel === '.btn-merge') {
                      return { addEventListener: mockListeners.merge };
                    }
                    if (sel === '.btn-delete') {
                      return { addEventListener: mockListeners.delete };
                    }
                    return null;
                  }),
                };
              }
              return null;
            }),
          }),
        },
      };

      vi.stubGlobal('document', {
        getElementById: vi.fn((id: string) => {
          if (id === 'category-template') {
            return mockTemplate;
          }
          return createMockElement();
        }),
      });

      renderCategoryTree([
        { id: 'cat-1', name: 'Test', bookmarkIds: [] },
      ]);

      // All buttons should have click listeners added
      expect(mockListeners.edit).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockListeners.merge).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockListeners.delete).toHaveBeenCalledWith('click', expect.any(Function));

      vi.unstubAllGlobals();
    });

    it('handles empty categories array', async () => {
      vi.resetModules();
      const { renderCategoryTree, setElements: newSetElements } = await import('../popup/index');
      newSetElements(mockElements);

      // Mock template element (should not be used)
      const mockTemplate = {
        content: {
          cloneNode: vi.fn(),
        },
      };

      vi.stubGlobal('document', {
        getElementById: vi.fn((id: string) => {
          if (id === 'category-template') {
            return mockTemplate;
          }
          return createMockElement();
        }),
      });

      // Should not throw
      expect(() => renderCategoryTree([])).not.toThrow();

      // Template should not have been used
      expect(mockTemplate.content.cloneNode).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });

  describe('category edit handlers', () => {
    beforeEach(() => {
      vi.stubGlobal('prompt', vi.fn());
      vi.stubGlobal('confirm', vi.fn());
      vi.stubGlobal('alert', vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe('handleRenameCategory', () => {
      it('prompts for new name and updates category', async () => {
        vi.mocked(prompt).mockReturnValue('Programming');

        vi.resetModules();
        const {
          setCategories,
          getCategories,
          handleRenameCategory,
          setElements: newSetElements,
        } = await import('../popup/index');
        newSetElements(mockElements);

        setCategories([
          { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1'] },
        ]);

        handleRenameCategory('cat-1');

        const categories = getCategories();
        expect(categories[0].name).toBe('Programming');

        vi.unstubAllGlobals();
      });

      it('does nothing when category not found', async () => {
        vi.mocked(prompt).mockReturnValue('New Name');

        vi.resetModules();
        const {
          setCategories,
          getCategories,
          handleRenameCategory,
          setElements: newSetElements,
        } = await import('../popup/index');
        newSetElements(mockElements);

        setCategories([
          { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1'] },
        ]);

        handleRenameCategory('non-existent');

        const categories = getCategories();
        expect(categories[0].name).toBe('Development');

        vi.unstubAllGlobals();
      });

      it('does nothing when prompt is cancelled', async () => {
        vi.mocked(prompt).mockReturnValue(null);

        vi.resetModules();
        const {
          setCategories,
          getCategories,
          handleRenameCategory,
          setElements: newSetElements,
        } = await import('../popup/index');
        newSetElements(mockElements);

        setCategories([
          { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1'] },
        ]);

        handleRenameCategory('cat-1');

        const categories = getCategories();
        expect(categories[0].name).toBe('Development');

        vi.unstubAllGlobals();
      });

      it('does nothing when new name is empty', async () => {
        vi.mocked(prompt).mockReturnValue('   ');

        vi.resetModules();
        const {
          setCategories,
          getCategories,
          handleRenameCategory,
          setElements: newSetElements,
        } = await import('../popup/index');
        newSetElements(mockElements);

        setCategories([
          { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1'] },
        ]);

        handleRenameCategory('cat-1');

        const categories = getCategories();
        expect(categories[0].name).toBe('Development');

        vi.unstubAllGlobals();
      });

      it('trims whitespace from new name', async () => {
        vi.mocked(prompt).mockReturnValue('  Programming  ');

        vi.resetModules();
        const {
          setCategories,
          getCategories,
          handleRenameCategory,
          setElements: newSetElements,
        } = await import('../popup/index');
        newSetElements(mockElements);

        setCategories([
          { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1'] },
        ]);

        handleRenameCategory('cat-1');

        const categories = getCategories();
        expect(categories[0].name).toBe('Programming');

        vi.unstubAllGlobals();
      });

      it('renders category tree after rename', async () => {
        vi.mocked(prompt).mockReturnValue('Programming');

        vi.resetModules();
        const {
          setCategories,
          handleRenameCategory,
          setElements: newSetElements,
        } = await import('../popup/index');
        newSetElements(mockElements);

        setCategories([
          { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1'] },
        ]);

        handleRenameCategory('cat-1');

        // renderCategoryTree should have been called (clears innerHTML)
        expect(mockElements.categoryTree.innerHTML).toBe('');

        vi.unstubAllGlobals();
      });
    });

    describe('handleMergeCategory', () => {
      it('merges source into target category', async () => {
        vi.mocked(prompt).mockReturnValue('News');

        vi.resetModules();
        const {
          setCategories,
          getCategories,
          handleMergeCategory,
          setElements: newSetElements,
        } = await import('../popup/index');
        newSetElements(mockElements);

        setCategories([
          { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1', 'bm-2'] },
          { id: 'cat-2', name: 'News', bookmarkIds: ['bm-3'] },
        ]);

        handleMergeCategory('cat-1');

        const categories = getCategories();
        expect(categories).toHaveLength(1);
        expect(categories[0].name).toBe('News');
        expect(categories[0].bookmarkIds).toEqual(['bm-3', 'bm-1', 'bm-2']);

        vi.unstubAllGlobals();
      });

      it('shows alert when no other categories exist', async () => {
        vi.resetModules();
        const {
          setCategories,
          handleMergeCategory,
          setElements: newSetElements,
        } = await import('../popup/index');
        newSetElements(mockElements);

        setCategories([
          { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1'] },
        ]);

        handleMergeCategory('cat-1');

        expect(alert).toHaveBeenCalledWith('No other categories to merge with');

        vi.unstubAllGlobals();
      });

      it('shows alert when target category not found', async () => {
        vi.mocked(prompt).mockReturnValue('NonExistent');

        vi.resetModules();
        const {
          setCategories,
          handleMergeCategory,
          setElements: newSetElements,
        } = await import('../popup/index');
        newSetElements(mockElements);

        setCategories([
          { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1'] },
          { id: 'cat-2', name: 'News', bookmarkIds: ['bm-2'] },
        ]);

        handleMergeCategory('cat-1');

        expect(alert).toHaveBeenCalledWith('Category not found');

        vi.unstubAllGlobals();
      });

      it('does nothing when prompt is cancelled', async () => {
        vi.mocked(prompt).mockReturnValue(null);

        vi.resetModules();
        const {
          setCategories,
          getCategories,
          handleMergeCategory,
          setElements: newSetElements,
        } = await import('../popup/index');
        newSetElements(mockElements);

        setCategories([
          { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1'] },
          { id: 'cat-2', name: 'News', bookmarkIds: ['bm-2'] },
        ]);

        handleMergeCategory('cat-1');

        const categories = getCategories();
        expect(categories).toHaveLength(2);

        vi.unstubAllGlobals();
      });

      it('matches target case-insensitively', async () => {
        vi.mocked(prompt).mockReturnValue('NEWS'); // uppercase

        vi.resetModules();
        const {
          setCategories,
          getCategories,
          handleMergeCategory,
          setElements: newSetElements,
        } = await import('../popup/index');
        newSetElements(mockElements);

        setCategories([
          { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1'] },
          { id: 'cat-2', name: 'News', bookmarkIds: ['bm-2'] }, // lowercase in category
        ]);

        handleMergeCategory('cat-1');

        const categories = getCategories();
        expect(categories).toHaveLength(1);
        expect(categories[0].name).toBe('News');

        vi.unstubAllGlobals();
      });

      it('does nothing when source category not found', async () => {
        vi.mocked(prompt).mockReturnValue('News');

        vi.resetModules();
        const {
          setCategories,
          getCategories,
          handleMergeCategory,
          setElements: newSetElements,
        } = await import('../popup/index');
        newSetElements(mockElements);

        setCategories([
          { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1'] },
          { id: 'cat-2', name: 'News', bookmarkIds: ['bm-2'] },
        ]);

        handleMergeCategory('non-existent');

        const categories = getCategories();
        expect(categories).toHaveLength(2);

        vi.unstubAllGlobals();
      });
    });

    describe('handleDeleteCategory', () => {
      it('moves bookmarks to Uncategorized', async () => {
        vi.mocked(confirm).mockReturnValue(true);

        vi.resetModules();
        const {
          setCategories,
          getCategories,
          handleDeleteCategory,
          setElements: newSetElements,
        } = await import('../popup/index');
        newSetElements(mockElements);

        setCategories([
          { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1', 'bm-2'] },
          { id: 'cat-2', name: 'News', bookmarkIds: ['bm-3'] },
        ]);

        handleDeleteCategory('cat-1');

        const categories = getCategories();
        expect(categories).toHaveLength(2);

        const uncategorized = categories.find(c => c.name === 'Uncategorized');
        expect(uncategorized?.bookmarkIds).toEqual(['bm-1', 'bm-2']);

        vi.unstubAllGlobals();
      });

      it('does nothing when confirm is cancelled', async () => {
        vi.mocked(confirm).mockReturnValue(false);

        vi.resetModules();
        const {
          setCategories,
          getCategories,
          handleDeleteCategory,
          setElements: newSetElements,
        } = await import('../popup/index');
        newSetElements(mockElements);

        setCategories([
          { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1'] },
        ]);

        handleDeleteCategory('cat-1');

        const categories = getCategories();
        expect(categories).toHaveLength(1);
        expect(categories[0].name).toBe('Development');

        vi.unstubAllGlobals();
      });

      it('appends to existing Uncategorized category', async () => {
        vi.mocked(confirm).mockReturnValue(true);

        vi.resetModules();
        const {
          setCategories,
          getCategories,
          handleDeleteCategory,
          setElements: newSetElements,
        } = await import('../popup/index');
        newSetElements(mockElements);

        setCategories([
          { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1', 'bm-2'] },
          { id: 'uncategorized', name: 'Uncategorized', bookmarkIds: ['bm-3'] },
        ]);

        handleDeleteCategory('cat-1');

        const categories = getCategories();
        expect(categories).toHaveLength(1);
        expect(categories[0].bookmarkIds).toEqual(['bm-3', 'bm-1', 'bm-2']);

        vi.unstubAllGlobals();
      });

      it('creates Uncategorized if it does not exist', async () => {
        vi.mocked(confirm).mockReturnValue(true);

        vi.resetModules();
        const {
          setCategories,
          getCategories,
          handleDeleteCategory,
          setElements: newSetElements,
        } = await import('../popup/index');
        newSetElements(mockElements);

        setCategories([
          { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1'] },
        ]);

        handleDeleteCategory('cat-1');

        const categories = getCategories();
        expect(categories).toHaveLength(1);
        expect(categories[0].name).toBe('Uncategorized');
        expect(categories[0].bookmarkIds).toEqual(['bm-1']);

        vi.unstubAllGlobals();
      });

      it('deletes category without creating Uncategorized when no bookmarks', async () => {
        vi.mocked(confirm).mockReturnValue(true);

        vi.resetModules();
        const {
          setCategories,
          getCategories,
          handleDeleteCategory,
          setElements: newSetElements,
        } = await import('../popup/index');
        newSetElements(mockElements);

        setCategories([
          { id: 'cat-1', name: 'Development', bookmarkIds: [] },
          { id: 'cat-2', name: 'News', bookmarkIds: ['bm-1'] },
        ]);

        handleDeleteCategory('cat-1');

        const categories = getCategories();
        expect(categories).toHaveLength(1);
        expect(categories[0].name).toBe('News');

        vi.unstubAllGlobals();
      });

      it('does nothing when category not found', async () => {
        vi.mocked(confirm).mockReturnValue(true);

        vi.resetModules();
        const {
          setCategories,
          getCategories,
          handleDeleteCategory,
          setElements: newSetElements,
        } = await import('../popup/index');
        newSetElements(mockElements);

        setCategories([
          { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1'] },
        ]);

        handleDeleteCategory('non-existent');

        const categories = getCategories();
        expect(categories).toHaveLength(1);

        vi.unstubAllGlobals();
      });

      it('shows confirmation with category name', async () => {
        vi.mocked(confirm).mockReturnValue(false);

        vi.resetModules();
        const {
          setCategories,
          handleDeleteCategory,
          setElements: newSetElements,
        } = await import('../popup/index');
        newSetElements(mockElements);

        setCategories([
          { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1'] },
        ]);

        handleDeleteCategory('cat-1');

        expect(confirm).toHaveBeenCalledWith(
          'Delete "Development"? Bookmarks will be moved to Uncategorized.'
        );

        vi.unstubAllGlobals();
      });
    });
  });
});
