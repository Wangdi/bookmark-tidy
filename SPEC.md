# Bookmark Tidy - Specification

Technical specification for the Bookmark Tidy Chrome extension.

## Overview

Organizes bookmarks by:
1. Fetching and validating each URL (deadlink/unreachable detection)
2. Merging duplicate bookmarks (normalized URL matching)
3. Categorizing using sparse TF-IDF + K-means clustering
4. Creating `📁Organized/` folder for user review

## Data Pipeline

```
Phase 1: Fetch → Store
  RawBookmark[] → Fetcher (batch 10) → ProcessedBookmark[] → IndexedDB

Phase 2: Load → Categorize → Organize
  IndexedDB → ProcessedBookmark[] → Deduper → CategorizedBookmark[] → Organizer → Chrome Bookmarks
```

## Types

```typescript
interface RawBookmark {
  id: string;
  url: string;
  title: string;
}

interface ProcessedBookmark extends RawBookmark {
  meta: { description?: string; ogTitle?: string; keywords?: string[] };
  headings: string[];
  status: 'ok' | 'deadlink' | 'unreachable';
  error?: string;
}

interface CategorizedBookmark extends ProcessedBookmark {
  category: string;
  subCategory?: string;
}

interface SparseVector {
  indices: number[];  // Term indices with non-zero values
  values: number[];   // TF-IDF values
}

interface FetchCheckpoint {
  id: 'current';
  phase: 'fetching' | 'categorizing' | 'organizing' | 'complete';
  totalBookmarks: number;
  fetchedIds: string[];
  pendingIds: string[];
  startedAt: number;
  lastUpdated: number;
}
```

## Module Specifications

### 1. Storage (`src/lib/storage.ts`)

IndexedDB wrapper with two object stores:

| Store | Key | Content |
|-------|-----|---------|
| `fetched` | `id` | ProcessedBookmark objects |
| `checkpoint` | `'current'` | FetchCheckpoint state |

**Operations:**
- `storeFetched(bookmarks)` - Store fetched results
- `loadAllFetched()` - Load all for categorization
- `getFetchedCount()` - Count stored bookmarks
- `clearFetched()` / `clearCheckpoint()` / `clearAll()` - Cleanup
- `saveCheckpoint()` / `loadCheckpoint()` - Crash recovery

### 2. Fetcher (`src/modules/fetcher.ts`)

**Input:** `RawBookmark` (single), optional `AbortSignal`
**Output:** `ProcessedBookmark`

**Process:**
- Fetch URL with 30s timeout (combined with external abort signal if provided)
- Extract: `<title>`, `<meta description>`, `<meta og:title>`, `<meta keywords>`, `<h1>-<h6>`
- Classify status:
  - `ok` - Successful fetch, valid content
  - `deadlink` - 404, 410, DNS failure
  - `unreachable` - Timeout, 5xx, network error, or aborted

**Abort Handling:**
- Accepts optional `AbortSignal` parameter for immediate cancellation
- Combines external signal with internal timeout signal
- If aborted, returns `unreachable` status with "aborted" error

### 3. Deduper (`src/modules/deduper.ts`)

**Input:** `ProcessedBookmark[]`
**Output:** `{ bookmarks: ProcessedBookmark[], duplicatesMerged: number }`

**URL Normalization:**
1. Lowercase
2. Remove protocol (http/https)
3. Remove `www.`
4. Remove trailing slash
5. Sort query params alphabetically
6. Remove tracking params: `utm_*`, `ref`, `source`, `fbclid`, `gclid`

**Title Selection (when duplicates found):**
1. If one title is URL-like, keep the other (real title)
2. If both are URL-like or both aren't, keep the longer title

### 4. Categorizer (`src/modules/categorizer.ts`)

**Input:** `ProcessedBookmark[]`
**Output:** `{ bookmarks: CategorizedBookmark[], categoryNames: string[] }`

**Process:**
1. Build corpus: title (2x weight) + description + ogTitle + keywords (2x weight) + headings
2. Tokenize: lowercase, remove punctuation, filter stop words and short words
3. Build sparse TF-IDF vectors (only non-zero values, threshold > 0.001)
4. Determine cluster count: `k = min(30, max(3, sqrt(n/2)))`
5. K-means clustering with sparse cosine distance (max 100 iterations)
6. Generate category names: 1 word if unique, 2 words if not, capitalize, truncate at 50 chars
7. Sub-categories: If cluster >10 bookmarks, re-cluster with `k = max(2, n/8)`

**Sparse vs Dense vectors:**

| Metric | Dense | Sparse |
|--------|-------|--------|
| Memory (2000 bookmarks) | ~65 MB | ~6 MB |
| Non-zero ratio | 100% | ~5% |
| Distance calculation | All dimensions | Non-zero only |

### 5. Organizer (`src/modules/organizer.ts`)

**Input:** `CategorizedBookmark[]`, deadlinks, unreachable
**Output:** Chrome bookmark tree

**Process:**
1. Delete existing `📁Organized/` folder
2. Create `📁Organized/` in "Other Bookmarks" (fallback: "Bookmarks Bar")
3. For each category:
   - If has sub-categories: category folder → sub-category folders → bookmarks
   - Else: category folder → bookmarks
4. Deadlinks → `⚠ Deadlinks/` (title includes error)
5. Unreachable → `⚠ Unreachable/` (title includes error)
6. Bookmark creation in parallel batches of 10

## Background Orchestration (`src/background/index.ts`)

```
FETCH_BATCH_SIZE = 10
SPARSE_THRESHOLD = 500  (use sparse vectors when bookmarks > 500)
```

**Phase 1 - Fetch:**
- Load checkpoint (resume support)
- Fetch in batches of 10 concurrent
- Store each batch to IndexedDB
- Save checkpoint after each batch
- Check shouldAbort between batches

**Phase 2 - Categorize:**
- Load all from IndexedDB
- Dedupe → Categorize (sparse if >500, dense otherwise) → Organize
- Clear IndexedDB and checkpoint on completion

## Error Handling

| Scenario | Handling |
|----------|----------|
| No bookmarks | Show "No bookmarks found" error |
| User cancels | Immediate abort via AbortController, discard in-flight results, clear progress state, send "Operation cancelled" |
| Crash/restart | Resume from IndexedDB checkpoint |
| Chrome terminates SW | Checkpoint persists; resume on next run |

### Cancellation Behavior

When user clicks cancel:

1. **Immediate abort**: `cancelOperation()` aborts any in-flight fetch operations via `AbortController`
2. **Progress state cleared**: `current`, `total`, `currentUrl` are set to 0/0/undefined immediately
3. **Partial results discarded**: If cancelled during a batch, that batch's results are NOT saved to IndexedDB
4. **Consistent popup state**: On popup close/reopen, state shows cleared progress (0/0) even if background is still winding down
5. **Popup shows idle state**: When background sends "Operation cancelled" error, popup shows idle state instead of error state (user intentionally cancelled)

### Start/Cancel Race Condition

When user quickly presses start/cancel/start:

1. **START_ORGANIZE returns `started`**: Background returns `{ success: true, started: true/false }` indicating if operation started
2. **Popup handles `started: false`**: If operation didn't start (already running), popup reverts to idle state
3. **No stale state**: This prevents popup showing "0/0" when cancellation is still winding down

```typescript
// cancelOperation() implementation
export function cancelOperation(): void {
  state.shouldAbort = true;
  if (fetchAbortController) {
    fetchAbortController.abort();  // Abort in-flight fetches
  }
  state.current = 0;
  state.total = 0;
  state.currentUrl = undefined;
}

// Popup handles "Operation cancelled" specially
if (message.type === 'error' && message.error === 'Operation cancelled') {
  showState('idle');  // Not an error - user cancelled intentionally
  return true;
}

// startOrganization handles started: false
const response = await chrome.runtime.sendMessage({ type: 'START_ORGANIZE' });
if (response && response.started === false) {
  showState('idle');  // Didn't start - already running
}
```

## Chrome Permissions

- `bookmarks` - Read/write bookmarks
- `host_permissions: ["<all_urls>"]` - Fetch any URL (bypass CORS)

## Known Constraints

- Service worker cannot use DOM APIs directly (use DOMParser on fetched HTML)
- Chrome bookmarks API is async - always await
- Fetch timeout: 30 seconds
- IndexedDB quota: no practical limit

## Constants

| Constant | Value | Location |
|----------|-------|----------|
| `MIN_CATEGORIES` | 3 | categorizer.ts |
| `MAX_CATEGORIES` | 30 | categorizer.ts |
| `SUB_CATEGORY_THRESHOLD` | 10 | categorizer.ts |
| `MAX_CATEGORY_NAME_LENGTH` | 50 | categorizer.ts |
| `FETCH_BATCH_SIZE` | 10 | background/index.ts |
| `SPARSE_THRESHOLD` | 500 | background/index.ts |
| `CREATE_BATCH_SIZE` | 10 | organizer.ts |
