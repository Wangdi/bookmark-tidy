// src/background/index.ts

import { RawBookmark, ProgressEvent, OrganizerState } from "../types";
import { fetchBookmarks } from "../modules/fetcher";
import { dedupeBookmarks } from "../modules/deduper";
import { categorizeBookmarks } from "../modules/categorizer";
import { organizeBookmarks } from "../modules/organizer";

/**
 * State manager - exported for testing
 */
export const state: OrganizerState = {
  isRunning: false,
  shouldAbort: false,
  current: 0,
  total: 0,
  currentUrl: undefined,
};

/**
 * Reset state (for testing)
 */
export function resetState(): void {
  state.isRunning = false;
  state.shouldAbort = false;
  state.current = 0;
  state.total = 0;
  state.currentUrl = undefined;
}

/**
 * Count bookmarks in tree (pure function for testability)
 */
export function countBookmarksInTree(tree: chrome.bookmarks.BookmarkTreeNode[]): number {
  let count = 0;

  function traverse(node: chrome.bookmarks.BookmarkTreeNode) {
    if (node.url) count++;
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  for (const root of tree) {
    traverse(root);
  }

  return count;
}

/**
 * Extract bookmarks from tree (pure function for testability)
 */
export function extractBookmarksFromTree(tree: chrome.bookmarks.BookmarkTreeNode[]): RawBookmark[] {
  const bookmarks: RawBookmark[] = [];

  function traverse(node: chrome.bookmarks.BookmarkTreeNode) {
    if (node.url) {
      bookmarks.push({
        id: node.id,
        url: node.url,
        title: node.title,
        parentId: node.parentId,
      });
    }
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  for (const root of tree) {
    traverse(root);
  }

  return bookmarks;
}

/**
 * Get all bookmarks from Chrome
 */
export async function getAllBookmarks(): Promise<RawBookmark[]> {
  const tree = await chrome.bookmarks.getTree();
  return extractBookmarksFromTree(tree);
}

/**
 * Send progress event to popup and update state
 */
export async function sendProgress(event: ProgressEvent): Promise<void> {
  // Update state so popup can restore progress on reopen
  if (event.type === 'progress') {
    state.current = event.current;
    state.total = event.total;
    state.currentUrl = event.currentUrl;
  } else if (event.type === 'complete' || event.type === 'error') {
    // Clear progress on completion or error
    state.current = 0;
    state.total = 0;
    state.currentUrl = undefined;
  }

  try {
    await chrome.runtime.sendMessage(event);
  } catch {
    // Popup might be closed, ignore
  }
}

/**
 * Run the organization pipeline
 */
export async function runOrganization(): Promise<void> {
  if (state.isRunning) {
    return;
  }

  state.isRunning = true;
  state.shouldAbort = false;

  try {
    // Step 1: Get all bookmarks
    const rawBookmarks = await getAllBookmarks();

    if (rawBookmarks.length === 0) {
      await sendProgress({
        type: "error",
        current: 0,
        total: 0,
        error: "No bookmarks found",
      });
      return;
    }

    const total = rawBookmarks.length;

    // Step 2: Fetch all bookmarks
    await sendProgress({
      type: "progress",
      current: 0,
      total,
      currentUrl: "Starting...",
    });

    const fetchResult = await fetchBookmarks(rawBookmarks, {
      onProgress: async (current, total, url) => {
        await sendProgress({
          type: "progress",
          current,
          total,
          currentUrl: url,
        });
      },
      shouldAbort: () => state.shouldAbort,
    });

    if (state.shouldAbort) {
      await sendProgress({
        type: "error",
        current: 0,
        total: 0,
        error: "Operation cancelled",
      });
      return;
    }

    // Step 3: Deduplicate
    const dedupeResult = dedupeBookmarks(fetchResult.bookmarks);

    // Step 4: Categorize
    const categorizeResult = categorizeBookmarks(dedupeResult.bookmarks);

    // Step 5: Organize
    const organizeResult = await organizeBookmarks(
      categorizeResult.bookmarks,
      fetchResult.deadlinks,
      fetchResult.unreachable,
      dedupeResult.duplicatesMerged,
    );

    // Send completion
    await sendProgress({
      type: "complete",
      current: total,
      total,
      stats: organizeResult.stats,
    });
  } catch (error) {
    await sendProgress({
      type: "error",
      current: 0,
      total: 0,
      error: (error as Error).message,
    });
  } finally {
    state.isRunning = false;
    state.shouldAbort = false;
  }
}

/**
 * Cancel running operation
 */
export function cancelOperation(): void {
  state.shouldAbort = true;
}

/**
 * Get current state
 */
export function getState(): OrganizerState {
  return { ...state };
}

/**
 * Handle message from popup
 */
export function handleMessage(
  message: { type: string },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean {
  if (message.type === "START_ORGANIZE") {
    runOrganization();
    sendResponse({ success: true });
  } else if (message.type === "CANCEL") {
    cancelOperation();
    sendResponse({ success: true });
  } else if (message.type === "GET_STATE") {
    sendResponse(getState());
  }
  return true; // Keep message channel open for async response
}

/**
 * Setup message listener
 */
export function setupMessageListener(): void {
  chrome.runtime.onMessage.addListener(handleMessage);
}

// Auto-setup when service worker loads (only in browser environment)
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  setupMessageListener();
  console.log("Bookmark Tidy service worker started");
}