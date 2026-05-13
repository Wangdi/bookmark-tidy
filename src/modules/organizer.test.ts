import { describe, it, expect } from 'vitest';
import {
  searchFolder,
  ORGANIZED_FOLDER_NAME,
  DEADLINKS_FOLDER_NAME,
  UNREACHABLE_FOLDER_NAME,
} from '../modules/organizer';
import { vi } from 'vitest';

// Helper to create a minimal BookmarkTreeNode for testing
type PartialBookmarkTreeNode = Partial<chrome.bookmarks.BookmarkTreeNode> & {
  id: string;
  title: string;
};

function createTestNode(node: PartialBookmarkTreeNode): chrome.bookmarks.BookmarkTreeNode {
  return node as chrome.bookmarks.BookmarkTreeNode;
}

describe('organizer', () => {
  describe('searchFolder', () => {
    const createFolderNode = (
      title: string,
      id: string,
      children: chrome.bookmarks.BookmarkTreeNode[] = []
    ): chrome.bookmarks.BookmarkTreeNode =>
      createTestNode({ id, title, children, url: undefined });

    const createBookmarkNode = (
      title: string,
      id: string,
      url: string
    ): chrome.bookmarks.BookmarkTreeNode =>
      createTestNode({ id, title, url, children: undefined });

    it('finds folder by name', () => {
      const folder = createFolderNode('Target Folder', '123');
      const result = searchFolder(folder, 'Target Folder');

      expect(result).toBe(folder);
    });

    it('returns null for non-matching folder name', () => {
      const folder = createFolderNode('Other Folder', '123');
      const result = searchFolder(folder, 'Target Folder');

      expect(result).toBeNull();
    });

    it('finds folder in nested structure', () => {
      const target = createFolderNode('Target', 'target-id');
      const parent = createFolderNode('Parent', 'parent-id', [target]);
      const root = createFolderNode('Root', 'root-id', [parent]);

      const result = searchFolder(root, 'Target');

      expect(result).toBe(target);
    });

    it('finds deeply nested folder', () => {
      const target = createFolderNode('Deep Target', 'deep-id');
      const level2 = createFolderNode('Level2', 'l2-id', [target]);
      const level1 = createFolderNode('Level1', 'l1-id', [level2]);
      const root = createFolderNode('Root', 'root-id', [level1]);

      const result = searchFolder(root, 'Deep Target');

      expect(result).toBe(target);
    });

    it('does not match bookmarks (only folders)', () => {
      const bookmark = createBookmarkNode('Target', 'bm-id', 'https://example.com');
      const result = searchFolder(bookmark, 'Target');

      expect(result).toBeNull();
    });

    it('returns first match in breadth-first order', () => {
      const first = createFolderNode('Target', 'first-id');
      const second = createFolderNode('Target', 'second-id');
      const root = createFolderNode('Root', 'root-id', [first, second]);

      const result = searchFolder(root, 'Target');

      expect(result).toBe(first);
    });

    it('handles node with no children', () => {
      const folder = createFolderNode('Empty Folder', '123');
      const result = searchFolder(folder, 'Not Found');

      expect(result).toBeNull();
    });

    it('handles node with undefined children', () => {
      const node = createTestNode({
        id: '123',
        title: 'Test',
        children: undefined,
      });
      const result = searchFolder(node, 'Not Found');

      expect(result).toBeNull();
    });

    it('finds folder among bookmarks', () => {
      const target = createFolderNode('Target', 'target-id');
      const bm1 = createBookmarkNode('Bookmark 1', 'bm1', 'https://example.com/1');
      const bm2 = createBookmarkNode('Bookmark 2', 'bm2', 'https://example.com/2');
      const parent = createFolderNode('Parent', 'parent-id', [bm1, target, bm2]);

      const result = searchFolder(parent, 'Target');

      expect(result).toBe(target);
    });
  });

  describe('constants', () => {
    it('ORGANIZED_FOLDER_NAME is set correctly', () => {
      expect(ORGANIZED_FOLDER_NAME).toBe('📁Organized');
    });

    it('DEADLINKS_FOLDER_NAME is set correctly', () => {
      expect(DEADLINKS_FOLDER_NAME).toBe('⚠ Deadlinks');
    });

    it('UNREACHABLE_FOLDER_NAME is set correctly', () => {
      expect(UNREACHABLE_FOLDER_NAME).toBe('⚠ Unreachable');
    });
  });
});

describe('organizeBookmarks custom folder name', () => {
  it('accepts custom folder name parameter', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: '1', title: 'Test' });
    vi.stubGlobal('chrome', {
      bookmarks: {
        getTree: vi.fn().mockResolvedValue([{ id: '0', title: 'Root', children: [] }]),
        removeTree: vi.fn(),
        create: mockCreate,
      },
      runtime: { lastError: null },
    });

    const { organizeBookmarks } = await import('../modules/organizer');
    await organizeBookmarks([], [], [], 0, '📁Organized (Trial 25) - 2026-05-14');

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: '📁Organized (Trial 25) - 2026-05-14' })
    );

    vi.unstubAllGlobals();
  });

  it('uses default folder name when not specified', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: '1', title: 'Test' });
    vi.stubGlobal('chrome', {
      bookmarks: {
        getTree: vi.fn().mockResolvedValue([{ id: '0', title: 'Root', children: [] }]),
        removeTree: vi.fn(),
        create: mockCreate,
      },
      runtime: { lastError: null },
    });

    const { organizeBookmarks } = await import('../modules/organizer');
    await organizeBookmarks([], [], [], 0);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: '📁Organized' })
    );

    vi.unstubAllGlobals();
  });
});
