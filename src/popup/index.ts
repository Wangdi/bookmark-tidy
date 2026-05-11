// src/popup/index.ts

import { ProgressEvent } from '../types';

// DOM Elements
const idleState = document.getElementById('idle-state')!;
const processingState = document.getElementById('processing-state')!;
const completeState = document.getElementById('complete-state')!;
const errorState = document.getElementById('error-state')!;

const startBtn = document.getElementById('start-btn')!;
const cancelBtn = document.getElementById('cancel-btn')!;
const doneBtn = document.getElementById('done-btn')!;
const retryBtn = document.getElementById('retry-btn')!;

const bookmarkCount = document.getElementById('bookmark-count')!;
const progressBar = document.getElementById('progress-bar')!;
const progressText = document.getElementById('progress-text')!;
const currentUrl = document.getElementById('current-url')!;
const progressCount = document.getElementById('progress-count')!;
const resultsList = document.getElementById('results-list')!;
const errorMessage = document.getElementById('error-message')!;

/**
 * Show a specific state
 */
function showState(state: 'idle' | 'processing' | 'complete' | 'error') {
  idleState.classList.add('hidden');
  processingState.classList.add('hidden');
  completeState.classList.add('hidden');
  errorState.classList.add('hidden');

  switch (state) {
    case 'idle':
      idleState.classList.remove('hidden');
      break;
    case 'processing':
      processingState.classList.remove('hidden');
      break;
    case 'complete':
      completeState.classList.remove('hidden');
      break;
    case 'error':
      errorState.classList.remove('hidden');
      break;
  }
}

/**
 * Update progress bar
 */
function updateProgress(current: number, total: number, url?: string) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  progressBar.style.width = `${percent}%`;
  progressText.textContent = `${percent}%`;

  if (url) {
    currentUrl.textContent = `Fetching: ${url}`;
  }

  progressCount.textContent = `${current} of ${total} processed`;
}

/**
 * Show results
 */
function showResults(stats: ProgressEvent['stats']) {
  if (!stats) return;

  resultsList.innerHTML = `
    <li>• ${stats.processed} bookmarks processed</li>
    <li>• ${stats.duplicatesMerged} duplicates merged</li>
    <li>• ${stats.deadlinks} deadlinks found</li>
    <li>• ${stats.unreachable} unreachable</li>
    <li>• ${stats.categories} categories created</li>
  `;
}

/**
 * Get bookmark count from background
 */
async function getBookmarkCount(): Promise<number> {
  const tree = await chrome.bookmarks.getTree();
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
 * Initialize popup
 */
async function init() {
  // Get current state
  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });

  if (state?.isRunning) {
    showState('processing');
  } else {
    showState('idle');
    const count = await getBookmarkCount();
    bookmarkCount.textContent = `${count} bookmarks found`;
  }
}

/**
 * Start organization
 */
async function startOrganization() {
  showState('processing');
  updateProgress(0, 0, 'Starting...');

  await chrome.runtime.sendMessage({ type: 'START_ORGANIZE' });
}

/**
 * Cancel organization
 */
async function cancelOrganization() {
  await chrome.runtime.sendMessage({ type: 'CANCEL' });
  showState('idle');

  const count = await getBookmarkCount();
  bookmarkCount.textContent = `${count} bookmarks found`;
}

/**
 * Handle done button
 */
function handleDone() {
  window.close();
}

/**
 * Handle retry button
 */
async function handleRetry() {
  await startOrganization();
}

// Listen for progress updates
chrome.runtime.onMessage.addListener((message: ProgressEvent) => {
  if (message.type === 'progress') {
    updateProgress(message.current, message.total, message.currentUrl);
  } else if (message.type === 'complete') {
    showResults(message.stats);
    showState('complete');
  } else if (message.type === 'error') {
    errorMessage.textContent = message.error || 'Unknown error';
    showState('error');
  }
});

// Event listeners
startBtn.addEventListener('click', startOrganization);
cancelBtn.addEventListener('click', cancelOrganization);
doneBtn.addEventListener('click', handleDone);
retryBtn.addEventListener('click', handleRetry);

// Initialize
init();
