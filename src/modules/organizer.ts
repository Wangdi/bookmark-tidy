// src/modules/organizer.ts

import { CategorizedBookmark, ProcessedBookmark } from '../types';

const ORGANIZED_FOLDER_NAME = '📁Organized';
const DEADLINKS_FOLDER_NAME = '⚠ Deadlinks';
const UNREACHABLE_FOLDER_NAME = '⚠ Unreachable';

export interface OrganizerResult {
  success: boolean;
  stats: {
    processed: number;
    duplicatesMerged: number;
    deadlinks: number;
    unreachable: number;
    categories: number;
  };
}

/**
 * Find existing organized folder
 */
async function findOrganizedFolder(): Promise<chrome.bookmarks.BookmarkTreeNode | null> {
  const tree = await chrome.bookmarks.getTree();
  const root = tree[0];

  // Search in root level children (Bookmarks Bar, Other Bookmarks, etc.)
  for (const rootChild of root.children || []) {
    const found = searchFolder(rootChild, ORGANIZED_FOLDER_NAME);
    if (found) return found;
  }

  return null;
}

/**
 * Recursively search for a folder by name
 */
function searchFolder(node: chrome.bookmarks.BookmarkTreeNode, name: string): chrome.bookmarks.BookmarkTreeNode | null {
  if (node.title === name && !node.url) {
    return node;
  }

  for (const child of node.children || []) {
    const found = searchFolder(child, name);
    if (found) return found;
  }

  return null;
}

/**
 * Delete existing organized folder
 */
async function deleteOrganizedFolder(): Promise<void> {
  const existing = await findOrganizedFolder();
  if (existing && existing.id) {
    await chrome.bookmarks.removeTree(existing.id);
  }
}

/**
 * Get the "Other Bookmarks" folder ID (usually "1")
 */
async function getOtherBookmarksFolderId(): Promise<string> {
  const tree = await chrome.bookmarks.getTree();
  const root = tree[0];

  // Find "Other Bookmarks" folder
  for (const child of root.children || []) {
    // Usually "Other Bookmarks" has id "2" but let's find it by checking
    if (child.id === '2' || child.title === 'Other Bookmarks' || child.title === 'Other bookmarks') {
      return child.id;
    }
  }

  // Fallback to Bookmarks Bar
  return '1';
}

/**
 * Create a bookmark folder
 */
async function createFolder(title: string, parentId: string): Promise<chrome.bookmarks.BookmarkTreeNode> {
  return chrome.bookmarks.create({
    title,
    parentId,
  });
}

/**
 * Create a bookmark
 */
async function createBookmark(
  title: string,
  url: string,
  parentId: string
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  return chrome.bookmarks.create({
    title,
    url,
    parentId,
  });
}

/**
 * Organize bookmarks into folder structure
 */
export async function organizeBookmarks(
  categorizedBookmarks: CategorizedBookmark[],
  deadlinks: ProcessedBookmark[],
  unreachable: ProcessedBookmark[],
  duplicatesMerged: number
): Promise<OrganizerResult> {
  // Delete existing organized folder
  await deleteOrganizedFolder();

  // Get parent folder for our organized folder
  const parentId = await getOtherBookmarksFolderId();

  // Create root organized folder
  const organizedFolder = await createFolder(ORGANIZED_FOLDER_NAME, parentId);

  // Group categorized bookmarks by category
  const categoryGroups = new Map<string, Map<string, CategorizedBookmark[]>>();

  for (const bookmark of categorizedBookmarks) {
    if (!categoryGroups.has(bookmark.category)) {
      categoryGroups.set(bookmark.category, new Map());
    }

    const subCategory = bookmark.subCategory || '__none__';
    if (!categoryGroups.get(bookmark.category)!.has(subCategory)) {
      categoryGroups.get(bookmark.category)!.set(subCategory, []);
    }
    categoryGroups.get(bookmark.category)!.get(subCategory)!.push(bookmark);
  }

  // Create category folders and bookmarks
  for (const [category, subGroups] of categoryGroups) {
    const hasSubCategories = subGroups.size > 1 || subGroups.has('__none__') === false;

    if (hasSubCategories && subGroups.size > 1) {
      // Create category folder with sub-categories
      const categoryFolder = await createFolder(category, organizedFolder.id);

      for (const [subCategory, bookmarks] of subGroups) {
        if (subCategory === '__none__') {
          // Bookmarks without sub-category go directly in category folder
          for (const bookmark of bookmarks) {
            await createBookmark(bookmark.title, bookmark.url, categoryFolder.id);
          }
        } else {
          // Create sub-category folder
          const subFolder = await createFolder(subCategory, categoryFolder.id);

          for (const bookmark of bookmarks) {
            await createBookmark(bookmark.title, bookmark.url, subFolder.id);
          }
        }
      }
    } else {
      // Create category folder directly
      const categoryFolder = await createFolder(category, organizedFolder.id);

      const allBookmarks = Array.from(subGroups.values()).flat();
      for (const bookmark of allBookmarks) {
        await createBookmark(bookmark.title, bookmark.url, categoryFolder.id);
      }
    }
  }

  // Create deadlinks folder if needed
  if (deadlinks.length > 0) {
    const deadlinksFolder = await createFolder(DEADLINKS_FOLDER_NAME, organizedFolder.id);

    for (const bookmark of deadlinks) {
      const title = bookmark.error
        ? `${bookmark.title} (${bookmark.error})`
        : bookmark.title;
      await createBookmark(title, bookmark.url, deadlinksFolder.id);
    }
  }

  // Create unreachable folder if needed
  if (unreachable.length > 0) {
    const unreachableFolder = await createFolder(UNREACHABLE_FOLDER_NAME, organizedFolder.id);

    for (const bookmark of unreachable) {
      const title = bookmark.error
        ? `${bookmark.title} (${bookmark.error})`
        : bookmark.title;
      await createBookmark(title, bookmark.url, unreachableFolder.id);
    }
  }

  // Calculate stats
  const uniqueCategories = new Set(categorizedBookmarks.map(b => b.category));

  return {
    success: true,
    stats: {
      processed: categorizedBookmarks.length + deadlinks.length + unreachable.length,
      duplicatesMerged,
      deadlinks: deadlinks.length,
      unreachable: unreachable.length,
      categories: uniqueCategories.size,
    },
  };
}
