import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  countBookmarksInTree,
  extractBookmarksFromTree,
  getState,
  cancelOperation,
  resetState,
  state,
  handleMessage,
} from '../background/index';

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
        {
          id: '1',
          title: 'Root',
          children: [
            { id: '2', title: 'Bookmark 1', url: 'https://example1.com' },
            { id: '3', title: 'Bookmark 2', url: 'https://example2.com' },
          ],
        },
      ];

      expect(countBookmarksInTree(tree)).toBe(2);
    });

    it('counts bookmarks in nested tree', () => {
      const tree: chrome.bookmarks.BookmarkTreeNode[] = [
        {
          id: '1',
          title: 'Root',
          children: [
            {
              id: '2',
              title: 'Folder',
              children: [
                { id: '3', title: 'Bookmark 1', url: 'https://example1.com' },
                { id: '4', title: 'Bookmark 2', url: 'https://example2.com' },
              ],
            },
            { id: '5', title: 'Bookmark 3', url: 'https://example3.com' },
          ],
        },
      ];

      expect(countBookmarksInTree(tree)).toBe(3);
    });

    it('returns 0 for empty tree', () => {
      expect(countBookmarksInTree([])).toBe(0);
    });

    it('returns 0 for tree with only folders', () => {
      const tree: chrome.bookmarks.BookmarkTreeNode[] = [
        {
          id: '1',
          title: 'Root',
          children: [
            {
              id: '2',
              title: 'Folder',
              children: [],
            },
          ],
        },
      ];

      expect(countBookmarksInTree(tree)).toBe(0);
    });

    it('handles multiple root nodes', () => {
      const tree: chrome.bookmarks.BookmarkTreeNode[] = [
        {
          id: '1',
          title: 'Root 1',
          children: [
            { id: '2', title: 'Bookmark 1', url: 'https://example1.com' },
          ],
        },
        {
          id: '3',
          title: 'Root 2',
          children: [
            { id: '4', title: 'Bookmark 2', url: 'https://example2.com' },
          ],
        },
      ];

      expect(countBookmarksInTree(tree)).toBe(2);
    });

    it('handles deeply nested structure', () => {
      const tree: chrome.bookmarks.BookmarkTreeNode[] = [
        {
          id: '1',
          title: 'Root',
          children: [
            {
              id: '2',
              title: 'Level 1',
              children: [
                {
                  id: '3',
                  title: 'Level 2',
                  children: [
                    {
                      id: '4',
                      title: 'Level 3',
                      children: [
                        { id: '5', title: 'Deep Bookmark', url: 'https://example.com' },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];

      expect(countBookmarksInTree(tree)).toBe(1);
    });
  });

  describe('extractBookmarksFromTree', () => {
    it('extracts bookmarks with all properties', () => {
      const tree: chrome.bookmarks.BookmarkTreeNode[] = [
        {
          id: '1',
          title: 'Root',
          children: [
            { id: '2', title: 'Bookmark 1', url: 'https://example.com', parentId: '1' },
          ],
        },
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
        {
          id: '1',
          title: 'Root',
          children: [
            { id: '2', title: 'Bookmark 1', url: 'https://example1.com' },
            { id: '3', title: 'Bookmark 2', url: 'https://example2.com' },
            { id: '4', title: 'Bookmark 3', url: 'https://example3.com' },
          ],
        },
      ];

      const bookmarks = extractBookmarksFromTree(tree);

      expect(bookmarks).toHaveLength(3);
    });

    it('returns empty array for empty tree', () => {
      expect(extractBookmarksFromTree([])).toEqual([]);
    });

    it('skips folders without URLs', () => {
      const tree: chrome.bookmarks.BookmarkTreeNode[] = [
        {
          id: '1',
          title: 'Root',
          children: [
            { id: '2', title: 'Bookmark', url: 'https://example.com' },
            { id: '3', title: 'Folder', children: [] },
          ],
        },
      ];

      const bookmarks = extractBookmarksFromTree(tree);

      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].title).toBe('Bookmark');
    });

    it('extracts from nested folders', () => {
      const tree: chrome.bookmarks.BookmarkTreeNode[] = [
        {
          id: '1',
          title: 'Root',
          children: [
            {
              id: '2',
              title: 'Folder A',
              children: [
                { id: '3', title: 'Inner Bookmark', url: 'https://example.com' },
              ],
            },
          ],
        },
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
