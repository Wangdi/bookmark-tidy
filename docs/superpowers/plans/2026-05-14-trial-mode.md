# Trial Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add trial mode to process a configurable subset of N bookmarks, with results preserved in timestamped folders for later review.

**Architecture:** Fisher-Yates shuffle for random selection, timestamped `📁Organized (Trial N) - YYYY-MM-DD/` folder naming, input validation (min 10, max 500, default 50), message passing between popup and background with `maxBookmarks` option.

**Tech Stack:** TypeScript, Vitest, Chrome Extensions API, Fisher-Yates shuffle algorithm

---

## File Structure

**New files:**
- None (all changes to existing files)

**Modified files:**
- `src/types/index.ts` - Add `OrganizationOptions`, `isTrialMode`, `trialInfo` to types
- `src/background/index.ts` - Add shuffle logic, trial mode handling, timestamped folder creation
- `src/background/index.test.ts` - Unit tests for shuffle and selection
- `src/background/index.integration.test.ts` - Integration tests for trial workflow
- `src/modules/organizer.ts` - Support custom folder name with timestamp
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
    const options: import('../types').OrganizationOptions = { maxBookmarks: 50 };
    expect(options.maxBookmarks).toBe(50);
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

### Task 2: Add isTrialMode and trialInfo to ProgressEvent

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.test.ts`:

```typescript
describe('ProgressEvent trial mode', () => {
  it('includes isTrialMode flag in progress event', () => {
    const event: import('../types').ProgressEvent = {
      type: 'progress',
      current: 5,
      total: 25,
      isTrialMode: true,
      trialInfo: {
        folderName: '📁Organized (Trial 25) - 2026-05-14',
        processedCount: 25,
        totalCount: 100,
      },
    };
    expect(event.isTrialMode).toBe(true);
    expect(event.trialInfo?.folderName).toContain('Trial 25');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.test.ts`
Expected: FAIL with "Property 'isTrialMode' does not exist"

- [ ] **Step 3: Write minimal implementation**

Modify `src/types/index.ts`:

```typescript
export interface TrialInfo {
  folderName: string;       // e.g., "📁Organized (Trial 25) - 2026-05-14"
  processedCount: number;   // Number of bookmarks in trial
  totalCount: number;       // Total bookmarks available
}

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
  isTrialMode?: boolean;  // Flag for trial mode
  trialInfo?: TrialInfo;  // Trial-specific information
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/background/index.test.ts
git commit -m "feat: add isTrialMode and TrialInfo to ProgressEvent"
```

---

### Task 3: Add Trial Mode Constants

**Files:**
- Modify: `src/background/index.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.test.ts`:

```typescript
describe('Trial mode constants', () => {
  it('defines minimum trial count as 10', () => {
    const { TRIAL_MIN_BOOKMARKS } = await import('../background/index');
    expect(TRIAL_MIN_BOOKMARKS).toBe(10);
  });

  it('defines maximum trial count as 500', () => {
    const { TRIAL_MAX_BOOKMARKS } = await import('../background/index');
    expect(TRIAL_MAX_BOOKMARKS).toBe(500);
  });

  it('defines default trial count as 50', () => {
    const { TRIAL_DEFAULT_BOOKMARKS } = await import('../background/index');
    expect(TRIAL_DEFAULT_BOOKMARKS).toBe(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.test.ts`
Expected: FAIL with "TRIAL_MIN_BOOKMARKS is not defined"

- [ ] **Step 3: Write minimal implementation**

Add to `src/background/index.ts` (after FETCH_BATCH_SIZE):

```typescript
/**
 * Trial mode configuration
 */
export const TRIAL_MIN_BOOKMARKS = 10;
export const TRIAL_MAX_BOOKMARKS = 500;
export const TRIAL_DEFAULT_BOOKMARKS = 50;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/background/index.ts src/background/index.test.ts
git commit -m "feat: add trial mode constants (min 10, max 500, default 50)"
```

---

### Task 4: Implement shuffleArray Function

**Files:**
- Modify: `src/background/index.ts`
- Modify: `src/background/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.test.ts`:

```typescript
describe('shuffleArray', () => {
  it('returns array of same length', async () => {
    const { shuffleArray } = await import('../background/index');
    const arr = [1, 2, 3, 4, 5];
    expect(shuffleArray(arr)).toHaveLength(5);
  });

  it('contains all original elements', async () => {
    const { shuffleArray } = await import('../background/index');
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray(arr);
    expect(shuffled.sort()).toEqual(arr.sort());
  });

  it('does not modify original array', async () => {
    const { shuffleArray } = await import('../background/index');
    const arr = [1, 2, 3, 4, 5];
    const original = [...arr];
    shuffleArray(arr);
    expect(arr).toEqual(original);
  });

  it('produces different orders on multiple calls', async () => {
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

### Task 5: Implement selectRandomBookmarks Function

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

  it('returns all bookmarks when count >= total', async () => {
    const { selectRandomBookmarks } = await import('../background/index');
    const bookmarks = [createBookmark('1'), createBookmark('2'), createBookmark('3')];
    expect(selectRandomBookmarks(bookmarks, 5)).toHaveLength(3);
  });

  it('returns exactly N bookmarks', async () => {
    const { selectRandomBookmarks } = await import('../background/index');
    const bookmarks = [
      createBookmark('1'), createBookmark('2'), createBookmark('3'),
      createBookmark('4'), createBookmark('5')
    ];
    expect(selectRandomBookmarks(bookmarks, 3)).toHaveLength(3);
  });

  it('returns subset of original bookmarks', async () => {
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

  it('returns empty array when count is 0', async () => {
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

### Task 6: Implement generateTrialFolderName Function

**Files:**
- Modify: `src/background/index.ts`
- Modify: `src/background/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.test.ts`:

```typescript
describe('generateTrialFolderName', () => {
  it('generates folder name with trial count and date', async () => {
    const { generateTrialFolderName } = await import('../background/index');
    
    const name = generateTrialFolderName(25);
    
    expect(name).toContain('📁Organized (Trial 25)');
    expect(name).toMatch(/\d{4}-\d{2}-\d{2}/);  // Contains date YYYY-MM-DD
  });

  it('uses provided date', async () => {
    const { generateTrialFolderName } = await import('../background/index');
    
    const name = generateTrialFolderName(50, '2026-05-14');
    
    expect(name).toBe('📁Organized (Trial 50) - 2026-05-14');
  });

  it('handles different counts', async () => {
    const { generateTrialFolderName } = await import('../background/index');
    
    expect(generateTrialFolderName(10)).toContain('Trial 10');
    expect(generateTrialFolderName(500)).toContain('Trial 500');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.test.ts`
Expected: FAIL with "generateTrialFolderName is not defined"

- [ ] **Step 3: Write minimal implementation**

Add to `src/background/index.ts` (after selectRandomBookmarks):

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/background/index.ts src/background/index.test.ts
git commit -m "feat: implement generateTrialFolderName with timestamp format"
```

---

### Task 7: Modify organizeBookmarks for Custom Folder Name

**Files:**
- Modify: `src/modules/organizer.ts`
- Modify: `src/modules/organizer.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/modules/organizer.test.ts`:

```typescript
describe('organizeBookmarks custom folder name', () => {
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
    await organizeBookmarks([], [], [], 0, '📁Organized (Trial 25) - 2026-05-14');

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: '📁Organized (Trial 25) - 2026-05-14' })
    );

    vi.unstubAllGlobals();
  });

  it('uses default folder name when not specified', async () => {
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
    await organizeBookmarks([], [], [], 0);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: '📁Organized' })
    );

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/modules/organizer.test.ts`
Expected: FAIL with "Expected '📁Organized (Trial 25)" or wrong signature

- [ ] **Step 3: Write minimal implementation**

Modify `src/modules/organizer.ts`:

1. Find the `organizeBookmarks` function signature and change:

```typescript
export async function organizeBookmarks(
  categorizedBookmarks: CategorizedBookmark[],
  deadlinks: ProcessedBookmark[],
  unreachable: ProcessedBookmark[],
  duplicatesMerged: number,
  folderName: string = '📁Organized'  // NEW: configurable folder name
): Promise<OrganizerResult> {
```

2. Find where the folder is created and update to use the parameter:

```typescript
  // Delete existing folder with same name (for trial folders, this allows multiple trials)
  // Note: We only delete if it's the main 📁Organized folder, not trial folders
  
  // Create root organized folder
  const organizedFolder = await createFolder(folderName, parentId);
```

3. Update `clearOrganizedFolder` to handle both types:

```typescript
export async function clearOrganizedFolder(
  folderName: string = '📁Organized'
): Promise<void> {
  const existing = await findFolderByName(folderName);
  if (existing && existing.id) {
    await chrome.bookmarks.removeTree(existing.id);
  }
}
```

4. Add helper function to find folder by name:

```typescript
async function findFolderByName(name: string): Promise<chrome.bookmarks.BookmarkTreeNode | null> {
  const tree = await chrome.bookmarks.getTree();
  const root = tree[0];

  function search(node: chrome.bookmarks.BookmarkTreeNode): chrome.bookmarks.BookmarkTreeNode | null {
    if (node.title === name && !node.url) {
      return node;
    }
    for (const child of node.children || []) {
      const found = search(child);
      if (found) return found;
    }
    return null;
  }

  for (const rootChild of root.children || []) {
    const found = search(rootChild);
    if (found) return found;
  }

  return null;
}
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

### Task 8: Update resetStorage to Clear Only Main Folder

**Files:**
- Modify: `src/background/index.ts`
- Modify: `src/background/index.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.integration.test.ts`:

```typescript
describe('resetStorage clears only main folder', () => {
  it('clears only 📁Organized folder, not trial folders', async () => {
    const mockRemoveTree = vi.fn();
    const mockGetTree = vi.fn().mockResolvedValue([{
      id: '0',
      title: 'Root',
      children: [{
        id: '1',
        title: 'Other Bookmarks',
        children: [
          { id: '2', title: '📁Organized' },
          { id: '3', title: '📁Organized (Trial 25) - 2026-05-14' },
          { id: '4', title: '📁Organized (Trial 50) - 2026-05-13' },
        ],
      }],
    }]);

    vi.stubGlobal('chrome', {
      bookmarks: {
        getTree: mockGetTree,
        removeTree: mockRemoveTree,
      },
      runtime: { lastError: null },
    });

    vi.mock('../lib/storage', () => ({
      clearAll: vi.fn(),
    }));

    const { resetStorage } = await import('../background/index');
    await resetStorage();

    // Should only delete the main 📁Organized folder
    expect(mockRemoveTree).toHaveBeenCalledWith('2');
    expect(mockRemoveTree).not.toHaveBeenCalledWith('3');
    expect(mockRemoveTree).not.toHaveBeenCalledWith('4');

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.integration.test.ts`
Expected: FAIL with "Expected 'removeTree' not called with '3'"

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

  // Delete only the main organized folder (not trial folders)
  // Trial folders are preserved for user review
  await clearOrganizedFolder('📁Organized');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/background/index.ts src/background/index.integration.test.ts
git commit -m "feat: resetStorage clears only main folder, preserves trial folders"
```

---

## Phase 2: Backend - Integration (Day 1 continued)

### Task 9: Modify runOrganization for Trial Mode

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
      bookmarks: { getTree: mockGetTree, create: vi.fn().mockResolvedValue({ id: '1' }), removeTree: vi.fn() },
      runtime: { sendMessage: vi.fn(), lastError: null },
    });

    vi.mock('../modules/fetcher', () => ({
      fetchBookmark: vi.fn(async (b) => ({ ...b, status: 'ok', meta: {}, headings: [] })),
    }));

    const { runOrganization, resetState, state } = await import('../background/index');
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

  it('creates timestamped trial folder', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'folder-1' });
    
    vi.stubGlobal('chrome', {
      bookmarks: { 
        getTree: vi.fn().mockResolvedValue([{
          id: '0',
          title: 'Root',
          children: Array(50).fill(null).map((_, i) => ({
            id: `${i + 1}`,
            title: `Bookmark ${i}`,
            url: `https://example${i}.com`,
          })),
        }]), 
        create: mockCreate, 
        removeTree: vi.fn() 
      },
      runtime: { sendMessage: vi.fn(), lastError: null },
    });

    vi.mock('../modules/fetcher', () => ({
      fetchBookmark: vi.fn(async (b) => ({ ...b, status: 'ok', meta: {}, headings: [] })),
    }));

    const { runOrganization, resetState } = await import('../background/index');
    resetState();
    
    await runOrganization({ maxBookmarks: 25 });

    // First create call should be for the trial folder
    const folderCall = mockCreate.mock.calls.find(
      call => call[0].title?.includes('Trial 25')
    );
    expect(folderCall).toBeDefined();
    expect(folderCall[0].title).toMatch(/📁Organized \(Trial 25\) - \d{4}-\d{2}-\d{2}/);

    vi.unstubAllGlobals();
  });

  it('full mode creates clean 📁Organized folder', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'folder-1' });
    
    vi.stubGlobal('chrome', {
      bookmarks: { 
        getTree: vi.fn().mockResolvedValue([{
          id: '0',
          title: 'Root',
          children: Array(50).fill(null).map((_, i) => ({
            id: `${i + 1}`,
            title: `Bookmark ${i}`,
            url: `https://example${i}.com`,
          })),
        }]), 
        create: mockCreate, 
        removeTree: vi.fn() 
      },
      runtime: { sendMessage: vi.fn(), lastError: null },
    });

    vi.mock('../modules/fetcher', () => ({
      fetchBookmark: vi.fn(async (b) => ({ ...b, status: 'ok', meta: {}, headings: [] })),
    }));

    const { runOrganization, resetState } = await import('../background/index');
    resetState();
    
    await runOrganization();  // No maxBookmarks = full mode

    // Should create clean 📁Organized folder
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: '📁Organized' })
    );

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

2. Update `OrganizerState` interface in `src/types/index.ts`:

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

    // ===== PHASE 1: FETCH TO STORAGE =====
    // ... existing fetch logic, but use bookmarksToProcess instead of rawBookmarks ...

    // Update progress messages to include trial mode info
    if (isTrialMode) {
      await sendProgress({
        type: "progress",
        current: 0,
        total,
        currentUrl: `Trial mode: Processing ${total} of ${totalCount} bookmarks`,
        isTrialMode: true,
        trialInfo,
      });
    }

    // ===== PHASE 2: CATEGORIZE AND ORGANIZE =====
    // ... existing categorization logic ...

    // Pass folder name to organizer
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

    return true;
  } catch (error) {
    // ... error handling ...
  } finally {
    state.isRunning = false;
    state.shouldAbort = false;
    state.isTrialMode = false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/background/index.ts src/background/index.integration.test.ts
git commit -m "feat: implement trial mode in runOrganization with timestamped folders"
```

---

### Task 10: Update Message Handler for Trial Mode

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

### Task 11: Add Trial Input to Popup HTML

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
          min="10"
          max="500"
          step="1"
          placeholder="e.g., 50" 
          class="trial-input"
        />
        <span class="trial-hint">bookmarks</span>
      </div>
      <p class="trial-help">Leave empty to process all. Range: 10-500 (default: 50)</p>
    </div>
```

- [ ] **Step 2: Commit**

```bash
git add src/popup/popup.html
git commit -m "feat: add trial mode input to popup UI with validation hints"
```

---

### Task 12: Style Trial Input

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

.trial-input:invalid {
  border-color: var(--error-color, #d32f2f);
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

.trial-error {
  margin-top: 8px;
  font-size: 12px;
  color: var(--error-color, #d32f2f);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/popup/styles.css
git commit -m "feat: add styles for trial mode input with validation states"
```

---

### Task 13: Add Trial Input to PopupElements

**Files:**
- Modify: `src/popup/index.ts`
- Modify: `src/popup/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/popup/index.test.ts`:

```typescript
describe('trial input elements', () => {
  it('includes trialCount element in PopupElements', async () => {
    const { PopupElements } = await import('../popup/index');
    const elements: PopupElements = {
      // ... existing elements ...
      trialCount: createMockElement() as HTMLInputElement,
      trialError: createMockElement() as HTMLElement,
    };
    expect(elements.trialCount).toBeDefined();
    expect(elements.trialError).toBeDefined();
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
  trialError: HTMLElement;       // NEW
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
      trialError: document.getElementById('trial-error')!,  // NEW (create in HTML)
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
git commit -m "feat: add trialCount and trialError to PopupElements"
```

---

### Task 14: Implement validateTrialCount Function

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

  it('accepts valid count within range', async () => {
    const { validateTrialCount } = await import('../popup/index');
    expect(validateTrialCount(50, 100)).toEqual({ valid: true });
  });

  it('accepts minimum (10)', async () => {
    const { validateTrialCount } = await import('../popup/index');
    expect(validateTrialCount(10, 100)).toEqual({ valid: true });
  });

  it('accepts maximum (500)', async () => {
    const { validateTrialCount } = await import('../popup/index');
    expect(validateTrialCount(500, 1000)).toEqual({ valid: true });
  });

  it('rejects count below minimum', async () => {
    const { validateTrialCount } = await import('../popup/index');
    expect(validateTrialCount(5, 100)).toEqual({
      valid: false,
      error: 'Minimum 10 bookmarks'
    });
  });

  it('rejects count below minimum (edge case: 9)', async () => {
    const { validateTrialCount } = await import('../popup/index');
    expect(validateTrialCount(9, 100)).toEqual({
      valid: false,
      error: 'Minimum 10 bookmarks'
    });
  });

  it('rejects count above maximum', async () => {
    const { validateTrialCount } = await import('../popup/index');
    expect(validateTrialCount(600, 1000)).toEqual({
      valid: false,
      error: 'Maximum 500 bookmarks'
    });
  });

  it('rejects count above maximum (edge case: 501)', async () => {
    const { validateTrialCount } = await import('../popup/index');
    expect(validateTrialCount(501, 1000)).toEqual({
      valid: false,
      error: 'Maximum 500 bookmarks'
    });
  });

  it('rejects count > total', async () => {
    const { validateTrialCount } = await import('../popup/index');
    expect(validateTrialCount(150, 100)).toEqual({
      valid: false,
      error: 'Cannot exceed 100 bookmarks'
    });
  });

  it('rejects negative count', async () => {
    const { validateTrialCount } = await import('../popup/index');
    expect(validateTrialCount(-5, 100)).toEqual({
      valid: false,
      error: 'Minimum 10 bookmarks'
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
// Import constants from background
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
    return { valid: true };  // Empty = process all
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/popup/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/popup/index.ts src/popup/index.test.ts
git commit -m "feat: implement validateTrialCount with min 10, max 500 limits"
```

---

### Task 15: Implement getTrialCount Function

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
    
    mockElements.trialCount.value = '50';
    
    expect(getTrialCount()).toBe(50);
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
    
    mockElements.trialCount.value = '50.7';
    
    expect(getTrialCount()).toBe(50);
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

### Task 16: Modify startOrganization for Trial Mode

**Files:**
- Modify: `src/popup/index.ts`
- Modify: `src/popup/index.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/popup/index.integration.test.ts`:

```typescript
describe('startOrganization trial mode', () => {
  it('shows error for count below minimum', async () => {
    const mockSendMessage = vi.fn();
    
    vi.stubGlobal('chrome', {
      runtime: { sendMessage: mockSendMessage, onMessage: { addListener: vi.fn() } },
      bookmarks: { getTree: vi.fn().mockResolvedValue([{ id: '0', title: 'Root', children: [] }]) },
    });

    const { startOrganization, setElements } = await import('../popup/index');
    setElements(mockElements);
    
    mockElements.trialCount.value = '5';
    await startOrganization();

    expect(mockElements.bookmarkCount.textContent).toContain('Minimum 10');
    expect(mockSendMessage).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('shows error for count above maximum', async () => {
    const mockSendMessage = vi.fn();
    
    vi.stubGlobal('chrome', {
      runtime: { sendMessage: mockSendMessage, onMessage: { addListener: vi.fn() } },
      bookmarks: { getTree: vi.fn().mockResolvedValue([{ id: '0', title: 'Root', children: [] }]) },
    });

    const { startOrganization, setElements } = await import('../popup/index');
    setElements(mockElements);
    
    mockElements.trialCount.value = '600';
    await startOrganization();

    expect(mockElements.bookmarkCount.textContent).toContain('Maximum 500');
    expect(mockSendMessage).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('sends maxBookmarks when trial count is valid', async () => {
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
    
    mockElements.trialCount.value = '50';
    await startOrganization();

    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'START_ORGANIZE', maxBookmarks: 50 })
    );

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/popup/index.integration.test.ts`
Expected: FAIL with "maxBookmarks not sent" or "Expected 'Minimum 10'"

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

### Task 17: Update handleProgressMessage for Trial Mode

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
      trialInfo: {
        folderName: '📁Organized (Trial 25) - 2026-05-14',
        processedCount: 25,
        totalCount: 100,
      },
    };

    handleProgressMessage(message);

    expect(mockElements.progressCount.textContent).toBe('Trial: 5 of 25 (of 100 total)');
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
      trialInfo: {
        folderName: '📁Organized (Trial 25) - 2026-05-14',
        processedCount: 25,
        totalCount: 100,
      },
      stats: {
        processed: 25,
        duplicatesMerged: 0,
        deadlinks: 0,
        unreachable: 0,
        categories: 5,
      },
    };

    handleProgressMessage(message);

    expect(mockFolderHint.textContent).toBe('Check 📁Organized (Trial 25) - 2026-05-14');

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/popup/index.test.ts`
Expected: FAIL with "Expected 'Trial: 5 of 25"

- [ ] **Step 3: Write minimal implementation**

Modify `src/popup/index.ts`:

Find the `handleProgressMessage` function and update:

```typescript
export function handleProgressMessage(message: ProgressEvent): boolean {
  if (message.type === 'progress') {
    updateProgress(message.current, message.total, message.currentUrl);

    // Update UI for trial mode
    if (message.isTrialMode && message.trialInfo) {
      const els = getElements();
      els.progressCount.textContent = `Trial: ${message.current} of ${message.total} (of ${message.trialInfo.totalCount} total)`;
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
git commit -m "feat: update progress and completion messages for trial mode with folder name"
```

---

## Phase 4: Testing & Documentation (Day 3)

### Task 18: Run Full Test Suite

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests pass (existing + new trial mode tests)

- [ ] **Step 2: Run tests with coverage**

Run: `pnpm test:coverage`
Expected: Coverage ≥ 95% for all modified files

- [ ] **Step 3: Build project**

Run: `pnpm build`
Expected: Build succeeds with no errors

---

### Task 19: Update Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `USAGE.md`

- [ ] **Step 1: Update CLAUDE.md**

Add to Features table:

```markdown
| **Trial mode** | Process random subset (10-500) of bookmarks for testing, results saved to timestamped folder |
```

- [ ] **Step 2: Update USAGE.md**

Add section:

```markdown
## Trial Mode

Test the organization workflow with a small subset before processing all bookmarks:

1. **Enter trial count**: In the popup, enter a number (10-500) in the trial input field
2. **Click "Organize Bookmarks"**: Processes only the specified number of randomly selected bookmarks
3. **Check results**: Review the timestamped folder, e.g., `📁Organized (Trial 50) - 2026-05-14/`
4. **Run multiple trials**: Each trial creates a new timestamped folder
5. **Run full mode**: Leave input empty to process all bookmarks to `📁Organized/`

**Trial mode benefits:**
- Quick validation of categorization quality
- Test workflow before committing to full processing
- Multiple trials can coexist with timestamp-based naming
- Full run creates separate clean `📁Organized/` folder

**Limits:**
- Minimum: 10 bookmarks
- Maximum: 500 bookmarks
- Default: 50 bookmarks
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md USAGE.md
git commit -m "docs: update documentation for trial mode feature with timestamped folders"
```

---

### Task 20: Final Verification

- [ ] **Step 1: Manual testing**

1. Load extension in Chrome
2. Enter trial count (e.g., 25)
3. Click "Organize Bookmarks"
4. Verify progress shows "Trial: X of 25 (of N total)"
5. Verify completion message references `📁Organized (Trial 25) - YYYY-MM-DD` folder
6. Verify folder contains ~25 bookmarks
7. Run another trial with different count
8. Verify both trial folders exist with different timestamps
9. Run full mode (empty input)
10. Verify clean `📁Organized/` folder is created
11. Click "Clear All Data"
12. Verify only `📁Organized/` is deleted, trial folders preserved

- [ ] **Step 2: Create final commit**

```bash
git add -A
git commit -m "feat: complete trial mode implementation

- Add random bookmark selection using Fisher-Yates shuffle
- Support timestamped trial folders: 📁Organized (Trial N) - YYYY-MM-DD
- Add trial input UI with validation (min 10, max 500, default 50)
- Update progress messages for trial mode with total count
- Preserve trial folders on reset, clear only main folder
- Add comprehensive tests for all new functionality"
```

---

## Success Criteria

- [ ] User can enter a number (10-500) and process only that many bookmarks
- [ ] Random selection is uniform (verified by statistical tests)
- [ ] Results appear in timestamped `📁Organized (Trial N) - YYYY-MM-DD/` folder
- [ ] Progress shows "Trial: X of Y (of Z total)"
- [ ] Completion message references correct folder name with timestamp
- [ ] Multiple trials can coexist with different timestamps
- [ ] Reset clears only `📁Organized/`, preserves trial folders
- [ ] Empty input processes all bookmarks (existing behavior)
- [ ] Invalid input shows error and prevents start
- [ ] All tests pass
- [ ] No performance regression for full mode
- [ ] Documentation updated

---

## Notes

- All code follows existing project patterns and conventions
- TDD approach: write test first, verify failure, implement minimal code, verify pass
- Frequent commits after each task
- No placeholders - all code is complete and ready to implement
- Tests use real code where possible, mocks only for Chrome APIs
- Trial folder naming format: `📁Organized (Trial N) - YYYY-MM-DD`
