# Auto-navigate to Organized Folder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically open Chrome Bookmarks Manager and navigate to/highlight the organized folder after successful completion, with user preference toggle.

**Architecture:** Chrome tabs API to open bookmarks manager, chrome.bookmarks API to find folder ID, URL fragment navigation (`chrome://bookmarks/#<folder-id>`), chrome.storage.sync for user preference, works for both trial and full mode folders.

**Tech Stack:** TypeScript, Vitest, Chrome Extensions API (tabs, bookmarks, storage)

**Branch:** feature/auto-navigate

---

## File Structure

**New files:**
- None (all changes to existing files)

**Modified files:**
- `src/types/index.ts` - Add `UserPreferences` interface and `autoNavigate` preference
- `src/background/index.ts` - Add navigation logic, preference loading, completion handling
- `src/background/index.test.ts` - Unit tests for navigation functions
- `src/background/index.integration.test.ts` - Integration tests for completion flow
- `src/popup/index.ts` - Add preference toggle handling
- `src/popup/index.test.ts` - Unit tests for preference UI
- `src/popup/popup.html` - Add preference checkbox
- `src/popup/styles.css` - Style preference UI

---

## Phase 1: Backend - Core Logic (Day 1)

### Task 1: Add UserPreferences Type

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Write the failing test**

Create test in `src/background/index.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('UserPreferences type', () => {
  it('has autoNavigate property with default true', () => {
    const prefs: import('../types').UserPreferences = {
      autoNavigate: true,
    };
    expect(prefs.autoNavigate).toBe(true);
  });

  it('can be undefined for default behavior', () => {
    const prefs: import('../types').UserPreferences = {};
    expect(prefs.autoNavigate).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.test.ts`
Expected: FAIL with "Cannot find namespace 'UserPreferences'"

- [ ] **Step 3: Write minimal implementation**

Add to `src/types/index.ts`:

```typescript
export interface UserPreferences {
  autoNavigate?: boolean;  // undefined or true = enabled, false = disabled
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/background/index.test.ts
git commit -m "feat: add UserPreferences type for auto-navigate setting"
```

---

### Task 2: Add OrganizedFolderInfo Type

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.test.ts`:

```typescript
describe('OrganizedFolderInfo type', () => {
  it('contains folder ID and title', () => {
    const info: import('../types').OrganizedFolderInfo = {
      id: '123',
      title: '📁Organized',
    };
    expect(info.id).toBe('123');
    expect(info.title).toBe('📁Organized');
  });

  it('can include trial mode indicator', () => {
    const info: import('../types').OrganizedFolderInfo = {
      id: '456',
      title: '🧪Trial',
      isTrial: true,
    };
    expect(info.isTrial).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.test.ts`
Expected: FAIL with "Cannot find namespace 'OrganizedFolderInfo'"

- [ ] **Step 3: Write minimal implementation**

Add to `src/types/index.ts`:

```typescript
export interface OrganizedFolderInfo {
  id: string;
  title: string;
  isTrial?: boolean;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/background/index.test.ts
git commit -m "feat: add OrganizedFolderInfo type for folder tracking"
```

---

### Task 3: Implement getUserPreferences Function

**Files:**
- Modify: `src/background/index.ts`
- Modify: `src/background/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.test.ts`:

```typescript
describe('getUserPreferences', () => {
  it('returns default preferences when storage is empty', async () => {
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({}),
        },
      },
    });

    const { getUserPreferences } = await import('../background/index');
    const prefs = await getUserPreferences();

    expect(prefs.autoNavigate).toBe(true);  // Default is enabled

    vi.unstubAllGlobals();
  });

  it('returns stored preferences', async () => {
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({
            userPreferences: { autoNavigate: false },
          }),
        },
      },
    });

    const { getUserPreferences } = await import('../background/index');
    const prefs = await getUserPreferences();

    expect(prefs.autoNavigate).toBe(false);

    vi.unstubAllGlobals();
  });

  it('handles undefined autoNavigate as true', async () => {
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({
            userPreferences: {},
          }),
        },
      },
    });

    const { getUserPreferences } = await import('../background/index');
    const prefs = await getUserPreferences();

    expect(prefs.autoNavigate).toBe(true);  // undefined defaults to true

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.test.ts`
Expected: FAIL with "getUserPreferences is not defined"

- [ ] **Step 3: Write minimal implementation**

Add to `src/background/index.ts` (after imports, before state):

```typescript
import type { UserPreferences } from '../types';

/**
 * Load user preferences from Chrome storage
 * Defaults to autoNavigate: true if not set
 */
export async function getUserPreferences(): Promise<UserPreferences> {
  try {
    const result = await chrome.storage.sync.get('userPreferences');
    const prefs = result.userPreferences || {};
    
    // Default to enabled if not explicitly set
    return {
      autoNavigate: prefs.autoNavigate !== false,  // true unless explicitly false
    };
  } catch (error) {
    console.error('Failed to load user preferences:', error);
    return { autoNavigate: true };  // Default on error
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/background/index.ts src/background/index.test.ts
git commit -m "feat: implement getUserPreferences with default true"
```

---

### Task 4: Implement findOrganizedFolder Function

**Files:**
- Modify: `src/background/index.ts`
- Modify: `src/background/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.test.ts`:

```typescript
describe('findOrganizedFolder', () => {
  it('finds Organized folder by title', async () => {
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
              { id: '3', title: 'Other Folder' },
            ],
          }],
        }]),
      },
    });

    const { findOrganizedFolder } = await import('../background/index');
    const folder = await findOrganizedFolder('Organized');

    expect(folder).toBeDefined();
    expect(folder?.id).toBe('2');
    expect(folder?.title).toBe('📁Organized');

    vi.unstubAllGlobals();
  });

  it('finds Trial folder by title', async () => {
    vi.stubGlobal('chrome', {
      bookmarks: {
        getTree: vi.fn().mockResolvedValue([{
          id: '0',
          title: 'Root',
          children: [{
            id: '1',
            title: 'Other Bookmarks',
            children: [
              { id: '2', title: '🧪Trial' },
            ],
          }],
        }]),
      },
    });

    const { findOrganizedFolder } = await import('../background/index');
    const folder = await findOrganizedFolder('Trial');

    expect(folder).toBeDefined();
    expect(folder?.id).toBe('2');
    expect(folder?.title).toBe('🧪Trial');

    vi.unstubAllGlobals();
  });

  it('returns undefined if folder not found', async () => {
    vi.stubGlobal('chrome', {
      bookmarks: {
        getTree: vi.fn().mockResolvedValue([{
          id: '0',
          title: 'Root',
          children: [],
        }]),
      },
    });

    const { findOrganizedFolder } = await import('../background/index');
    const folder = await findOrganizedFolder('Organized');

    expect(folder).toBeUndefined();

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.test.ts`
Expected: FAIL with "findOrganizedFolder is not defined"

- [ ] **Step 3: Write minimal implementation**

Add to `src/background/index.ts` (after getUserPreferences):

```typescript
import type { OrganizedFolderInfo } from '../types';

/**
 * Find organized folder by name in bookmark tree
 */
export async function findOrganizedFolder(
  folderName: string
): Promise<OrganizedFolderInfo | undefined> {
  try {
    const tree = await chrome.bookmarks.getTree();
    const emoji = folderName === 'Trial' ? '🧪' : '📁';
    const targetTitle = `${emoji}${folderName}`;

    // Recursively search for folder
    function searchTree(nodes: any[]): any | undefined {
      for (const node of nodes) {
        if (node.title === targetTitle) {
          return {
            id: node.id,
            title: node.title,
            isTrial: folderName === 'Trial',
          };
        }
        if (node.children) {
          const found = searchTree(node.children);
          if (found) return found;
        }
      }
      return undefined;
    }

    return searchTree(tree);
  } catch (error) {
    console.error('Failed to find organized folder:', error);
    return undefined;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/background/index.ts src/background/index.test.ts
git commit -m "feat: implement findOrganizedFolder for folder lookup"
```

---

### Task 5: Implement navigateToFolder Function

**Files:**
- Modify: `src/background/index.ts`
- Modify: `src/background/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.test.ts`:

```typescript
describe('navigateToFolder', () => {
  it('opens bookmarks manager with folder ID fragment', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'tab-1' });
    
    vi.stubGlobal('chrome', {
      tabs: {
        create: mockCreate,
      },
    });

    const { navigateToFolder } = await import('../background/index');
    await navigateToFolder('123');

    expect(mockCreate).toHaveBeenCalledWith({
      url: 'chrome://bookmarks/#123',
    });

    vi.unstubAllGlobals();
  });

  it('handles folder ID with special characters', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'tab-1' });
    
    vi.stubGlobal('chrome', {
      tabs: {
        create: mockCreate,
      },
    });

    const { navigateToFolder } = await import('../background/index');
    await navigateToFolder('folder-123');

    expect(mockCreate).toHaveBeenCalledWith({
      url: 'chrome://bookmarks/#folder-123',
    });

    vi.unstubAllGlobals();
  });

  it('logs success message', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    vi.stubGlobal('chrome', {
      tabs: {
        create: vi.fn().mockResolvedValue({ id: 'tab-1' }),
      },
    });

    const { navigateToFolder } = await import('../background/index');
    await navigateToFolder('123');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Navigating to folder')
    );

    consoleSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.test.ts`
Expected: FAIL with "navigateToFolder is not defined"

- [ ] **Step 3: Write minimal implementation**

Add to `src/background/index.ts` (after findOrganizedFolder):

```typescript
/**
 * Navigate to folder in Chrome Bookmarks Manager
 */
export async function navigateToFolder(folderId: string): Promise<void> {
  try {
    const url = `chrome://bookmarks/#${folderId}`;
    await chrome.tabs.create({ url });
    console.log(`Navigating to folder: ${folderId}`);
  } catch (error) {
    console.error('Failed to navigate to folder:', error);
    throw error;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/background/index.ts src/background/index.test.ts
git commit -m "feat: implement navigateToFolder using URL fragment"
```

---

### Task 6: Implement autoNavigateOnCompletion Function

**Files:**
- Modify: `src/background/index.ts`
- Modify: `src/background/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.test.ts`:

```typescript
describe('autoNavigateOnCompletion', () => {
  it('navigates to folder when preference is enabled', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'tab-1' });
    
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
            ],
          }],
        }]),
      },
      tabs: {
        create: mockCreate,
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({
            userPreferences: { autoNavigate: true },
          }),
        },
      },
    });

    const { autoNavigateOnCompletion } = await import('../background/index');
    await autoNavigateOnCompletion('Organized');

    expect(mockCreate).toHaveBeenCalledWith({
      url: 'chrome://bookmarks/#2',
    });

    vi.unstubAllGlobals();
  });

  it('does nothing when preference is disabled', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'tab-1' });
    
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
            ],
          }],
        }]),
      },
      tabs: {
        create: mockCreate,
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({
            userPreferences: { autoNavigate: false },
          }),
        },
      },
    });

    const { autoNavigateOnCompletion } = await import('../background/index');
    await autoNavigateOnCompletion('Organized');

    expect(mockCreate).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('handles missing folder gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mockCreate = vi.fn().mockResolvedValue({ id: 'tab-1' });
    
    vi.stubGlobal('chrome', {
      bookmarks: {
        getTree: vi.fn().mockResolvedValue([{
          id: '0',
          title: 'Root',
          children: [],
        }]),
      },
      tabs: {
        create: mockCreate,
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({
            userPreferences: { autoNavigate: true },
          }),
        },
      },
    });

    const { autoNavigateOnCompletion } = await import('../background/index');
    await autoNavigateOnCompletion('Organized');

    expect(mockCreate).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Could not find organized folder')
    );

    consoleSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('works with trial mode folder', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'tab-1' });
    
    vi.stubGlobal('chrome', {
      bookmarks: {
        getTree: vi.fn().mockResolvedValue([{
          id: '0',
          title: 'Root',
          children: [{
            id: '1',
            title: 'Other Bookmarks',
            children: [
              { id: '3', title: '🧪Trial' },
            ],
          }],
        }]),
      },
      tabs: {
        create: mockCreate,
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({
            userPreferences: { autoNavigate: true },
          }),
        },
      },
    });

    const { autoNavigateOnCompletion } = await import('../background/index');
    await autoNavigateOnCompletion('Trial');

    expect(mockCreate).toHaveBeenCalledWith({
      url: 'chrome://bookmarks/#3',
    });

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.test.ts`
Expected: FAIL with "autoNavigateOnCompletion is not defined"

- [ ] **Step 3: Write minimal implementation**

Add to `src/background/index.ts` (after navigateToFolder):

```typescript
/**
 * Auto-navigate to organized folder on completion
 * Checks user preference and navigates if enabled
 */
export async function autoNavigateOnCompletion(
  folderName: string
): Promise<void> {
  try {
    // Check user preference
    const prefs = await getUserPreferences();
    
    if (!prefs.autoNavigate) {
      console.log('Auto-navigate disabled by user preference');
      return;
    }

    // Find the folder
    const folder = await findOrganizedFolder(folderName);
    
    if (!folder) {
      console.warn(`Could not find organized folder: ${folderName}`);
      return;
    }

    // Navigate to the folder
    await navigateToFolder(folder.id);
    
    console.log(`Auto-navigated to folder: ${folder.title}`);
  } catch (error) {
    console.error('Auto-navigate failed:', error);
    // Don't throw - this is a nice-to-have feature
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/background/index.ts src/background/index.test.ts
git commit -m "feat: implement autoNavigateOnCompletion with preference check"
```

---

## Phase 2: Backend - Integration (Day 1 continued)

### Task 7: Integrate Auto-navigate with Completion Flow

**Files:**
- Modify: `src/background/index.ts`
- Modify: `src/background/index.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.integration.test.ts`:

```typescript
describe('auto-navigate on completion', () => {
  it('navigates after successful organization', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'tab-1' });
    const mockGetTree = vi.fn().mockResolvedValue([{
      id: '0',
      title: 'Root',
      children: [{
        id: '1',
        title: 'Other Bookmarks',
        children: [
          { id: '2', title: '📁Organized' },
        ],
      }],
    }]);

    vi.stubGlobal('chrome', {
      bookmarks: {
        getTree: mockGetTree,
        create: vi.fn().mockResolvedValue({ id: 'new-folder' }),
        removeTree: vi.fn(),
      },
      runtime: {
        sendMessage: vi.fn(),
        lastError: null,
      },
      tabs: {
        create: mockCreate,
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({
            userPreferences: { autoNavigate: true },
          }),
        },
      },
    });

    vi.mock('../modules/fetcher', () => ({
      fetchBookmark: vi.fn(async (b) => ({ 
        ...b, 
        status: 'ok', 
        meta: {}, 
        headings: [] 
      })),
    }));

    const { runOrganization, resetState } = await import('../background/index');
    resetState();
    
    await runOrganization();

    // Wait for completion
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockCreate).toHaveBeenCalledWith({
      url: 'chrome://bookmarks/#2',
    });

    vi.unstubAllGlobals();
  });

  it('does not navigate on error', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'tab-1' });

    vi.stubGlobal('chrome', {
      bookmarks: {
        getTree: vi.fn().mockRejectedValue(new Error('Test error')),
      },
      runtime: {
        sendMessage: vi.fn(),
        lastError: null,
      },
      tabs: {
        create: mockCreate,
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({
            userPreferences: { autoNavigate: true },
          }),
        },
      },
    });

    const { runOrganization, resetState } = await import('../background/index');
    resetState();
    
    await runOrganization();

    // Wait for error handling
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockCreate).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.integration.test.ts`
Expected: FAIL with "Expected mockCreate to have been called" or navigation not triggered

- [ ] **Step 3: Write minimal implementation**

Modify `src/background/index.ts`:

Find the completion section in `runOrganization` function and add auto-navigate call:

```typescript
export async function runOrganization(
  options?: OrganizationOptions
): Promise<boolean> {
  // ... existing code ...

  try {
    // ... existing processing logic ...

    // Completion
    sendProgress({
      type: 'complete',
      current: bookmarks.length,
      total: bookmarks.length,
      stats: {
        processed: processed.length,
        duplicatesMerged: duplicates.length,
        deadlinks: deadlinks.length,
        unreachable: unreachable.length,
        categories: categories.length,
      },
      isTrialMode,
    });

    // Auto-navigate to organized folder
    const folderName = isTrialMode ? 'Trial' : 'Organized';
    await autoNavigateOnCompletion(folderName);

    return true;
  } catch (error) {
    // ... existing error handling ...
    
    sendProgress({
      type: 'error',
      current: state.current,
      total: state.total,
      error: error instanceof Error ? error.message : 'Unknown error',
      isTrialMode,
    });

    // DO NOT auto-navigate on error

    return false;
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
git add src/background/index.ts src/background/index.integration.test.ts
git commit -m "feat: integrate auto-navigate with completion flow"
```

---

## Phase 3: Frontend - UI (Day 2)

### Task 8: Add Preference Toggle to Popup HTML

**Files:**
- Modify: `src/popup/popup.html`

- [ ] **Step 1: Add preference checkbox UI**

Add to `src/popup/popup.html` (after the organize button):

```html
<div class="preferences-section">
  <label class="preference-toggle">
    <input type="checkbox" id="autoNavigateCheckbox" checked />
    <span class="toggle-label">
      <span class="toggle-title">Auto-navigate to folder</span>
      <span class="toggle-description">
        Automatically open bookmarks manager after completion
      </span>
    </span>
  </label>
</div>
```

- [ ] **Step 2: Verify HTML is valid**

Run: No automated test for HTML validity
Manual check: Ensure HTML renders correctly in browser

- [ ] **Step 3: Commit**

```bash
git add src/popup/popup.html
git commit -m "feat: add auto-navigate preference checkbox to popup"
```

---

### Task 9: Style Preference Toggle

**Files:**
- Modify: `src/popup/styles.css`

- [ ] **Step 1: Add CSS styles**

Add to `src/popup/styles.css`:

```css
/* Preference Section */
.preferences-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
}

.preference-toggle {
  display: flex;
  align-items: flex-start;
  cursor: pointer;
  user-select: none;
}

.preference-toggle input[type="checkbox"] {
  margin-top: 3px;
  margin-right: 8px;
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.toggle-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toggle-title {
  font-size: 13px;
  font-weight: 500;
  color: #333;
}

.toggle-description {
  font-size: 11px;
  color: #666;
  line-height: 1.4;
}

/* Disabled state */
.preference-toggle.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.preference-toggle.disabled input[type="checkbox"] {
  cursor: not-allowed;
}
```

- [ ] **Step 2: Verify styles render correctly**

Run: No automated test for CSS
Manual check: Ensure styles look good in popup

- [ ] **Step 3: Commit**

```bash
git add src/popup/styles.css
git commit -m "feat: add styles for auto-navigate preference toggle"
```

---

### Task 10: Implement Preference Loading in Popup

**Files:**
- Modify: `src/popup/index.ts`
- Modify: `src/popup/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/popup/index.test.ts`:

```typescript
describe('loadUserPreferences', () => {
  it('loads preferences and sets checkbox state', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      userPreferences: { autoNavigate: false },
    });

    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: mockGet,
        },
      },
    });

    // Create mock checkbox
    document.body.innerHTML = `
      <input type="checkbox" id="autoNavigateCheckbox" checked />
    `;

    const { loadUserPreferences } = await import('../popup/index');
    await loadUserPreferences();

    const checkbox = document.getElementById('autoNavigateCheckbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    vi.unstubAllGlobals();
  });

  it('defaults to checked when no preferences stored', async () => {
    const mockGet = vi.fn().mockResolvedValue({});

    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: mockGet,
        },
      },
    });

    document.body.innerHTML = `
      <input type="checkbox" id="autoNavigateCheckbox" />
    `;

    const { loadUserPreferences } = await import('../popup/index');
    await loadUserPreferences();

    const checkbox = document.getElementById('autoNavigateCheckbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);  // Default is true

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/popup/index.test.ts`
Expected: FAIL with "loadUserPreferences is not defined"

- [ ] **Step 3: Write minimal implementation**

Add to `src/popup/index.ts`:

```typescript
import type { UserPreferences } from '../types';

/**
 * Load user preferences and update UI
 */
export async function loadUserPreferences(): Promise<void> {
  try {
    const result = await chrome.storage.sync.get('userPreferences');
    const prefs: UserPreferences = result.userPreferences || {};
    
    // Get checkbox element
    const checkbox = document.getElementById('autoNavigateCheckbox') as HTMLInputElement;
    
    if (checkbox) {
      // Default to true if not explicitly set
      checkbox.checked = prefs.autoNavigate !== false;
    }
  } catch (error) {
    console.error('Failed to load user preferences:', error);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/popup/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/popup/index.ts src/popup/index.test.ts
git commit -m "feat: implement loadUserPreferences in popup"
```

---

### Task 11: Implement Preference Saving in Popup

**Files:**
- Modify: `src/popup/index.ts`
- Modify: `src/popup/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/popup/index.test.ts`:

```typescript
describe('saveUserPreferences', () => {
  it('saves preferences to Chrome storage', async () => {
    const mockSet = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          set: mockSet,
        },
      },
    });

    const { saveUserPreferences } = await import('../popup/index');
    await saveUserPreferences({ autoNavigate: false });

    expect(mockSet).toHaveBeenCalledWith({
      userPreferences: { autoNavigate: false },
    });

    vi.unstubAllGlobals();
  });

  it('saves enabled preference', async () => {
    const mockSet = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          set: mockSet,
        },
      },
    });

    const { saveUserPreferences } = await import('../popup/index');
    await saveUserPreferences({ autoNavigate: true });

    expect(mockSet).toHaveBeenCalledWith({
      userPreferences: { autoNavigate: true },
    });

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/popup/index.test.ts`
Expected: FAIL with "saveUserPreferences is not defined"

- [ ] **Step 3: Write minimal implementation**

Add to `src/popup/index.ts`:

```typescript
/**
 * Save user preferences to Chrome storage
 */
export async function saveUserPreferences(
  prefs: UserPreferences
): Promise<void> {
  try {
    await chrome.storage.sync.set({ userPreferences: prefs });
    console.log('Saved user preferences:', prefs);
  } catch (error) {
    console.error('Failed to save user preferences:', error);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/popup/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/popup/index.ts src/popup/index.test.ts
git commit -m "feat: implement saveUserPreferences in popup"
```

---

### Task 12: Wire Checkbox to Preference Functions

**Files:**
- Modify: `src/popup/index.ts`
- Modify: `src/popup/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/popup/index.test.ts`:

```typescript
describe('autoNavigateCheckbox event handler', () => {
  it('saves preference when checkbox is toggled', async () => {
    const mockSet = vi.fn().mockResolvedValue(undefined);

    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({}),
          set: mockSet,
        },
      },
    });

    document.body.innerHTML = `
      <input type="checkbox" id="autoNavigateCheckbox" checked />
    `;

    const { initializePopup } = await import('../popup/index');
    await initializePopup();

    // Simulate checkbox toggle
    const checkbox = document.getElementById('autoNavigateCheckbox') as HTMLInputElement;
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change'));

    // Wait for async save
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockSet).toHaveBeenCalledWith({
      userPreferences: { autoNavigate: false },
    });

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/popup/index.test.ts`
Expected: FAIL with "mockSet not called" or event handler not registered

- [ ] **Step 3: Write minimal implementation**

Modify `src/popup/index.ts`:

Add event listener setup to `initializePopup` function:

```typescript
/**
 * Initialize popup UI and event listeners
 */
export async function initializePopup(): Promise<void> {
  // Load current preferences
  await loadUserPreferences();

  // Setup auto-navigate checkbox listener
  const autoNavigateCheckbox = document.getElementById('autoNavigateCheckbox') as HTMLInputElement;
  
  if (autoNavigateCheckbox) {
    autoNavigateCheckbox.addEventListener('change', async () => {
      await saveUserPreferences({
        autoNavigate: autoNavigateCheckbox.checked,
      });
    });
  }

  // ... existing initialization code ...
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/popup/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/popup/index.ts src/popup/index.test.ts
git commit -m "feat: wire auto-navigate checkbox to preference functions"
```

---

### Task 13: Call loadUserPreferences on Popup Init

**Files:**
- Modify: `src/popup/index.ts`
- Modify: `src/popup/index.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/popup/index.integration.test.ts`:

```typescript
describe('popup initialization loads preferences', () => {
  it('calls loadUserPreferences on DOMContentLoaded', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      userPreferences: { autoNavigate: false },
    });

    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: mockGet,
        },
      },
      runtime: {
        sendMessage: vi.fn(),
        getURL: vi.fn().mockReturnValue(''),
      },
    });

    document.body.innerHTML = `
      <input type="checkbox" id="autoNavigateCheckbox" checked />
    `;

    // Import popup module (triggers DOMContentLoaded listener)
    await import('../popup/index');

    // Simulate DOMContentLoaded
    document.dispatchEvent(new Event('DOMContentLoaded'));

    // Wait for async load
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(mockGet).toHaveBeenCalledWith('userPreferences');

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/popup/index.integration.test.ts`
Expected: FAIL if loadUserPreferences not called on init

- [ ] **Step 3: Write minimal implementation**

Ensure `src/popup/index.ts` has DOMContentLoaded listener:

```typescript
// At the bottom of src/popup/index.ts

document.addEventListener('DOMContentLoaded', async () => {
  await initializePopup();
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/popup/index.integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/popup/index.ts src/popup/index.integration.test.ts
git commit -m "feat: load user preferences on popup initialization"
```

---

## Phase 4: Testing & Polish (Day 2)

### Task 14: Write End-to-End Integration Test

**Files:**
- Modify: `src/background/index.integration.test.ts`

- [ ] **Step 1: Write comprehensive integration test**

Add to `src/background/index.integration.test.ts`:

```typescript
describe('auto-navigate feature end-to-end', () => {
  it('completes full workflow: organize → navigate with preference enabled', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'tab-1' });
    const mockGetTree = vi.fn().mockResolvedValue([{
      id: '0',
      title: 'Root',
      children: [{
        id: '1',
        title: 'Other Bookmarks',
        children: [
          { id: 'folder-123', title: '📁Organized' },
        ],
      }],
    }]);

    vi.stubGlobal('chrome', {
      bookmarks: {
        getTree: mockGetTree,
        create: vi.fn().mockResolvedValue({ id: 'new-folder' }),
        removeTree: vi.fn(),
      },
      runtime: {
        sendMessage: vi.fn(),
        lastError: null,
      },
      tabs: {
        create: mockCreate,
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({
            userPreferences: { autoNavigate: true },
          }),
        },
      },
    });

    vi.mock('../modules/fetcher', () => ({
      fetchBookmark: vi.fn(async (b) => ({ 
        ...b, 
        status: 'ok', 
        meta: {}, 
        headings: [] 
      })),
    }));

    const { runOrganization, resetState } = await import('../background/index');
    resetState();
    
    const result = await runOrganization();

    expect(result).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith({
      url: 'chrome://bookmarks/#folder-123',
    });

    vi.unstubAllGlobals();
  });

  it('completes organization but skips navigate when preference disabled', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'tab-1' });

    vi.stubGlobal('chrome', {
      bookmarks: {
        getTree: vi.fn().mockResolvedValue([{
          id: '0',
          title: 'Root',
          children: [],
        }]),
        create: vi.fn().mockResolvedValue({ id: 'new-folder' }),
        removeTree: vi.fn(),
      },
      runtime: {
        sendMessage: vi.fn(),
        lastError: null,
      },
      tabs: {
        create: mockCreate,
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({
            userPreferences: { autoNavigate: false },
          }),
        },
      },
    });

    vi.mock('../modules/fetcher', () => ({
      fetchBookmark: vi.fn(async (b) => ({ 
        ...b, 
        status: 'ok', 
        meta: {}, 
        headings: [] 
      })),
    }));

    const { runOrganization, resetState } = await import('../background/index');
    resetState();
    
    const result = await runOrganization();

    expect(result).toBe(true);
    expect(mockCreate).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('works with trial mode folders', async () => {
    const mockCreate = vi.fn().mockResolvedValue({ id: 'tab-1' });
    const mockGetTree = vi.fn().mockResolvedValue([{
      id: '0',
      title: 'Root',
      children: [{
        id: '1',
        title: 'Other Bookmarks',
        children: [
          { id: 'trial-folder', title: '🧪Trial' },
        ],
      }],
    }]);

    vi.stubGlobal('chrome', {
      bookmarks: {
        getTree: mockGetTree,
        create: vi.fn().mockResolvedValue({ id: 'new-folder' }),
        removeTree: vi.fn(),
      },
      runtime: {
        sendMessage: vi.fn(),
        lastError: null,
      },
      tabs: {
        create: mockCreate,
      },
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({
            userPreferences: { autoNavigate: true },
          }),
        },
      },
    });

    vi.mock('../modules/fetcher', () => ({
      fetchBookmark: vi.fn(async (b) => ({ 
        ...b, 
        status: 'ok', 
        meta: {}, 
        headings: [] 
      })),
    }));

    const { runOrganization, resetState } = await import('../background/index');
    resetState();
    
    const result = await runOrganization({ maxBookmarks: 5 });

    expect(result).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith({
      url: 'chrome://bookmarks/#trial-folder',
    });

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm test src/background/index.integration.test.ts`
Expected: PASS (all integration tests should pass)

- [ ] **Step 3: Commit**

```bash
git add src/background/index.integration.test.ts
git commit -m "test: add comprehensive auto-navigate integration tests"
```

---

### Task 15: Run Full Test Suite

**Files:**
- None (verification task)

- [ ] **Step 1: Run all tests**

Run: `pnpm test`

Expected: All tests PASS

- [ ] **Step 2: Run tests with coverage**

Run: `pnpm test:coverage`

Expected: 95%+ coverage maintained

- [ ] **Step 3: Verify no regressions**

Check that all existing tests still pass and no functionality is broken.

---

### Task 16: Manual Testing

**Files:**
- None (manual verification)

- [ ] **Step 1: Load extension in Chrome**

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the extension build folder

- [ ] **Step 2: Test auto-navigate enabled (default)**

1. Open extension popup
2. Verify "Auto-navigate to folder" checkbox is checked
3. Click "Organize Bookmarks"
4. Wait for completion
5. Verify Chrome Bookmarks Manager opens
6. Verify it navigates to/highlights the organized folder

- [ ] **Step 3: Test auto-navigate disabled**

1. Open extension popup
2. Uncheck "Auto-navigate to folder" checkbox
3. Click "Organize Bookmarks"
4. Wait for completion
5. Verify Chrome Bookmarks Manager does NOT open
6. Verify success message still shows

- [ ] **Step 4: Test trial mode navigation**

1. Enter "25" in trial mode input
2. Verify "Auto-navigate to folder" checkbox is checked
3. Click "Run Trial"
4. Wait for completion
5. Verify Chrome Bookmarks Manager opens
6. Verify it navigates to/highlights the Trial folder

- [ ] **Step 5: Test preference persistence**

1. Open extension popup
2. Uncheck "Auto-navigate to folder"
3. Close popup
4. Reopen popup
5. Verify checkbox is still unchecked

---

### Task 17: Update Documentation

**Files:**
- Modify: `README.md` (if exists)
- Modify: `USAGE.md`

- [ ] **Step 1: Update USAGE.md**

Add section about auto-navigate feature:

```markdown
## Auto-navigate to Organized Folder

After successful organization, the extension can automatically open Chrome's
Bookmarks Manager and navigate to the organized folder for immediate review.

### How It Works

1. When organization completes, Chrome Bookmarks Manager opens
2. The manager navigates to and highlights the organized folder
3. Works for both full runs (`📁Organized/`) and trial runs (`🧪Trial/`)

### Enabling/Disabling

1. Open the extension popup
2. Check or uncheck "Auto-navigate to folder"
3. The preference is saved automatically
4. Default: Enabled

### Notes

- If the organized folder cannot be found, a success message is shown instead
- The feature works only on successful completion, not on errors
- Preference is synced across Chrome instances (if Chrome sync is enabled)
```

- [ ] **Step 2: Commit**

```bash
git add USAGE.md
git commit -m "docs: add auto-navigate feature documentation"
```

---

## Phase 5: Final Verification & Merge

### Task 18: Final Code Review

- [ ] **Step 1: Review all modified files**

Check:
- Type definitions are correct and complete
- All functions have proper error handling
- UI is user-friendly and accessible
- Tests cover all code paths
- No console.log statements in production code (except for debugging)

- [ ] **Step 2: Verify build succeeds**

Run: `pnpm build`

Expected: Build completes without errors

- [ ] **Step 3: Verify production build**

Run: `pnpm build`
Load unpacked extension in Chrome
Verify all functionality works

---

### Task 19: Create Pull Request

- [ ] **Step 1: Push branch**

```bash
git push -u origin feature/auto-navigate
```

- [ ] **Step 2: Create PR**

Create pull request with:
- Title: "feat: Auto-navigate to organized folder"
- Body:
  - Summary of changes
  - Test coverage
  - Manual testing results
  - Screenshots (if applicable)

---

## Summary

**Total Tasks:** 19
**Estimated Time:** 2 days

**Phase 1 (Day 1):** Backend core logic (6 tasks)
- Types and interfaces
- Preference loading
- Folder finding
- Navigation functions

**Phase 2 (Day 1):** Backend integration (1 task)
- Integrate with completion flow

**Phase 3 (Day 2):** Frontend UI (6 tasks)
- Preference toggle UI
- Preference loading/saving
- Event handling

**Phase 4 (Day 2):** Testing & polish (4 tasks)
- Integration tests
- Manual testing
- Documentation

**Phase 5 (Day 2):** Final verification (2 tasks)
- Code review
- PR creation

**Key Design Decisions:**
- Default behavior: auto-navigate enabled
- URL fragment approach for navigation (`chrome://bookmarks/#<folder-id>`)
- Graceful fallback if folder not found
- Preference synced across Chrome instances
- Works for both trial and full mode folders
- Only navigates on successful completion, not on errors

**Testing Strategy:**
- Unit tests for all new functions
- Integration tests for completion flow
- End-to-end tests for full workflow
- Manual testing for UI behavior
