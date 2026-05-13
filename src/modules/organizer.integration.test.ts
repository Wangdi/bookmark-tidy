import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  organizeBookmarks,
  ORGANIZED_FOLDER_NAME,
  DEADLINKS_FOLDER_NAME,
  UNREACHABLE_FOLDER_NAME,
} from '../modules/organizer';
import { CategorizedBookmark, ProcessedBookmark } from '../types';

// Mock Chrome APIs
const mockBookmarkTree: chrome.bookmarks.BookmarkTreeNode[] = [];
let mockCreatedFolders: chrome.bookmarks.BookmarkTreeNode[] = [];
let mockCreatedBookmarks: chrome.bookmarks.BookmarkTreeNode[] = [];
let mockFolderIdCounter = 100;
let mockBookmarkIdCounter = 1000;

// Helper to create a valid BookmarkTreeNode
function createMockNode(
  id: string,
  title: string,
  options: { url?: string; parentId?: string; children?: chrome.bookmarks.BookmarkTreeNode[] } = {}
): chrome.bookmarks.BookmarkTreeNode {
  return {
    id,
    title,
    url: options.url,
    parentId: options.parentId,
    children: options.children,
  } as chrome.bookmarks.BookmarkTreeNode;
}

vi.stubGlobal('chrome', {
  bookmarks: {
    getTree: vi.fn(async () => mockBookmarkTree),
    removeTree: vi.fn(async () => {}),
    create: vi.fn(async (details: chrome.bookmarks.CreateDetails) => {
      const id = details.url ? `bm-${mockBookmarkIdCounter++}` : `folder-${mockFolderIdCounter++}`;
      const node = createMockNode(id, details.title || '', {
        url: details.url,
        parentId: details.parentId,
      });
      if (details.url) {
        mockCreatedBookmarks.push(node);
      } else {
        mockCreatedFolders.push(node);
      }
      return node;
    }),
  },
  runtime: {
    lastError: null,
  },
});

describe('organizer integration', () => {
  const createCategorizedBookmark = (
    url: string,
    title: string,
    category: string,
    subCategory?: string
  ): CategorizedBookmark => ({
    id: Math.random().toString(),
    url,
    title,
    category,
    subCategory,
    meta: {},
    headings: [],
    status: 'ok',
  });

  const createProcessedBookmark = (
    url: string,
    title: string,
    error?: string
  ): ProcessedBookmark => ({
    id: Math.random().toString(),
    url,
    title,
    meta: {},
    headings: [],
    status: error ? 'deadlink' : 'ok',
    error,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFolderIdCounter = 100;
    mockBookmarkIdCounter = 1000;
    mockCreatedFolders = [];
    mockCreatedBookmarks = [];

    // Set up default mock tree
    mockBookmarkTree.length = 0;
    mockBookmarkTree.push(
      createMockNode('0', 'Root', {
        children: [
          createMockNode('1', 'Bookmarks Bar', { children: [] }),
          createMockNode('2', 'Other Bookmarks', { children: [] }),
        ],
      })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('organizeBookmarks', () => {
    it('creates organized folder structure', async () => {
      const bookmarks = [
        createCategorizedBookmark('https://example1.com', 'Site 1', 'Technology'),
        createCategorizedBookmark('https://example2.com', 'Site 2', 'Technology'),
        createCategorizedBookmark('https://example3.com', 'Site 3', 'News'),
      ];

      const result = await organizeBookmarks(bookmarks, [], [], 0);

      expect(result.success).toBe(true);
      expect(result.stats.categories).toBe(2);
      expect(result.stats.processed).toBe(3);
    });

    it('creates deadlinks folder with error info', async () => {
      const bookmarks = [
        createCategorizedBookmark('https://ok.com', 'OK Site', 'Technology'),
      ];
      const deadlinks = [
        createProcessedBookmark('https://dead.com', 'Dead Site', '404 Not Found'),
      ];

      const result = await organizeBookmarks(bookmarks, deadlinks, [], 0);

      expect(result.success).toBe(true);
      expect(result.stats.deadlinks).toBe(1);

      // Check that deadlink was created with error info in title
      const deadlinkBookmark = mockCreatedBookmarks.find(
        b => b.title.includes('Dead Site') && b.title.includes('404')
      );
      expect(deadlinkBookmark).toBeDefined();
    });

    it('creates unreachable folder', async () => {
      const bookmarks = [
        createCategorizedBookmark('https://ok.com', 'OK Site', 'Technology'),
      ];
      const unreachable = [
        createProcessedBookmark('https://timeout.com', 'Timeout Site', 'timeout'),
      ];

      const result = await organizeBookmarks(bookmarks, [], unreachable, 0);

      expect(result.success).toBe(true);
      expect(result.stats.unreachable).toBe(1);

      // Check that unreachable folder was created
      const unreachableFolder = mockCreatedFolders.find(
        f => f.title === UNREACHABLE_FOLDER_NAME
      );
      expect(unreachableFolder).toBeDefined();
    });

    it('creates sub-categories for large clusters', async () => {
      // Create more than SUB_CATEGORY_THRESHOLD bookmarks in one category
      const bookmarks = Array(15).fill(null).map((_, i) =>
        createCategorizedBookmark(`https://tech${i}.com`, `Tech Site ${i}`, 'Technology')
      );

      const result = await organizeBookmarks(bookmarks, [], [], 0);

      expect(result.success).toBe(true);
      expect(result.stats.processed).toBe(15);
    });

    it('includes duplicates merged in stats', async () => {
      const bookmarks = [
        createCategorizedBookmark('https://example.com', 'Site', 'Technology'),
      ];

      const result = await organizeBookmarks(bookmarks, [], [], 5);

      expect(result.stats.duplicatesMerged).toBe(5);
    });

    it('handles empty bookmarks array', async () => {
      const result = await organizeBookmarks([], [], [], 0);

      expect(result.success).toBe(true);
      expect(result.stats.processed).toBe(0);
      expect(result.stats.categories).toBe(0);
    });

    it('handles bookmarks with sub-categories', async () => {
      const bookmarks = [
        createCategorizedBookmark('https://js.com', 'JS Site', 'Technology', 'JavaScript'),
        createCategorizedBookmark('https://python.com', 'Python Site', 'Technology', 'Python'),
        createCategorizedBookmark('https://rust.com', 'Rust Site', 'Technology', 'Rust'),
      ];

      const result = await organizeBookmarks(bookmarks, [], [], 0);

      expect(result.success).toBe(true);
      expect(result.stats.categories).toBe(1);
    });

    it('handles bookmarks with mixed sub-categories and none', async () => {
      // Mix of bookmarks with and without sub-categories in the same category
      const bookmarks = [
        createCategorizedBookmark('https://js.com', 'JS Site', 'Technology', 'JavaScript'),
        createCategorizedBookmark('https://python.com', 'Python Site', 'Technology', 'Python'),
        createCategorizedBookmark('https://tech.com', 'Tech Site', 'Technology'), // No sub-category
      ];

      const result = await organizeBookmarks(bookmarks, [], [], 0);

      expect(result.success).toBe(true);
      // Verify all bookmarks were created
      expect(mockCreatedBookmarks.length).toBe(3);
    });

    it('falls back to Bookmarks Bar when Other Bookmarks not found', async () => {
      // Remove "Other Bookmarks" from tree
      mockBookmarkTree[0].children = [
        createMockNode('1', 'Bookmarks Bar', { children: [] }),
        // No "Other Bookmarks" folder
      ];

      const bookmarks = [
        createCategorizedBookmark('https://example.com', 'Site', 'Technology'),
      ];

      const result = await organizeBookmarks(bookmarks, [], [], 0);

      expect(result.success).toBe(true);
      // The organized folder should be created under Bookmarks Bar (id '1')
      const organizedFolder = mockCreatedFolders.find(
        f => f.title === ORGANIZED_FOLDER_NAME
      );
      expect(organizedFolder).toBeDefined();
      expect(organizedFolder?.parentId).toBe('1');
    });

    it('deletes existing organized folder before creating new one', async () => {
      // Add existing organized folder to tree
      mockBookmarkTree[0].children![1].children = [
        createMockNode('old-folder', ORGANIZED_FOLDER_NAME, { children: [] }),
      ];

      const bookmarks = [
        createCategorizedBookmark('https://example.com', 'Site', 'Technology'),
      ];

      const result = await organizeBookmarks(bookmarks, [], [], 0);

      expect(result.success).toBe(true);
      expect(chrome.bookmarks.removeTree).toHaveBeenCalledWith('old-folder');
    });

    it('handles mixed content correctly', async () => {
      const bookmarks = [
        createCategorizedBookmark('https://tech.com', 'Tech', 'Technology'),
        createCategorizedBookmark('https://news.com', 'News', 'News'),
      ];
      const deadlinks = [
        createProcessedBookmark('https://dead.com', 'Dead', '404'),
      ];
      const unreachable = [
        createProcessedBookmark('https://slow.com', 'Slow', 'timeout'),
      ];

      const result = await organizeBookmarks(bookmarks, deadlinks, unreachable, 2);

      expect(result.success).toBe(true);
      expect(result.stats.processed).toBe(4);
      expect(result.stats.deadlinks).toBe(1);
      expect(result.stats.unreachable).toBe(1);
      expect(result.stats.categories).toBe(2);
      expect(result.stats.duplicatesMerged).toBe(2);
    });

    it('creates bookmarks in parallel batches', async () => {
      // Create more than 10 bookmarks to test batch creation
      const bookmarks = Array(25).fill(null).map((_, i) =>
        createCategorizedBookmark(`https://tech${i}.com`, `Tech Site ${i}`, 'Technology')
      );

      const result = await organizeBookmarks(bookmarks, [], [], 0);

      expect(result.success).toBe(true);
      // All bookmarks should be created
      const bookmarkCreates = mockCreatedBookmarks.filter(b => b.url?.includes('tech'));
      expect(bookmarkCreates.length).toBe(25);
    });

    it('handles large number of bookmarks efficiently', async () => {
      // Create 100 bookmarks to verify parallel processing works
      const bookmarks = Array(100).fill(null).map((_, i) =>
        createCategorizedBookmark(`https://site${i}.com`, `Site ${i}`, `Category ${i % 5}`)
      );

      const startTime = Date.now();
      const result = await organizeBookmarks(bookmarks, [], [], 0);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.stats.processed).toBe(100);
      // Parallel creation should be reasonably fast even with many bookmarks
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });
});
