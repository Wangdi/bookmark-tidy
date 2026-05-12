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

// Helper to create mock elements
function createMockElements(): PopupElements {
  return {
    idleState: createMockElement(),
    processingState: createMockElement(),
    completeState: createMockElement(),
    errorState: createMockElement(),
    startBtn: createMockElement(),
    cancelBtn: createMockElement(),
    doneBtn: createMockElement(),
    retryBtn: createMockElement(),
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
});
