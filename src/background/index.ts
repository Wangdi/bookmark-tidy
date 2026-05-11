// src/background/index.ts

import { RawBookmark, ProgressEvent, OrganizerState } from "../types";
import { fetchBookmarks } from "../modules/fetcher";
import { dedupeBookmarks } from "../modules/deduper";
import { categorizeBookmarks } from "../modules/categorizer";
import { organizeBookmarks } from "../modules/organizer";

const state: OrganizerState = {
  isRunning: false,
  shouldAbort: false,
};

/**
 * Get all bookmarks from Chrome
 */
async function getAllBookmarks(): Promise<RawBookmark[]> {
  const tree = await chrome.bookmarks.getTree();
  const bookmarks: RawBookmark[] = [];

  function traverse(node: chrome.bookmarks.BookmarkTreeNode) {
    if (node.url) {
      // It's a bookmark (not a folder)
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
 * Send progress event to popup
 */
async function sendProgress(event: ProgressEvent): Promise<void> {
  try {
    await chrome.runtime.sendMessage(event);
  } catch {
    // Popup might be closed, ignore
  }
}

/**
 * Run the organization pipeline
 */
async function runOrganization(): Promise<void> {
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
function cancelOperation(): void {
  state.shouldAbort = true;
}

/**
 * Get current state
 */
function getState(): OrganizerState {
  return { ...state };
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
});

// Log when service worker starts
console.log("Bookmark Tidy service worker started");
