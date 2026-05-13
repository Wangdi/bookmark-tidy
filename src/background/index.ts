// src/background/index.ts

import { RawBookmark, ProgressEvent, OrganizerState, OrganizationOptions, TrialInfo, NotificationOptions, NotificationPayload, UserPreferences, OrganizedFolderInfo } from "../types";
import { fetchBookmark } from "../modules/fetcher";
import { dedupeBookmarks } from "../modules/deduper";
import { categorizeBookmarks, categorizeBookmarksSparse } from "../modules/categorizer";
import { organizeBookmarks, clearOrganizedFolder } from "../modules/organizer";
import {
  storeFetched,
  loadAllFetched,
  clearAll,
  saveCheckpoint,
  loadCheckpoint,
} from "../lib/storage";

/**
 * Configuration for two-phase processing
 */
const FETCH_BATCH_SIZE = 10;  // Number of URLs to fetch concurrently
const SPARSE_THRESHOLD = 500; // Use sparse vectors for collections > 500 bookmarks

/**
 * Trial mode configuration
 */
export const TRIAL_MIN_BOOKMARKS = 10;
export const TRIAL_MAX_BOOKMARKS = 500;
export const TRIAL_DEFAULT_BOOKMARKS = 50;

/**
 * State manager - exported for testing
 */
export const state: OrganizerState = {
  isRunning: false,
  shouldAbort: false,
  current: 0,
  total: 0,
  currentUrl: undefined,
  isTrialMode: false,
};

/**
 * AbortController for cancelling in-flight fetch operations
 */
let fetchAbortController: AbortController | null = null;

/**
 * Generate trial folder name with count and timestamp
 * Format: 📁Organized (Trial N) - YYYY-MM-DD
 */
export function generateTrialFolderName(
  count: number,
  date?: string
): string {
  const dateStr = date || new Date().toISOString().split('T')[0];
  return `📁Organized (Trial ${count}) - ${dateStr}`;
}

/**
 * Fisher-Yates shuffle for uniform random selection
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Select N random bookmarks from pool
 */
export function selectRandomBookmarks<T>(
  bookmarks: T[],
  count: number
): T[] {
  if (count >= bookmarks.length) {
    return bookmarks;
  }
  return shuffleArray(bookmarks).slice(0, count);
}

/**
 * Reset state (for testing)
 */
export function resetState(): void {
  state.isRunning = false;
  state.shouldAbort = false;
  state.current = 0;
  state.total = 0;
  state.currentUrl = undefined;
  state.isTrialMode = false;
}

/**
 * Check if popup is currently focused/connected
 */
export async function isPopupFocused(): Promise<boolean> {
  try {
    // Try to connect to popup - if it exists, it's focused
    const port = chrome.runtime.connect({ name: 'popup-check' });
    port.disconnect();
    return true;
  } catch {
    return false;
  }
}

/**
 * Send Chrome notification
 */
export async function sendNotification(payload: NotificationPayload): Promise<string> {
  let message = payload.message;

  // Append stats if provided
  if (payload.stats) {
    message = `${payload.message}\n\n` +
      `📊 ${payload.stats.processed} bookmarks processed\n` +
      `📁 ${payload.stats.categories} categories created\n` +
      `⚠️ ${payload.stats.deadlinks} deadlinks found\n` +
      `🔄 ${payload.stats.duplicatesMerged} duplicates merged`;
  }

  // Append error if provided
  if (payload.error) {
    message = `${message}\n\n❌ Error: ${payload.error}`;
  }

  const notificationId = await chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: payload.title,
    message: message,
    priority: 2,
    requireInteraction: false,
  });

  return notificationId;
}

/**
 * Get notification preferences from storage
 */
export async function getNotificationPreferences(): Promise<NotificationOptions> {
  const result = await chrome.storage.sync.get('notificationOptions');
  return result.notificationOptions || { enabled: true };
}

/**
 * Set notification preferences in storage
 */
export async function setNotificationPreferences(options: NotificationOptions): Promise<void> {
  await chrome.storage.sync.set({ notificationOptions: options });
}

/**
 * Handle notification click - open popup or bookmarks page
 */
export async function handleNotificationClick(notificationId: string): Promise<void> {
  try {
    // Try to open popup (works if extension is in toolbar)
    await chrome.action.openPopup();
  } catch {
    // Fallback: open bookmarks page
    await chrome.tabs.create({ url: 'chrome://bookmarks/' });
  }

  // Clear the notification
  await chrome.notifications.clear(notificationId);
}

/**
 * Find a folder by title in the bookmark tree
 */
export async function findFolderByTitle(title: string): Promise<OrganizedFolderInfo | null> {
  const tree = await chrome.bookmarks.getTree();

  function searchFolder(node: chrome.bookmarks.BookmarkTreeNode): chrome.bookmarks.BookmarkTreeNode | null {
    if (node.title === title && !node.url) {
      return node;
    }
    for (const child of node.children || []) {
      const found = searchFolder(child);
      if (found) return found;
    }
    return null;
  }

  for (const root of tree) {
    for (const child of root.children || []) {
      const found = searchFolder(child);
      if (found) {
        return {
          id: found.id,
          title: found.title,
          isTrial: title.includes('Trial'),
        };
      }
    }
  }

  return null;
}

/**
 * Get user preferences from storage
 */
export async function getUserPreferences(): Promise<UserPreferences> {
  const result = await chrome.storage.sync.get('userPreferences');
  return result.userPreferences || { autoNavigate: true };
}

/**
 * Set user preferences in storage
 */
export async function setUserPreferences(preferences: UserPreferences): Promise<void> {
  await chrome.storage.sync.set({ userPreferences: preferences });
}

/**
 * Navigate to bookmarks manager with optional folder focus
 */
export async function navigateToBookmarksManager(folderId?: string): Promise<void> {
  const url = folderId
    ? `chrome://bookmarks/#${folderId}`
    : 'chrome://bookmarks/';

  // Check if bookmarks tab is already open
  const tabs = await chrome.tabs.query({ url: 'chrome://bookmarks/*' });

  if (tabs.length > 0) {
    // Focus existing tab
    await chrome.tabs.update(tabs[0].id!, { active: true });
    await chrome.windows.update(tabs[0].windowId!, { focused: true });
    // Navigate to specific folder
    if (folderId) {
      await chrome.tabs.update(tabs[0].id!, { url });
    }
  } else {
    // Open new tab
    await chrome.tabs.create({ url });
  }
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
 * Run the organization pipeline with two-phase processing
 * Phase 1: Fetch bookmarks in batches and store to IndexedDB
 * Phase 2: Load from IndexedDB, categorize, and organize
 * @param options Optional configuration for trial mode
 * @returns true if operation started, false if already running
 */
export async function runOrganization(options?: OrganizationOptions): Promise<boolean> {
  if (state.isRunning) {
    return false;
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
      return true;
    }

    const totalCount = rawBookmarks.length;

    // Determine if trial mode
    const isTrialMode = options?.maxBookmarks !== undefined && options.maxBookmarks < totalCount;
    state.isTrialMode = isTrialMode;

    // Select bookmarks for processing
    let bookmarksToProcess: RawBookmark[];
    let trialInfo: TrialInfo | undefined;

    if (isTrialMode) {
      bookmarksToProcess = selectRandomBookmarks(rawBookmarks, options!.maxBookmarks!);
      trialInfo = {
        folderName: generateTrialFolderName(options!.maxBookmarks!),
        processedCount: bookmarksToProcess.length,
        totalCount,
      };
    } else {
      bookmarksToProcess = rawBookmarks;
    }

    const total = bookmarksToProcess.length;

    // Load checkpoint to see if we can resume
    const checkpoint = await loadCheckpoint();

    // Send initial trial mode info
    if (isTrialMode && trialInfo) {
      await sendProgress({
        type: "progress",
        current: 0,
        total,
        currentUrl: `Trial mode: Processing ${total} of ${totalCount} bookmarks`,
        isTrialMode: true,
        trialInfo,
      });
    }

    // ===== PHASE 1: FETCH TO STORAGE =====
    if (!checkpoint || checkpoint.phase === 'fetching') {
      const pending = checkpoint?.pendingIds
        ? bookmarksToProcess.filter(b => checkpoint.pendingIds.includes(b.id))
        : bookmarksToProcess;

      const fetchedIds = checkpoint?.fetchedIds ?? [];

      await sendProgress({
        type: "progress",
        current: fetchedIds.length,
        total,
        currentUrl: `Fetching bookmarks...`,
      });

      // Save initial checkpoint
      await saveCheckpoint({
        phase: 'fetching',
        totalBookmarks: total,
        fetchedIds,
        pendingIds: pending.map(b => b.id),
        startedAt: checkpoint?.startedAt ?? Date.now(),
        lastUpdated: Date.now(),
      });

      // Fetch in batches
      for (let i = 0; i < pending.length; i += FETCH_BATCH_SIZE) {
        if (state.shouldAbort) {
          await sendProgress({
            type: "error",
            current: 0,
            total: 0,
            error: "Operation cancelled",
          });
          return true;
        }

        const batch = pending.slice(i, i + FETCH_BATCH_SIZE);

        // Create new AbortController for this batch so cancel can abort in-flight fetches
        fetchAbortController = new AbortController();
        const abortSignal = fetchAbortController.signal;

        // Fetch batch concurrently with abort signal
        const results = await Promise.all(
          batch.map(b => fetchBookmark(b, abortSignal))
        );

        // Clear abort controller after batch completes
        fetchAbortController = null;

        // Check if cancelled during fetch - discard results if so
        if (state.shouldAbort) {
          await sendProgress({
            type: "error",
            current: 0,
            total: 0,
            error: "Operation cancelled",
          });
          return true;
        }

        // Store to IndexedDB
        await storeFetched(results);

        // Update checkpoint
        fetchedIds.push(...batch.map(b => b.id));
        await saveCheckpoint({
          phase: 'fetching',
          totalBookmarks: total,
          fetchedIds,
          pendingIds: pending.slice(i + FETCH_BATCH_SIZE).map(b => b.id),
          startedAt: checkpoint?.startedAt ?? Date.now(),
          lastUpdated: Date.now(),
        });

        // Update progress - show actual URL being processed
        const lastUrl = batch[batch.length - 1]?.url;
        state.current = fetchedIds.length;
        state.total = total;
        state.currentUrl = lastUrl ?? `Fetched ${fetchedIds.length}/${total}`;

        await sendProgress({
          type: "progress",
          current: fetchedIds.length,
          total,
          currentUrl: lastUrl ?? `Fetched ${fetchedIds.length}/${total}`,
        });
      }
    }

    // ===== PHASE 2: CATEGORIZE AND ORGANIZE =====
    // Update checkpoint to categorizing phase
    const currentCheckpoint = await loadCheckpoint();
    await saveCheckpoint({
      ...currentCheckpoint!,
      phase: 'categorizing',
      lastUpdated: Date.now(),
    });

    await sendProgress({
      type: "progress",
      current: 0,
      total: 1,
      currentUrl: "Loading fetched data...",
    });

    // Load all fetched bookmarks from storage
    const fetchedBookmarks = await loadAllFetched();

    if (state.shouldAbort) {
      await sendProgress({
        type: "error",
        current: 0,
        total: 0,
        error: "Operation cancelled",
      });
      return true;
    }

    // Deduplicate
    await sendProgress({
      type: "progress",
      current: 0,
      total: 1,
      currentUrl: "Deduplicating...",
    });
    const dedupeResult = dedupeBookmarks(fetchedBookmarks);

    // Categorize (use sparse vectors for large collections)
    await sendProgress({
      type: "progress",
      current: 0,
      total: 1,
      currentUrl: "Categorizing...",
    });
    const categorizeResult = fetchedBookmarks.length > SPARSE_THRESHOLD
      ? categorizeBookmarksSparse(dedupeResult.bookmarks)
      : categorizeBookmarks(dedupeResult.bookmarks);

    // Update checkpoint to organizing phase
    await saveCheckpoint({
      ...currentCheckpoint!,
      phase: 'organizing',
      lastUpdated: Date.now(),
    });

    // Organize
    await sendProgress({
      type: "progress",
      current: 0,
      total: 1,
      currentUrl: "Organizing folders...",
    });
    const deadlinks = fetchedBookmarks.filter(b => b.status === 'deadlink');
    const unreachable = fetchedBookmarks.filter(b => b.status === 'unreachable');

    // Determine folder name based on mode
    const folderName = isTrialMode && trialInfo
      ? trialInfo.folderName
      : '📁Organized';

    const organizeResult = await organizeBookmarks(
      categorizeResult.bookmarks,
      deadlinks,
      unreachable,
      dedupeResult.duplicatesMerged,
      folderName,
    );

    // Clear storage and checkpoint
    await clearAll();

    // Send completion with trial info
    await sendProgress({
      type: "complete",
      current: total,
      total,
      stats: organizeResult.stats,
      isTrialMode,
      trialInfo,
    });

    // Send notification if popup not focused and notifications enabled
    const popupFocused = await isPopupFocused();
    const notificationPrefs = await getNotificationPreferences();

    if (!popupFocused && notificationPrefs.enabled !== false) {
      await sendNotification({
        type: 'success',
        title: 'Bookmark Tidy - Organization Complete',
        message: 'Successfully organized your bookmarks!',
        stats: organizeResult.stats,
      });
    }

    // Auto-navigate to bookmarks manager if enabled
    const userPrefs = await getUserPreferences();
    if (userPrefs.autoNavigate !== false) {
      const targetFolderName = isTrialMode && trialInfo ? trialInfo.folderName : '📁Organized';
      const folderInfo = await findFolderByTitle(targetFolderName);
      if (folderInfo) {
        await navigateToBookmarksManager(folderInfo.id);
      }
    }
  } catch (error) {
    const errorMessage = (error as Error).message;
    await sendProgress({
      type: "error",
      current: 0,
      total: 0,
      error: errorMessage,
    });

    // Send notification if popup not focused and notifications enabled
    const popupFocused = await isPopupFocused();
    const notificationPrefs = await getNotificationPreferences();

    if (!popupFocused && notificationPrefs.enabled !== false) {
      await sendNotification({
        type: 'error',
        title: 'Bookmark Tidy - Organization Failed',
        message: 'An error occurred during organization.',
        error: errorMessage,
      });
    }
  } finally {
    state.isRunning = false;
    state.shouldAbort = false;
    state.isTrialMode = false;
  }

  return true;
}

/**
 * Cancel running operation
 * Clears progress state immediately so popup shows correct state on reopen
 * Also aborts any in-flight fetch operations
 */
export function cancelOperation(): void {
  state.shouldAbort = true;
  // Abort any in-flight fetch operations immediately
  if (fetchAbortController) {
    fetchAbortController.abort();
  }
  // Clear progress state immediately so popup shows correct state on reopen
  state.current = 0;
  state.total = 0;
  state.currentUrl = undefined;
}

/**
 * Reset all storage and organized folder
 * Clears IndexedDB data and deletes only the main 📁Organized folder
 * (preserves trial folders for user review)
 */
export async function resetStorage(): Promise<void> {
  // Cancel any running operation first
  if (state.isRunning) {
    cancelOperation();
    // Wait briefly for operation to wind down
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Clear IndexedDB storage
  await clearAll();

  // Delete only the main organized folder (not trial folders)
  // Trial folders are preserved for user review
  await clearOrganizedFolder('📁Organized');
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
  message: { type: string; maxBookmarks?: number },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean {
  if (message.type === "START_ORGANIZE") {
    const options: OrganizationOptions = {
      maxBookmarks: message.maxBookmarks,
    };
    runOrganization(options).then(started => {
      sendResponse({ success: true, started });
    });
    return true; // Keep message channel open for async response
  } else if (message.type === "CANCEL") {
    cancelOperation();
    sendResponse({ success: true });
  } else if (message.type === "GET_STATE") {
    sendResponse(getState());
  } else if (message.type === "RESET") {
    resetStorage().then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: (error as Error).message });
    });
    return true; // Keep message channel open for async response
  }
  return true; // Keep message channel open for async response
}

/**
 * Setup message listener
 */
export function setupMessageListener(): void {
  chrome.runtime.onMessage.addListener(handleMessage);
}

/**
 * Setup notification click listener
 */
export function setupNotificationListener(): void {
  chrome.notifications.onClicked.addListener(handleNotificationClick);
}

// Auto-setup when service worker loads (only in browser environment)
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  setupMessageListener();
  setupNotificationListener();
  console.log("Bookmark Tidy service worker started");
}