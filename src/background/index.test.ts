import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  countBookmarksInTree,
  extractBookmarksFromTree,
  getState,
  cancelOperation,
  resetState,
  state,
  handleMessage,
} from '../background/index';

// Helper to create a mock bookmark node
function createMockBookmark(id: string, title: string, url: string, parentId?: string): chrome.bookmarks.BookmarkTreeNode {
  return { id, title, url, parentId, syncing: false };
}

// Helper to create a mock folder node
function createMockFolder(id: string, title: string, children: chrome.bookmarks.BookmarkTreeNode[] = []): chrome.bookmarks.BookmarkTreeNode {
  return { id, title, children, syncing: false };
}

describe('background unit tests', () => {
  beforeEach(() => {
    resetState();
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
      expect(currentState).toEqual({ isRunning: false, shouldAbort: false });

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

      resetState();

      expect(state.isRunning).toBe(false);
      expect(state.shouldAbort).toBe(false);
    });
  });

  describe('handleMessage', () => {
    it('responds to GET_STATE', () => {
      const sendResponse = vi.fn();

      handleMessage({ type: 'GET_STATE' }, {} as chrome.runtime.MessageSender, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({ isRunning: false, shouldAbort: false });
    });

    it('responds to CANCEL', () => {
      const sendResponse = vi.fn();

      handleMessage({ type: 'CANCEL' }, {} as chrome.runtime.MessageSender, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({ success: true });
      expect(state.shouldAbort).toBe(true);
    });

    it('responds to START_ORGANIZE', () => {
      const sendResponse = vi.fn();

      handleMessage({ type: 'START_ORGANIZE' }, {} as chrome.runtime.MessageSender, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({ success: true });
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
