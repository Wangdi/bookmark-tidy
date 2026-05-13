// src/popup/index.ts

import { ProgressEvent } from '../types';

/**
 * DOM element cache - populated on first access
 */
let elements: PopupElements | null = null;

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
 * Show a specific state
 */
export function showState(state: 'idle' | 'processing' | 'complete' | 'error') {
  const els = getElements();
  els.idleState.classList.add('hidden');
  els.processingState.classList.add('hidden');
  els.completeState.classList.add('hidden');
  els.errorState.classList.add('hidden');

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
  showState('processing');
  updateProgress(0, 0, 'Starting...');

  const response = await chrome.runtime.sendMessage({ type: 'START_ORGANIZE' });

  // If operation didn't start (already running), show idle state
  if (response && response.started === false) {
    showState('idle');
    const count = await getBookmarkCount();
    getElements().bookmarkCount.textContent = `${count} bookmarks found`;
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
    return true;
  } else if (message.type === 'complete') {
    showResults(message.stats);
    showState('complete');
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
 * Setup event listeners
 */
export function setupEventListeners() {
  const els = getElements();
  els.startBtn.addEventListener('click', startOrganization);
  els.cancelBtn.addEventListener('click', cancelOrganization);
  els.doneBtn.addEventListener('click', handleDone);
  els.retryBtn.addEventListener('click', handleRetry);
  els.resetBtn.addEventListener('click', handleReset);
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
export function setupPopup() {
  setupEventListeners();
  setupMessageListener();
  init();
}

// Auto-setup when DOM is ready (only in browser environment)
if (typeof window !== 'undefined' && document.readyState === 'complete') {
  setupPopup();
} else if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', setupPopup);
}