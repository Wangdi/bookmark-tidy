// src/popup/index.ts

import { ProgressEvent, EditedCategory } from '../types';

/**
 * DOM element cache - populated on first access
 */
let elements: PopupElements | null = null;

/**
 * Current categories state for editor
 */
let currentCategories: EditedCategory[] = [];

export interface PopupElements {
  idleState: HTMLElement;
  processingState: HTMLElement;
  completeState: HTMLElement;
  errorState: HTMLElement;
  startBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
  doneBtn: HTMLButtonElement;
  retryBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;
  bookmarkCount: HTMLElement;
  progressBar: HTMLElement;
  progressText: HTMLElement;
  currentUrl: HTMLElement;
  progressCount: HTMLElement;
  resultsList: HTMLElement;
  errorMessage: HTMLElement;
  trialCount: HTMLInputElement;
  trialError: HTMLElement;
  notificationToggle: HTMLInputElement;
  autoNavigateToggle: HTMLInputElement;
  detailsToggle: HTMLButtonElement;
  detailsPanel: HTMLElement;
  fetchMetrics: HTMLElement;
  storageMetrics: HTMLElement;
  categorizationMetrics: HTMLElement;
  organizationMetrics: HTMLElement;
  performanceMetrics: HTMLElement;
  editorState: HTMLElement;
  categoryTree: HTMLElement;
  regenerateBtn: HTMLButtonElement;
  applyBtn: HTMLButtonElement;
}

/**
 * Get DOM elements (lazy initialization for testability)
 */
export function getElements(): PopupElements {
  if (!elements) {
    elements = {
      idleState: document.getElementById('idle-state')!,
      processingState: document.getElementById('processing-state')!,
      completeState: document.getElementById('complete-state')!,
      errorState: document.getElementById('error-state')!,
      startBtn: document.getElementById('start-btn')! as HTMLButtonElement,
      cancelBtn: document.getElementById('cancel-btn')! as HTMLButtonElement,
      doneBtn: document.getElementById('done-btn')! as HTMLButtonElement,
      retryBtn: document.getElementById('retry-btn')! as HTMLButtonElement,
      resetBtn: document.getElementById('reset-btn')! as HTMLButtonElement,
      bookmarkCount: document.getElementById('bookmark-count')!,
      progressBar: document.getElementById('progress-bar')!,
      progressText: document.getElementById('progress-text')!,
      currentUrl: document.getElementById('current-url')!,
      progressCount: document.getElementById('progress-count')!,
      resultsList: document.getElementById('results-list')!,
      errorMessage: document.getElementById('error-message')!,
      trialCount: document.getElementById('trial-count')! as HTMLInputElement,
      trialError: document.getElementById('trial-error')!,
      notificationToggle: document.getElementById('notification-toggle')! as HTMLInputElement,
      autoNavigateToggle: document.getElementById('auto-navigate-toggle')! as HTMLInputElement,
      detailsToggle: document.getElementById('details-toggle')! as HTMLButtonElement,
      detailsPanel: document.getElementById('details-panel')!,
      fetchMetrics: document.getElementById('fetch-metrics')!,
      storageMetrics: document.getElementById('storage-metrics')!,
      categorizationMetrics: document.getElementById('categorization-metrics')!,
      organizationMetrics: document.getElementById('organization-metrics')!,
      performanceMetrics: document.getElementById('performance-metrics')!,
      editorState: document.getElementById('editor-state')!,
      categoryTree: document.getElementById('category-tree')!,
      regenerateBtn: document.getElementById('regenerate-btn')! as HTMLButtonElement,
      applyBtn: document.getElementById('apply-btn')! as HTMLButtonElement,
    };
  }
  return elements;
}

/**
 * Set elements (for testing)
 */
export function setElements(mockElements: PopupElements | null) {
  elements = mockElements;
}

/**
 * Set categories (for testing and state management)
 */
export function setCategories(categories: EditedCategory[]) {
  currentCategories = categories;
}

/**
 * Get current categories
 */
export function getCategories(): EditedCategory[] {
  return currentCategories;
}

/**
 * Show a specific state
 */
export function showState(state: 'idle' | 'processing' | 'complete' | 'error' | 'editor') {
  const els = getElements();
  els.idleState.classList.add('hidden');
  els.processingState.classList.add('hidden');
  els.completeState.classList.add('hidden');
  els.errorState.classList.add('hidden');
  els.editorState.classList.add('hidden');

  switch (state) {
    case 'idle':
      els.idleState.classList.remove('hidden');
      break;
    case 'processing':
      els.processingState.classList.remove('hidden');
      break;
    case 'complete':
      els.completeState.classList.remove('hidden');
      break;
    case 'error':
      els.errorState.classList.remove('hidden');
      break;
    case 'editor':
      els.editorState.classList.remove('hidden');
      break;
  }
}

/**
 * Update progress bar
 */
export function updateProgress(current: number, total: number, url?: string) {
  const els = getElements();
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  els.progressBar.style.width = `${percent}%`;
  els.progressText.textContent = `${percent}%`;

  if (url) {
    els.currentUrl.textContent = `Fetching: ${url}`;
  }

  els.progressCount.textContent = `${current} of ${total} processed`;
}

/**
 * Show results
 */
export function showResults(stats: ProgressEvent['stats']) {
  if (!stats) return;

  const els = getElements();
  els.resultsList.innerHTML = `
    <li>• ${stats.processed} bookmarks processed</li>
    <li>• ${stats.duplicatesMerged} duplicates merged</li>
    <li>• ${stats.deadlinks} deadlinks found</li>
    <li>• ${stats.unreachable} unreachable</li>
    <li>• ${stats.categories} categories created</li>
  `;
}

/**
 * Show temporary status message (timer reference for cleanup)
 */
let statusMessageTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Show a temporary status message that disappears after specified duration
 */
export function showStatusMessage(message: string, durationMs: number) {
  const els = getElements();

  // Clear any existing timer
  if (statusMessageTimer) {
    clearTimeout(statusMessageTimer);
  }

  // Show message immediately
  els.bookmarkCount.textContent = message;

  // Clear message after duration
  statusMessageTimer = setTimeout(() => {
    els.bookmarkCount.textContent = '';
    statusMessageTimer = null;
  }, durationMs);
}

/**
 * Load notification preference from storage
 */
export async function loadNotificationPreference(): Promise<void> {
  const els = getElements();
  const result = await chrome.storage.sync.get('notificationOptions');
  const options = result.notificationOptions || { enabled: true };
  els.notificationToggle.checked = options.enabled !== false;
}

/**
 * Handle notification toggle change
 */
export async function handleNotificationToggle(): Promise<void> {
  const els = getElements();
  const enabled = els.notificationToggle.checked;

  await chrome.storage.sync.set({
    notificationOptions: { enabled }
  });

  // Show feedback
  showStatusMessage(
    enabled ? '✓ Notifications enabled' : '✗ Notifications disabled',
    2000
  );
}

/**
 * Load auto-navigate preference from storage
 */
export async function loadAutoNavigatePreference(): Promise<void> {
  const els = getElements();
  const result = await chrome.storage.sync.get('userPreferences');
  const prefs = result.userPreferences || { autoNavigate: true };
  els.autoNavigateToggle.checked = prefs.autoNavigate !== false;
}

/**
 * Handle auto-navigate toggle change
 */
export async function handleAutoNavigateToggle(): Promise<void> {
  const els = getElements();
  const autoNavigate = els.autoNavigateToggle.checked;

  await chrome.storage.sync.set({
    userPreferences: { autoNavigate }
  });

  // Show feedback
  showStatusMessage(
    autoNavigate ? '✓ Auto-navigate enabled' : '✗ Auto-navigate disabled',
    2000
  );
}

/**
 * Details panel expansion state
 */
let detailsExpanded = false;

/**
 * Toggle details panel visibility
 */
export function toggleDetails(): void {
  const els = getElements();
  detailsExpanded = !detailsExpanded;

  if (detailsExpanded) {
    els.detailsPanel.classList.remove('hidden');
    els.detailsToggle.textContent = 'Hide Details';
  } else {
    els.detailsPanel.classList.add('hidden');
    els.detailsToggle.textContent = 'Show Details';
  }
}

/**
 * Update detailed metrics display
 */
export function updateDetailedMetrics(metrics: import('../types').DetailedMetrics): void {
  const els = getElements();

  if (metrics.fetch) {
    els.fetchMetrics.textContent =
      `URLs: ${metrics.fetch.totalUrls} ✓${metrics.fetch.successful} ✗${metrics.fetch.failed} ⏱${metrics.fetch.timedOut}\n` +
      `Avg: ${metrics.fetch.averageTime}ms | Total: ${(metrics.fetch.totalTime / 1000).toFixed(1)}s`;
  }

  if (metrics.storage) {
    els.storageMetrics.textContent =
      `Writes: ${metrics.storage.indexedDbWrites} | Reads: ${metrics.storage.indexedDbReads}\n` +
      `Checkpoints: ${metrics.storage.checkpointSaves} | Size: ${(metrics.storage.estimatedSize / 1024).toFixed(1)}KB`;
  }

  if (metrics.categorization) {
    els.categorizationMetrics.textContent =
      `Vocab: ${metrics.categorization.vocabularySize} | Dims: ${metrics.categorization.vectorDimensions}\n` +
      `Clusters: ${metrics.categorization.clusters} | Iters: ${metrics.categorization.iterations}\n` +
      `Time: ${metrics.categorization.convergenceTime}ms`;
  }

  if (metrics.organization) {
    els.organizationMetrics.textContent =
      `Folders: ${metrics.organization.foldersCreated} | Bookmarks: ${metrics.organization.bookmarksCreated}\n` +
      `Batches: ${metrics.organization.batches} | Avg: ${metrics.organization.averageBatchTime}ms`;
  }

  if (metrics.performance) {
    els.performanceMetrics.textContent =
      `Elapsed: ${(metrics.performance.totalElapsed / 1000).toFixed(1)}s\n` +
      `Avg: ${metrics.performance.averagePerBookmark}ms/bm | Mem: ${(metrics.performance.memoryEstimate / 1024 / 1024).toFixed(1)}MB`;
  }
}

// Trial mode constants (local copies)
const TRIAL_MIN_BOOKMARKS = 10;
const TRIAL_MAX_BOOKMARKS = 500;

/**
 * Validate trial count input
 */
export function validateTrialCount(
  count: number | null,
  totalCount: number
): { valid: boolean; error?: string } {
  if (count === null) {
    return { valid: true };
  }

  if (count < TRIAL_MIN_BOOKMARKS) {
    return { valid: false, error: `Minimum ${TRIAL_MIN_BOOKMARKS} bookmarks` };
  }

  if (count > TRIAL_MAX_BOOKMARKS) {
    return { valid: false, error: `Maximum ${TRIAL_MAX_BOOKMARKS} bookmarks` };
  }

  if (count > totalCount) {
    return { valid: false, error: `Cannot exceed ${totalCount} bookmarks` };
  }

  return { valid: true };
}

/**
 * Get trial count from input
 */
export function getTrialCount(): number | null {
  const els = getElements();
  const value = els.trialCount.value.trim();

  if (!value) {
    return null;  // Empty = process all
  }

  const count = parseInt(value, 10);
  return isNaN(count) ? null : count;
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
 * Get bookmark count from Chrome API
 */
export async function getBookmarkCount(): Promise<number> {
  const tree = await chrome.bookmarks.getTree();
  return countBookmarksInTree(tree);
}

/**
 * Initialize popup
 */
export async function init() {
  // Load notification preference
  await loadNotificationPreference();
  // Load auto-navigate preference
  await loadAutoNavigatePreference();

  // Get current state
  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });

  if (state?.isRunning) {
    showState('processing');
    // Restore progress UI from current state
    if (state.total > 0) {
      updateProgress(state.current, state.total, state.currentUrl);
    } else {
      // Just started, show initial state
      updateProgress(0, 0, 'Starting...');
    }
  } else {
    showState('idle');
    const count = await getBookmarkCount();
    getElements().bookmarkCount.textContent = `${count} bookmarks found`;
  }
}

/**
 * Start organization
 */
export async function startOrganization() {
  const els = getElements();

  // Get and validate trial count
  const totalCount = await getBookmarkCount();
  const trialCount = getTrialCount();
  const validation = validateTrialCount(trialCount, totalCount);

  if (!validation.valid) {
    // Show error message
    showStatusMessage(`❌ ${validation.error}`, 3000);
    return;
  }

  showState('processing');
  updateProgress(0, 0, 'Starting...');

  const message = trialCount !== null
    ? { type: 'START_ORGANIZE', maxBookmarks: trialCount }
    : { type: 'START_ORGANIZE' };

  const response = await chrome.runtime.sendMessage(message);

  // If operation didn't start (already running), show idle state
  if (response && response.started === false) {
    showState('idle');
    const count = await getBookmarkCount();
    els.bookmarkCount.textContent = `${count} bookmarks found`;
  }
}

/**
 * Cancel organization
 */
export async function cancelOrganization() {
  await chrome.runtime.sendMessage({ type: 'CANCEL' });
  showState('idle');

  const count = await getBookmarkCount();
  getElements().bookmarkCount.textContent = `${count} bookmarks found`;
}

/**
 * Handle done button
 */
export function handleDone() {
  window.close();
}

/**
 * Handle retry button
 */
export async function handleRetry() {
  await startOrganization();
}

/**
 * Handle reset button - clear all stored data and organized folder
 */
export async function handleReset() {
  const els = getElements();
  // Disable button during operation
  els.resetBtn.textContent = 'Clearing...';
  els.resetBtn.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({ type: 'RESET' });

    if (response && response.success) {
      els.resetBtn.textContent = 'Clear All Data';
      els.resetBtn.disabled = false;
      // Show success message for 3 seconds, then update bookmark count
      showStatusMessage('✅ Data cleared successfully', 3000);
      const count = await getBookmarkCount();
      // Update count after message timer
      setTimeout(() => {
        els.bookmarkCount.textContent = `${count} bookmarks found`;
      }, 3000);
    } else {
      els.resetBtn.textContent = 'Clear All Data';
      els.resetBtn.disabled = false;
      // Show error briefly
      const originalText = els.bookmarkCount.textContent;
      els.bookmarkCount.textContent = `Reset failed: ${response?.error || 'Unknown error'}`;
      setTimeout(() => {
        els.bookmarkCount.textContent = originalText;
      }, 2000);
    }
  } catch (error) {
    els.resetBtn.textContent = 'Clear All Data';
    els.resetBtn.disabled = false;
    const originalText = els.bookmarkCount.textContent;
    els.bookmarkCount.textContent = `Reset failed: ${(error as Error).message}`;
    setTimeout(() => {
      els.bookmarkCount.textContent = originalText;
    }, 2000);
  }
}

/**
 * Handle progress message from background
 */
export function handleProgressMessage(message: ProgressEvent): boolean {
  if (message.type === 'progress') {
    updateProgress(message.current, message.total, message.currentUrl);

    // Update UI for trial mode
    if (message.isTrialMode && message.trialInfo) {
      const els = getElements();
      els.progressCount.textContent = `Trial: ${message.current} of ${message.total} (of ${message.trialInfo.totalCount} total)`;
    }

    // Update detailed metrics if provided
    if (message.detailedMetrics) {
      updateDetailedMetrics(message.detailedMetrics);
    }

    return true;
  } else if (message.type === 'complete') {
    showResults(message.stats);
    showState('complete');

    // Update completion message for trial mode
    if (message.isTrialMode && message.trialInfo) {
      const folderHint = document.querySelector('.folder-hint');
      if (folderHint) {
        folderHint.textContent = `Check ${message.trialInfo.folderName}`;
      }
    }

    // Update final detailed metrics if provided
    if (message.detailedMetrics) {
      updateDetailedMetrics(message.detailedMetrics);
    }

    return true;
  } else if (message.type === 'error') {
    // Don't show error state for user-initiated cancellation
    if (message.error === 'Operation cancelled') {
      showState('idle');
      return true;
    }
    getElements().errorMessage.textContent = message.error || 'Unknown error';
    showState('error');
    return true;
  }
  return false;
}

/**
 * Handle rename category button click
 * Placeholder for Task 11
 */
function handleRenameCategory(_categoryId: string): void {
  // To be implemented in Task 11
}

/**
 * Handle merge category button click
 * Placeholder for Task 11
 */
function handleMergeCategory(_categoryId: string): void {
  // To be implemented in Task 11
}

/**
 * Handle delete category button click
 * Placeholder for Task 11
 */
function handleDeleteCategory(_categoryId: string): void {
  // To be implemented in Task 11
}

/**
 * Render category tree in editor
 */
export function renderCategoryTree(categories: EditedCategory[]): void {
  const els = getElements();

  // Clear existing
  els.categoryTree.innerHTML = '';

  // Return early if no categories
  if (categories.length === 0) {
    return;
  }

  // Get template
  const template = document.getElementById('category-template') as HTMLTemplateElement;

  categories.forEach(category => {
    const clone = template.content.cloneNode(true) as DocumentFragment;
    const item = clone.querySelector('.category-item') as HTMLElement;

    // Set category data
    item.dataset.categoryId = category.id;
    item.querySelector('.category-name')!.textContent = category.name;
    item.querySelector('.category-count')!.textContent = String(category.bookmarkIds.length);

    // Add event listeners
    const editBtn = item.querySelector('.btn-edit') as HTMLButtonElement;
    const mergeBtn = item.querySelector('.btn-merge') as HTMLButtonElement;
    const deleteBtn = item.querySelector('.btn-delete') as HTMLButtonElement;

    editBtn.addEventListener('click', () => handleRenameCategory(category.id));
    mergeBtn.addEventListener('click', () => handleMergeCategory(category.id));
    deleteBtn.addEventListener('click', () => handleDeleteCategory(category.id));

    els.categoryTree.appendChild(clone);
  });
}

/**
 * Setup event listeners
 */
export function setupEventListeners() {
  const els = getElements();
  els.startBtn.addEventListener('click', startOrganization);
  els.cancelBtn.addEventListener('click', cancelOrganization);
  els.doneBtn.addEventListener('click', handleDone);
  els.retryBtn.addEventListener('click', handleRetry);
  els.resetBtn.addEventListener('click', handleReset);
  els.notificationToggle.addEventListener('change', handleNotificationToggle);
  els.autoNavigateToggle.addEventListener('change', handleAutoNavigateToggle);
  els.detailsToggle.addEventListener('click', toggleDetails);

  // Apply changes button
  els.applyBtn.addEventListener('click', async () => {
    try {
      els.applyBtn.disabled = true;
      els.applyBtn.textContent = 'Applying...';

      await chrome.runtime.sendMessage({
        type: 'APPLY_CATEGORY_EDIT',
        categories: currentCategories,
      });

      // Show processing state
      showState('processing');
      updateProgress(0, 0, 'Applying changes...');
    } catch (error) {
      console.error('Failed to apply changes:', error);
      els.applyBtn.disabled = false;
      els.applyBtn.textContent = '✅ Apply Changes';
    }
  });

  // Regenerate button
  els.regenerateBtn.addEventListener('click', async () => {
    if (!confirm('Regenerate categories? This will discard your edits.')) {
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        type: 'REGENERATE_CATEGORIES',
      });

      // Show processing state
      showState('processing');
      updateProgress(0, 0, 'Regenerating categories...');
    } catch (error) {
      console.error('Failed to regenerate:', error);
    }
  });
}

/**
 * Setup message listener
 */
export function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message: ProgressEvent) => {
    handleProgressMessage(message);
  });
}

/**
 * Setup popup - initialize everything
 */
export async function setupPopup() {
  setupEventListeners();
  setupMessageListener();
  await init();
}

// Auto-setup when DOM is ready (only in browser environment)
if (typeof window !== 'undefined' && document.readyState === 'complete') {
  setupPopup();
} else if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', setupPopup);
}