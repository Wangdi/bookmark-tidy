# Trial Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add trial mode to process a random subset of N bookmarks before committing to full organization.

**Architecture:** Fisher-Yates shuffle for random selection, separate `🧪Trial/` folder for trial results, input validation in popup, message passing between popup and background with `maxBookmarks` option.

**Tech Stack:** TypeScript, Vitest, Chrome Extensions API, Fisher-Yates shuffle algorithm

---

## File Structure

**New files:**
- None (all changes to existing files)

**Modified files:**
- `src/types/index.ts` - Add `OrganizationOptions` and `isTrialMode` to types
- `src/background/index.ts` - Add shuffle logic, trial mode handling, folder selection
- `src/background/index.test.ts` - Unit tests for shuffle and selection
- `src/background/index.integration.test.ts` - Integration tests for trial workflow
- `src/modules/organizer.ts` - Support custom folder name
- `src/modules/organizer.test.ts` - Tests for folder naming
- `src/modules/organizer.integration.test.ts` - Integration tests for folder creation
- `src/popup/popup.html` - Add trial input UI
- `src/popup/styles.css` - Style trial input
- `src/popup/index.ts` - Add validation and trial mode handling
- `src/popup/index.test.ts` - Unit tests for validation
- `src/popup/index.integration.test.ts` - Integration tests for popup workflow

---

## Phase 1: Backend - Core Logic (Day 1)

### Task 1: Add OrganizationOptions Type

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Write the failing test**

Create test in `src/background/index.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('OrganizationOptions type', () => {
  it('accepts undefined maxBookmarks for full mode', () => {
    const options: import('../types').OrganizationOptions = {};
    expect(options.maxBookmarks).toBeUndefined();
  });

  it('accepts number for trial mode', () => {
    const options: import('../types').OrganizationOptions = { maxBookmarks: 25 };
    expect(options.maxBookmarks).toBe(25);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.test.ts`
Expected: FAIL with "Cannot find namespace 'OrganizationOptions'"

- [ ] **Step 3: Write minimal implementation**

Add to `src/types/index.ts`:

```typescript
export interface OrganizationOptions {
  maxBookmarks?: number;  // undefined = all, number = trial mode
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/background/index.test.ts
git commit -m "feat: add OrganizationOptions type for trial mode"
```

---

### Task 2: Add isTrialMode to ProgressEvent

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.test.ts`:

```typescript
describe('ProgressEvent isTrialMode', () => {
  it('includes isTrialMode flag in progress event', () => {
    const event: import('../types').ProgressEvent = {
      type: 'progress',
      current: 5,
      total: 25,
      isTrialMode: true,
    };
    expect(event.isTrialMode).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.test.ts`
Expected: FAIL with "Property 'isTrialMode' does not exist"

- [ ] **Step 3: Write minimal implementation**

Modify `src/types/index.ts`:

```typescript
export interface ProgressEvent {
  type: 'progress' | 'complete' | 'error';
  current: number;
  total: number;
  currentUrl?: string;
  stats?: {
    processed: number;
    duplicatesMerged: number;
    deadlinks: number;
    unreachable: number;
    categories: number;
  };
  error?: string;
  isTrialMode?: boolean;  // NEW: flag for trial mode
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/background/index.test.ts
git commit -m "feat: add isTrialMode flag to ProgressEvent"
```

---

### Task 3: Implement shuffleArray Function

**Files:**
- Modify: `src/background/index.ts`
- Modify: `src/background/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.test.ts`:

```typescript
import { resetState } from '../background/index';

describe('shuffleArray', () => {
  it('returns array of same length', () => {
    const { shuffleArray } = await import('../background/index');
    const arr = [1, 2, 3, 4, 5];
    expect(shuffleArray(arr)).toHaveLength(5);
  });

  it('contains all original elements', () => {
    const { shuffleArray } = await import('../background/index');
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray(arr);
    expect(shuffled.sort()).toEqual(arr.sort());
  });

  it('does not modify original array', () => {
    const { shuffleArray } = await import('../background/index');
    const arr = [1, 2, 3, 4, 5];
    const original = [...arr];
    shuffleArray(arr);
    expect(arr).toEqual(original);
  });

  it('produces different orders on multiple calls', () => {
    const { shuffleArray } = await import('../background/index');
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const results = new Set();
    
    for (let i = 0; i < 100; i++) {
      results.add(shuffleArray(arr).join(','));
    }
    
    expect(results.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.test.ts`
Expected: FAIL with "shuffleArray is not defined"

- [ ] **Step 3: Write minimal implementation**

Add to `src/background/index.ts` (after imports, before state):

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/background/index.ts src/background/index.test.ts
git commit -m "feat: implement Fisher-Yates shuffle for random selection"
```

---

### Task 4: Implement selectRandomBookmarks Function

**Files:**
- Modify: `src/background/index.ts`
- Modify: `src/background/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.test.ts`:

```typescript
describe('selectRandomBookmarks', () => {
  const createBookmark = (id: string) => ({
    id,
    url: `https://example.com/${id}`,
    title: `Bookmark ${id}`,
  });

  it('returns all bookmarks when count >= total', () => {
    const { selectRandomBookmarks } = await import('../background/index');
    const bookmarks = [createBookmark('1'), createBookmark('2'), createBookmark('3')];
    expect(selectRandomBookmarks(bookmarks, 5)).toHaveLength(3);
  });

  it('returns exactly N bookmarks', () => {
    const { selectRandomBookmarks } = await import('../background/index');
    const bookmarks = [
      createBookmark('1'), createBookmark('2'), createBookmark('3'),
      createBookmark('4'), createBookmark('5')
    ];
    expect(selectRandomBookmarks(bookmarks, 3)).toHaveLength(3);
  });

  it('returns subset of original bookmarks', () => {
    const { selectRandomBookmarks } = await import('../background/index');
    const bookmarks = [
      createBookmark('1'), createBookmark('2'), createBookmark('3'),
      createBookmark('4'), createBookmark('5')
    ];
    const selected = selectRandomBookmarks(bookmarks, 3);
    selected.forEach(b => {
      expect(bookmarks.find(bm => bm.id === b.id)).toBeDefined();
    });
  });

  it('returns empty array when count is 0', () => {
    const { selectRandomBookmarks } = await import('../background/index');
    const bookmarks = [createBookmark('1'), createBookmark('2')];
    expect(selectRandomBookmarks(bookmarks, 0)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.test.ts`
Expected: FAIL with "selectRandomBookmarks is not defined"

- [ ] **Step 3: Write minimal implementation**

Add to `src/background/index.ts` (after shuffleArray):

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/background/index.ts src/background/index.test.ts
git commit -m "feat: implement selectRandomBookmarks for trial mode"
```

---

### Task 5: Modify organizeBookmarks for Custom Folder Name

**Files:**
- Modify: `src/modules/organizer.ts`
- Modify: `src/modules/organizer.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/modules/organizer.test.ts`:

```typescript
describe('organizeBookmarks folder name', () => {
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
    await organizeBookmarks([], [], [], 'Trial');

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: '🧪Trial' })
    );

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/modules/organizer.test.ts`
Expected: FAIL with "Received undefined" or wrong folder name

- [ ] **Step 3: Write minimal implementation**

Modify `src/modules/organizer.ts`:

Find the `organizeBookmarks` function signature and change:

```typescript
export async function organizeBookmarks(
  bookmarks: CategorizedBookmark[],
  deadlinks: ProcessedBookmark[],
  unreachable: ProcessedBookmark[],
  folderName: string = 'Organized'  // NEW: configurable folder name
): Promise<void> {
```

Then find where the folder is created and change:

```typescript
  // Create organized folder
  const emoji = folderName === 'Trial' ? '🧪' : '📁';
  const folder = await chrome.bookmarks.create({
    parentId: parent.id,
    title: `${emoji}${folderName}`,
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/modules/organizer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/organizer.ts src/modules/organizer.test.ts
git commit -m "feat: support custom folder name in organizeBookmarks"
```

---

### Task 6: Modify clearOrganizedFolder for Custom Folder Name

**Files:**
- Modify: `src/modules/organizer.ts`
- Modify: `src/modules/organizer.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/modules/organizer.test.ts`:

```typescript
describe('clearOrganizedFolder folder name', () => {
  it('accepts custom folder name parameter', async () => {
    const mockRemoveTree = vi.fn();
    vi.stubGlobal('chrome', {
      bookmarks: {
        getTree: vi.fn().mockResolvedValue([{
          id: '0',
          title: 'Root',
          children: [{
            id: '1',
            title: 'Other Bookmarks',
            children: [{
              id: '2',
              title: '🧪Trial',
            }],
          }],
        }]),
        removeTree: mockRemoveTree,
      },
      runtime: { lastError: null },
    });

    const { clearOrganizedFolder } = await import('../modules/organizer');
    await clearOrganizedFolder('Trial');

    expect(mockRemoveTree).toHaveBeenCalledWith('2');

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/modules/organizer.test.ts`
Expected: FAIL with folder not found or wrong folder deleted

- [ ] **Step 3: Write minimal implementation**

Modify `src/modules/organizer.ts`:

Find the `clearOrganizedFolder` function signature and change:

```typescript
export async function clearOrganizedFolder(
  folderName: string = 'Organized'
): Promise<void> {
```

Then find the folder search logic and update:

```typescript
  const emoji = folderName === 'Trial' ? '🧪' : '📁';
  const targetTitle = `${emoji}${folderName}`;
  
  // Find and remove folder with matching title
  // ... existing logic but check for targetTitle instead of hardcoded
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/modules/organizer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/organizer.ts src/modules/organizer.test.ts
git commit -m "feat: support custom folder name in clearOrganizedFolder"
```

---

### Task 7: Update resetStorage to Clear Both Folders

**Files:**
- Modify: `src/background/index.ts`
- Modify: `src/background/index.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.integration.test.ts`:

```typescript
describe('resetStorage clears both folders', () => {
  it('clears both Organized and Trial folders', async () => {
    const mockRemoveTree = vi.fn();
    vi.stubGlobal('chrome', {
      bookmarks: {
        getTree: vi.fn().mockResolvedValue([{
          id: '0',
          title: 'Root',
          children: [{
            id: '1',
            title: 'Other Bookmarks',
            children: [
              { id: '2', title: '📁Organized' },
              { id: '3', title: '🧪Trial' },
            ],
          }],
        }]),
        removeTree: mockRemoveTree,
      },
      runtime: { lastError: null },
    });

    vi.mock('../lib/storage', () => ({
      clearAll: vi.fn(),
    }));

    vi.mock('../modules/organizer', () => ({
      clearOrganizedFolder: mockRemoveTree,
    }));

    const { resetStorage } = await import('../background/index');
    await resetStorage();

    expect(mockRemoveTree).toHaveBeenCalledWith('Organized');
    expect(mockRemoveTree).toHaveBeenCalledWith('Trial');

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.integration.test.ts`
Expected: FAIL with "Expected 'Trial' to have been called"

- [ ] **Step 3: Write minimal implementation**

Modify `src/background/index.ts`:

Find the `resetStorage` function and update:

```typescript
export async function resetStorage(): Promise<void> {
  // Cancel any running operation first
  if (state.isRunning) {
    cancelOperation();
    // Wait briefly for operation to wind down
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Clear IndexedDB storage
  await clearAll();

  // Delete both organized folders
  await clearOrganizedFolder('Organized');
  await clearOrganizedFolder('Trial');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/background/index.ts src/background/index.integration.test.ts
git commit -m "feat: clear both Organized and Trial folders on reset"
```

---

## Phase 2: Backend - Integration (Day 1 continued)

### Task 8: Modify runOrganization for Trial Mode

**Files:**
- Modify: `src/background/index.ts`
- Modify: `src/background/index.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.integration.test.ts`:

```typescript
describe('runOrganization trial mode', () => {
  it('processes only N bookmarks in trial mode', async () => {
    const mockGetTree = vi.fn().mockResolvedValue([{
      id: '0',
      title: 'Root',
      children: Array(100).fill(null).map((_, i) => ({
        id: `${i + 1}`,
        title: `Bookmark ${i}`,
        url: `https://example${i}.com`,
      })),
    }]);

    vi.stubGlobal('chrome', {
      bookmarks: { getTree: mockGetTree, create: vi.fn(), removeTree: vi.fn() },
      runtime: { sendMessage: vi.fn(), lastError: null },
    });

    vi.mock('../modules/fetcher', () => ({
      fetchBookmark: vi.fn(async (b) => ({ ...b, status: 'ok', meta: {}, headings: [] })),
    }));

    const { runOrganization, resetState } = await import('../background/index');
    resetState();
    
    await runOrganization({ maxBookmarks: 25 });

    // Should process only 25
    expect(state.total).toBe(25);

    vi.unstubAllGlobals();
  });

  it('sets isTrialMode flag in state', async () => {
    const { runOrganization, resetState, state } = await import('../background/index');
    resetState();
    
    await runOrganization({ maxBookmarks: 10 });

    expect(state.isTrialMode).toBe(true);

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.integration.test.ts`
Expected: FAIL with "Expected 25, received 100" or "isTrialMode is undefined"

- [ ] **Step 3: Write minimal implementation**

Modify `src/background/index.ts`:

1. Add `isTrialMode` to state:

```typescript
export const state: OrganizerState = {
  isRunning: false,
  shouldAbort: false,
  current: 0,
  total: 0,
  currentUrl: undefined,
  isTrialMode: false,  // NEW
};
```

2. Update `OrganizationState` interface in `src/types/index.ts`:

```typescript
export interface OrganizerState {
  isRunning: boolean;
  shouldAbort: boolean;
  current: number;
  total: number;
  currentUrl?: string;
  isTrialMode?: boolean;  // NEW
}
```

3. Modify `runOrganization` function:

```typescript
export async function runOrganization(
  options?: OrganizationOptions
): Promise<boolean> {
  // ... existing early returns ...

  state.isRunning = true;
  state.shouldAbort = false;

  try {
    const tree = await chrome.bookmarks.getTree();
    let bookmarks = extractBookmarksFromTree(tree);
    const totalCount = bookmarks.length;

    // Apply trial mode filter
    const isTrialMode = options?.maxBookmarks !== undefined;
    state.isTrialMode = isTrialMode;
    
    if (isTrialMode && options!.maxBookmarks! < bookmarks.length) {
      bookmarks = selectRandomBookmarks(bookmarks, options!.maxBookmarks!);
    }

    state.total = bookmarks.length;

    // Send initial progress with trial mode info
    if (isTrialMode) {
      sendProgress({
        type: 'progress',
        current: 0,
        total: bookmarks.length,
        currentUrl: `Trial mode: Processing ${bookmarks.length} of ${totalCount} bookmarks`,
        isTrialMode: true,
      });
    } else {
      sendProgress({
        type: 'progress',
        current: 0,
        total: bookmarks.length,
        currentUrl: 'Starting...',
      });
    }

    // ... rest of processing ...

    // Pass folder name to organizer
    const folderName = isTrialMode ? 'Trial' : 'Organized';
    await organizeBookmarks(categorized, deadlinks, unreachable, folderName);

    // ... completion handling ...
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/background/index.ts src/background/index.integration.test.ts
git commit -m "feat: implement trial mode in runOrganization"
```

---

### Task 9: Update Message Handler for Trial Mode

**Files:**
- Modify: `src/background/index.ts`
- Modify: `src/background/index.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.integration.test.ts`:

```typescript
describe('handleMessage trial mode', () => {
  it('passes maxBookmarks to runOrganization', async () => {
    const mockRunOrganization = vi.fn().mockResolvedValue(true);
    
    vi.mock('../background/index', async (orig) => ({
      ...await orig(),
      runOrganization: mockRunOrganization,
    }));

    const { handleMessage } = await import('../background/index');
    
    const sendResponse = vi.fn();
    handleMessage({ type: 'START_ORGANIZE', maxBookmarks: 25 }, {}, sendResponse);

    // Wait for async response
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockRunOrganization).toHaveBeenCalledWith({ maxBookmarks: 25 });

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.integration.test.ts`
Expected: FAIL with "maxBookmarks not passed"

- [ ] **Step 3: Write minimal implementation**

Modify `src/background/index.ts`:

Find the `handleMessage` function and update the `START_ORGANIZE` case:

```typescript
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
    return true;
  }
  // ... rest of handlers ...
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/background/index.ts src/background/index.integration.test.ts
git commit -m "feat: pass maxBookmarks option through message handler"
```

---

## Phase 3: Frontend - UI (Day 2)

### Task 10: Add Trial Input to Popup HTML

**Files:**
- Modify: `src/popup/popup.html`

- [ ] **Step 1: Add trial input UI**

Modify `src/popup/popup.html`:

Find the idle-state div and add after the status-text paragraph:

```html
    <!-- Trial mode input group -->
    <div class="trial-input-group">
      <label for="trial-count">Trial mode (optional):</label>
      <div class="trial-input-wrapper">
        <input 
          type="number" 
          id="trial-count" 
          min="1" 
          step="1"
          placeholder="e.g., 25" 
          class="trial-input"
        />
        <span class="trial-hint">bookmarks</span>
      </div>
      <p class="trial-help">Leave empty to process all bookmarks</p>
    </div>
```

- [ ] **Step 2: Commit**

```bash
git add src/popup/popup.html
git commit -m "feat: add trial mode input to popup UI"
```

---

### Task 11: Style Trial Input

**Files:**
- Modify: `src/popup/styles.css`

- [ ] **Step 1: Add trial input styles**

Add to `src/popup/styles.css`:

```css
.trial-input-group {
  margin: 16px 0;
  padding: 12px;
  background: var(--bg-secondary, #f5f5f5);
  border-radius: 8px;
}

.trial-input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.trial-input {
  width: 80px;
  padding: 8px 12px;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
}

.trial-input:focus {
  outline: none;
  border-color: var(--primary-color, #4285f4);
  box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.2);
}

.trial-hint {
  color: var(--text-secondary, #666);
  font-size: 13px;
}

.trial-help {
  margin-top: 8px;
  margin-bottom: 0;
  font-size: 12px;
  color: var(--text-secondary, #666);
  font-style: italic;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/popup/styles.css
git commit -m "feat: add styles for trial mode input"
```

---

### Task 12: Add Trial Input to PopupElements

**Files:**
- Modify: `src/popup/index.ts`
- Modify: `src/popup/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/popup/index.test.ts`:

```typescript
describe('trial input elements', () => {
  it('includes trialCount element in PopupElements', () => {
    const { PopupElements } = await import('../popup/index');
    const elements: PopupElements = {
      // ... existing elements ...
      trialCount: createMockElement() as HTMLInputElement,
    };
    expect(elements.trialCount).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/popup/index.test.ts`
Expected: FAIL with "Property 'trialCount' does not exist"

- [ ] **Step 3: Write minimal implementation**

Modify `src/popup/index.ts`:

1. Update `PopupElements` interface:

```typescript
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
  trialCount: HTMLInputElement;  // NEW
}
```

2. Update `getElements` function:

```typescript
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
      trialCount: document.getElementById('trial-count')! as HTMLInputElement,  // NEW
    };
  }
  return elements;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/popup/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/popup/index.ts src/popup/index.test.ts
git commit -m "feat: add trialCount to PopupElements"
```

---

### Task 13: Implement validateTrialCount Function

**Files:**
- Modify: `src/popup/index.ts`
- Modify: `src/popup/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/popup/index.test.ts`:

```typescript
describe('validateTrialCount', () => {
  it('accepts null (process all)', async () => {
    const { validateTrialCount } = await import('../popup/index');
    expect(validateTrialCount(null, 100)).toEqual({ valid: true });
  });

  it('accepts valid count', async () => {
    const { validateTrialCount } = await import('../popup/index');
    expect(validateTrialCount(50, 100)).toEqual({ valid: true });
  });

  it('rejects count < 1', async () => {
    const { validateTrialCount } = await import('../popup/index');
    expect(validateTrialCount(0, 100)).toEqual({
      valid: false,
      error: 'Minimum 1 bookmark'
    });
  });

  it('rejects negative count', async () => {
    const { validateTrialCount } = await import('../popup/index');
    expect(validateTrialCount(-5, 100)).toEqual({
      valid: false,
      error: 'Minimum 1 bookmark'
    });
  });

  it('rejects count > total', async () => {
    const { validateTrialCount } = await import('../popup/index');
    expect(validateTrialCount(150, 100)).toEqual({
      valid: false,
      error: 'Cannot exceed 100 bookmarks'
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/popup/index.test.ts`
Expected: FAIL with "validateTrialCount is not defined"

- [ ] **Step 3: Write minimal implementation**

Add to `src/popup/index.ts` (after showStatusMessage):

```typescript
/**
 * Validate trial count input
 */
export function validateTrialCount(
  count: number | null,
  totalCount: number
): { valid: boolean; error?: string } {
  if (count === null) {
    return { valid: true };  // Empty = process all
  }

  if (count < 1) {
    return { valid: false, error: 'Minimum 1 bookmark' };
  }

  if (count > totalCount) {
    return { valid: false, error: `Cannot exceed ${totalCount} bookmarks` };
  }

  return { valid: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/popup/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/popup/index.ts src/popup/index.test.ts
git commit -m "feat: implement validateTrialCount function"
```

---

### Task 14: Implement getTrialCount Function

**Files:**
- Modify: `src/popup/index.ts`
- Modify: `src/popup/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/popup/index.test.ts`:

```typescript
describe('getTrialCount', () => {
  it('returns null for empty input', async () => {
    const { getTrialCount, setElements } = await import('../popup/index');
    setElements(mockElements);
    
    mockElements.trialCount.value = '';
    
    expect(getTrialCount()).toBeNull();
  });

  it('returns number for valid input', async () => {
    const { getTrialCount, setElements } = await import('../popup/index');
    setElements(mockElements);
    
    mockElements.trialCount.value = '25';
    
    expect(getTrialCount()).toBe(25);
  });

  it('returns null for non-numeric input', async () => {
    const { getTrialCount, setElements } = await import('../popup/index');
    setElements(mockElements);
    
    mockElements.trialCount.value = 'abc';
    
    expect(getTrialCount()).toBeNull();
  });

  it('parses integer from decimal', async () => {
    const { getTrialCount, setElements } = await import('../popup/index');
    setElements(mockElements);
    
    mockElements.trialCount.value = '25.7';
    
    expect(getTrialCount()).toBe(25);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/popup/index.test.ts`
Expected: FAIL with "getTrialCount is not defined"

- [ ] **Step 3: Write minimal implementation**

Add to `src/popup/index.ts` (after validateTrialCount):

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/popup/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/popup/index.ts src/popup/index.test.ts
git commit -m "feat: implement getTrialCount function"
```

---

### Task 15: Modify startOrganization for Trial Mode

**Files:**
- Modify: `src/popup/index.ts`
- Modify: `src/popup/index.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/popup/index.integration.test.ts`:

```typescript
describe('startOrganization trial mode', () => {
  it('shows error for invalid trial count', async () => {
    const mockSendMessage = vi.fn();
    
    vi.stubGlobal('chrome', {
      runtime: { sendMessage: mockSendMessage, onMessage: { addListener: vi.fn() } },
      bookmarks: { getTree: vi.fn().mockResolvedValue([{ id: '0', title: 'Root', children: [] }]) },
    });

    const { startOrganization, setElements } = await import('../popup/index');
    setElements(mockElements);
    
    mockElements.trialCount.value = '0';
    await startOrganization();

    expect(mockElements.bookmarkCount.textContent).toContain('Minimum 1 bookmark');
    expect(mockSendMessage).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('sends maxBookmarks when trial count is set', async () => {
    const mockSendMessage = vi.fn().mockResolvedValue({ started: true });
    const mockGetTree = vi.fn().mockResolvedValue([{
      id: '0',
      title: 'Root',
      children: Array(100).fill(null).map((_, i) => ({
        id: `${i}`,
        title: `Bookmark ${i}`,
        url: `https://example${i}.com`,
      })),
    }]);

    vi.stubGlobal('chrome', {
      runtime: { sendMessage: mockSendMessage, onMessage: { addListener: vi.fn() } },
      bookmarks: { getTree: mockGetTree },
    });

    const { startOrganization, setElements } = await import('../popup/index');
    setElements(mockElements);
    
    mockElements.trialCount.value = '25';
    await startOrganization();

    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'START_ORGANIZE', maxBookmarks: 25 })
    );

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/popup/index.integration.test.ts`
Expected: FAIL with "maxBookmarks not sent" or "Expected 'Minimum 1 bookmark'"

- [ ] **Step 3: Write minimal implementation**

Modify `src/popup/index.ts`:

Find the `startOrganization` function and update:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/popup/index.integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/popup/index.ts src/popup/index.integration.test.ts
git commit -m "feat: add trial mode validation and message passing to startOrganization"
```

---

### Task 16: Update handleProgressMessage for Trial Mode

**Files:**
- Modify: `src/popup/index.ts`
- Modify: `src/popup/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/popup/index.test.ts`:

```typescript
describe('handleProgressMessage trial mode', () => {
  it('shows trial mode progress text', async () => {
    const { handleProgressMessage, setElements } = await import('../popup/index');
    setElements(mockElements);

    const message: ProgressEvent = {
      type: 'progress',
      current: 5,
      total: 25,
      isTrialMode: true,
    };

    handleProgressMessage(message);

    expect(mockElements.progressCount.textContent).toBe('Trial: 5 of 25');
  });

  it('shows trial folder hint on completion', async () => {
    const { handleProgressMessage, setElements } = await import('../popup/index');
    setElements(mockElements);

    // Mock folder hint element
    const mockFolderHint = { textContent: '' };
    vi.stubGlobal('document', {
      querySelector: vi.fn().mockReturnValue(mockFolderHint),
    });

    const message: ProgressEvent = {
      type: 'complete',
      current: 25,
      total: 25,
      isTrialMode: true,
      stats: {
        processed: 25,
        duplicatesMerged: 0,
        deadlinks: 0,
        unreachable: 0,
        categories: 5,
      },
    };

    handleProgressMessage(message);

    expect(mockFolderHint.textContent).toBe('Check 🧪Trial folder');

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/popup/index.test.ts`
Expected: FAIL with "Expected 'Trial: 5 of 25'"

- [ ] **Step 3: Write minimal implementation**

Modify `src/popup/index.ts`:

Find the `handleProgressMessage` function and update:

```typescript
export function handleProgressMessage(message: ProgressEvent): boolean {
  if (message.type === 'progress') {
    updateProgress(message.current, message.total, message.currentUrl);

    // Update UI for trial mode
    if (message.isTrialMode) {
      const els = getElements();
      els.progressCount.textContent = `Trial: ${message.current} of ${message.total}`;
    }

    return true;
  } else if (message.type === 'complete') {
    showResults(message.stats);
    showState('complete');

    // Update completion message for trial mode
    if (message.isTrialMode) {
      const folderHint = document.querySelector('.folder-hint');
      if (folderHint) {
        folderHint.textContent = 'Check 🧪Trial folder';
      }
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/popup/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/popup/index.ts src/popup/index.test.ts
git commit -m "feat: update progress and completion messages for trial mode"
```

---

## Phase 4: Testing & Documentation (Day 3)

### Task 17: Run Full Test Suite

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests pass (280+ existing + new tests)

- [ ] **Step 2: Run tests with coverage**

Run: `pnpm test:coverage`
Expected: Coverage ≥ 95% for all modified files

- [ ] **Step 3: Build project**

Run: `pnpm build`
Expected: Build succeeds with no errors

---

### Task 18: Update Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `USAGE.md`

- [ ] **Step 1: Update CLAUDE.md**

Add to Features table:

```markdown
| **Trial mode** | Process random subset of N bookmarks for testing |
```

- [ ] **Step 2: Update USAGE.md**

Add section:

```markdown
## Trial Mode

Test the organization workflow with a small subset before processing all bookmarks:

1. **Enter trial count**: In the popup, enter a number (e.g., 25) in the trial input field
2. **Click "Organize Bookmarks"**: Processes only 25 randomly selected bookmarks
3. **Check results**: Review the `🧪Trial/` folder in "Other Bookmarks"
4. **Run full mode**: Leave input empty to process all bookmarks to `📁Organized/`

**Trial mode benefits:**
- Quick validation of categorization quality
- Test workflow before committing to full processing
- Results in separate folder to avoid confusion
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md USAGE.md
git commit -m "docs: update documentation for trial mode feature"
```

---

### Task 19: Final Verification

- [ ] **Step 1: Manual testing**

1. Load extension in Chrome
2. Enter trial count (e.g., 25)
3. Click "Organize Bookmarks"
4. Verify progress shows "Trial: X of 25"
5. Verify completion message references `🧪Trial` folder
6. Verify folder contains ~25 bookmarks
7. Click "Clear All Data"
8. Verify both `📁Organized/` and `🧪Trial/` are deleted

- [ ] **Step 2: Create final commit**

```bash
git add -A
git commit -m "feat: complete trial mode implementation

- Add random bookmark selection using Fisher-Yates shuffle
- Support custom folder names (🧪Trial/ vs 📁Organized/)
- Add trial input UI with validation
- Update progress messages for trial mode
- Clear both folders on reset
- Add comprehensive tests for all new functionality"
```

---

## Success Criteria

- [ ] User can enter a number and process only that many bookmarks
- [ ] Random selection is uniform (verified by statistical tests)
- [ ] Results appear in `🧪Trial/` folder
- [ ] Progress shows "Trial: X of Y"
- [ ] Completion message references correct folder
- [ ] Reset clears both `📁Trial/` and `📁Organized/`
- [ ] Empty input processes all bookmarks (existing behavior)
- [ ] Invalid input shows error and prevents start
- [ ] All tests pass (280+ existing + new tests)
- [ ] No performance regression for full mode
- [ ] Documentation updated

---

## Notes

- All code follows existing project patterns and conventions
- TDD approach: write test first, verify failure, implement minimal code, verify pass
- Frequent commits after each task
- No placeholders - all code is complete and ready to implement
- Tests use real code where possible, mocks only for Chrome APIs
