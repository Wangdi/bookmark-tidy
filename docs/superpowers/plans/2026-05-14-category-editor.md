# Category Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add interactive category tree editor to preview and modify categories before organizing bookmarks.

**Architecture:** Intermediate state between categorization and organization phases, category editor UI component with tree view, IndexedDB storage for edited structure, basic edit operations (rename, merge, delete).

**Tech Stack:** TypeScript, Vitest, Chrome Extensions API, IndexedDB

---

## File Structure

**New files:**
- None (all changes to existing files)

**Modified files:**
- `src/types/index.ts` - Add `EditedCategory` and `CategoryEditAction` types
- `src/background/index.ts` - Add category editor state and message handlers
- `src/background/index.test.ts` - Unit tests for category editor logic
- `src/background/index.integration.test.ts` - Integration tests for editor workflow
- `src/lib/storage.ts` - Add storage methods for edited categories
- `src/lib/storage.test.ts` - Tests for category storage
- `src/modules/organizer.ts` - Accept edited category structure
- `src/modules/organizer.test.ts` - Tests for edited structure handling
- `src/popup/popup.html` - Add category editor UI
- `src/popup/styles.css` - Style category editor
- `src/popup/index.ts` - Add category editor logic
- `src/popup/index.test.ts` - Unit tests for editor UI
- `src/popup/index.integration.test.ts` - Integration tests for editor workflow

---

## Phase 1: Backend - Types and Storage (Day 1)

### Task 1: Add Category Editor Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Write the failing test**

Create test in `src/background/index.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('Category editor types', () => {
  it('accepts EditedCategory with name and bookmarks', () => {
    const category: import('../types').EditedCategory = {
      id: 'cat-1',
      name: 'Development',
      bookmarkIds: ['bm-1', 'bm-2', 'bm-3'],
    };
    expect(category.name).toBe('Development');
    expect(category.bookmarkIds).toHaveLength(3);
  });

  it('accepts CategoryEditAction for rename', () => {
    const action: import('../types').CategoryEditAction = {
      type: 'rename',
      categoryId: 'cat-1',
      newName: 'Programming',
    };
    expect(action.type).toBe('rename');
  });

  it('accepts CategoryEditAction for merge', () => {
    const action: import('../types').CategoryEditAction = {
      type: 'merge',
      sourceCategoryId: 'cat-1',
      targetCategoryId: 'cat-2',
    };
    expect(action.type).toBe('merge');
  });

  it('accepts CategoryEditAction for delete', () => {
    const action: import('../types').CategoryEditAction = {
      type: 'delete',
      categoryId: 'cat-1',
    };
    expect(action.type).toBe('delete');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.test.ts`
Expected: FAIL with "Cannot find namespace 'EditedCategory'"

- [ ] **Step 3: Write minimal implementation**

Add to `src/types/index.ts`:

```typescript
export interface EditedCategory {
  id: string;
  name: string;
  bookmarkIds: string[];
}

export type CategoryEditAction =
  | { type: 'rename'; categoryId: string; newName: string }
  | { type: 'merge'; sourceCategoryId: string; targetCategoryId: string }
  | { type: 'delete'; categoryId: string };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/background/index.test.ts
git commit -m "feat: add EditedCategory and CategoryEditAction types"
```

---

### Task 2: Add Category Structure to ProgressEvent

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.test.ts`:

```typescript
describe('ProgressEvent category structure', () => {
  it('includes categories in progress event', () => {
    const event: import('../types').ProgressEvent = {
      type: 'progress',
      current: 50,
      total: 100,
      categories: [
        { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1', 'bm-2'] },
        { id: 'cat-2', name: 'News', bookmarkIds: ['bm-3'] },
      ],
    };
    expect(event.categories).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.test.ts`
Expected: FAIL with "Property 'categories' does not exist"

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
  isTrialMode?: boolean;
  categories?: EditedCategory[];  // NEW: category structure for editor
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/background/index.test.ts
git commit -m "feat: add categories field to ProgressEvent"
```

---

### Task 3: Add Storage Methods for Edited Categories

**Files:**
- Modify: `src/lib/storage.ts`
- Modify: `src/lib/storage.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/storage.test.ts`:

```typescript
describe('edited categories storage', () => {
  it('stores edited categories', async () => {
    const { saveEditedCategories } = await import('../lib/storage');
    const categories: EditedCategory[] = [
      { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1'] },
    ];
    
    await saveEditedCategories(categories);
    
    const stored = await getEditedCategories();
    expect(stored).toEqual(categories);
  });

  it('returns empty array when no categories stored', async () => {
    const { getEditedCategories } = await import('../lib/storage');
    
    await clearAll();
    
    const stored = await getEditedCategories();
    expect(stored).toEqual([]);
  });

  it('clears edited categories', async () => {
    const { saveEditedCategories, clearEditedCategories, getEditedCategories } = await import('../lib/storage');
    
    await saveEditedCategories([
      { id: 'cat-1', name: 'Test', bookmarkIds: [] },
    ]);
    
    await clearEditedCategories();
    
    const stored = await getEditedCategories();
    expect(stored).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/storage.test.ts`
Expected: FAIL with "saveEditedCategories is not defined"

- [ ] **Step 3: Write minimal implementation**

Add to `src/lib/storage.ts`:

```typescript
const EDITED_CATEGORIES_STORE = 'edited-categories';

export async function saveEditedCategories(
  categories: EditedCategory[]
): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(EDITED_CATEGORIES_STORE, 'readwrite');
    const store = transaction.objectStore(EDITED_CATEGORIES_STORE);
    
    // Clear existing and save new
    const clearRequest = store.clear();
    
    clearRequest.onsuccess = () => {
      let completed = 0;
      categories.forEach((category) => {
        const request = store.put(category);
        request.onsuccess = () => {
          completed++;
          if (completed === categories.length) {
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      });
      
      if (categories.length === 0) {
        resolve();
      }
    };
    
    clearRequest.onerror = () => reject(clearRequest.error);
  });
}

export async function getEditedCategories(): Promise<EditedCategory[]> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(EDITED_CATEGORIES_STORE, 'readonly');
    const store = transaction.objectStore(EDITED_CATEGORIES_STORE);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function clearEditedCategories(): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(EDITED_CATEGORIES_STORE, 'readwrite');
    const store = transaction.objectStore(EDITED_CATEGORIES_STORE);
    const request = store.clear();
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
```

Also update `openDB` function to create the new object store:

```typescript
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('bookmark-tidy', 2);  // Increment version
    
    request.onupgradeneeded = (event) => {
      const db = request.result;
      
      if (event.oldVersion < 1) {
        db.createObjectStore('bookmarks', { keyPath: 'id' });
        db.createObjectStore('checkpoints', { keyPath: 'id' });
      }
      
      if (event.oldVersion < 2) {
        db.createObjectStore(EDITED_CATEGORIES_STORE, { keyPath: 'id' });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/storage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts
git commit -m "feat: add storage methods for edited categories"
```

---

## Phase 2: Backend - Category Editor Logic (Day 1 continued)

### Task 4: Implement applyCategoryEdit Function

**Files:**
- Modify: `src/background/index.ts`
- Modify: `src/background/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.test.ts`:

```typescript
describe('applyCategoryEdit', () => {
  const createCategory = (id: string, name: string, bookmarkIds: string[] = []): EditedCategory => ({
    id,
    name,
    bookmarkIds,
  });

  it('renames category', async () => {
    const { applyCategoryEdit } = await import('../background/index');
    const categories = [
      createCategory('cat-1', 'Development', ['bm-1']),
      createCategory('cat-2', 'News', ['bm-2']),
    ];
    
    const result = applyCategoryEdit(categories, {
      type: 'rename',
      categoryId: 'cat-1',
      newName: 'Programming',
    });
    
    expect(result[0].name).toBe('Programming');
    expect(result[1].name).toBe('News');
  });

  it('merges two categories', async () => {
    const { applyCategoryEdit } = await import('../background/index');
    const categories = [
      createCategory('cat-1', 'Development', ['bm-1', 'bm-2']),
      createCategory('cat-2', 'Programming', ['bm-3']),
    ];
    
    const result = applyCategoryEdit(categories, {
      type: 'merge',
      sourceCategoryId: 'cat-1',
      targetCategoryId: 'cat-2',
    });
    
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cat-2');
    expect(result[0].bookmarkIds).toEqual(['bm-3', 'bm-1', 'bm-2']);
  });

  it('deletes category and moves bookmarks to Uncategorized', async () => {
    const { applyCategoryEdit } = await import('../background/index');
    const categories = [
      createCategory('cat-1', 'Development', ['bm-1', 'bm-2']),
      createCategory('cat-2', 'News', ['bm-3']),
    ];
    
    const result = applyCategoryEdit(categories, {
      type: 'delete',
      categoryId: 'cat-1',
    });
    
    expect(result).toHaveLength(2);
    expect(result.find(c => c.id === 'cat-1')).toBeUndefined();
    const uncategorized = result.find(c => c.name === 'Uncategorized');
    expect(uncategorized?.bookmarkIds).toEqual(['bm-1', 'bm-2']);
  });

  it('throws error for invalid category ID', async () => {
    const { applyCategoryEdit } = await import('../background/index');
    const categories = [createCategory('cat-1', 'Test', [])];
    
    expect(() => applyCategoryEdit(categories, {
      type: 'rename',
      categoryId: 'invalid',
      newName: 'New',
    })).toThrow('Category not found');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.test.ts`
Expected: FAIL with "applyCategoryEdit is not defined"

- [ ] **Step 3: Write minimal implementation**

Add to `src/background/index.ts`:

```typescript
/**
 * Apply a category edit action
 */
export function applyCategoryEdit(
  categories: EditedCategory[],
  action: CategoryEditAction
): EditedCategory[] {
  switch (action.type) {
    case 'rename': {
      const category = categories.find(c => c.id === action.categoryId);
      if (!category) throw new Error('Category not found');
      
      return categories.map(c =>
        c.id === action.categoryId ? { ...c, name: action.newName } : c
      );
    }
    
    case 'merge': {
      const source = categories.find(c => c.id === action.sourceCategoryId);
      const target = categories.find(c => c.id === action.targetCategoryId);
      
      if (!source || !target) throw new Error('Category not found');
      
      return categories
        .filter(c => c.id !== action.sourceCategoryId)
        .map(c =>
          c.id === action.targetCategoryId
            ? { ...c, bookmarkIds: [...c.bookmarkIds, ...source.bookmarkIds] }
            : c
        );
    }
    
    case 'delete': {
      const category = categories.find(c => c.id === action.categoryId);
      if (!category) throw new Error('Category not found');
      
      // Move bookmarks to Uncategorized
      const uncategorized = categories.find(c => c.name === 'Uncategorized');
      const bookmarkIds = category.bookmarkIds;
      
      let result = categories.filter(c => c.id !== action.categoryId);
      
      if (bookmarkIds.length > 0) {
        if (uncategorized) {
          result = result.map(c =>
            c.name === 'Uncategorized'
              ? { ...c, bookmarkIds: [...c.bookmarkIds, ...bookmarkIds] }
              : c
          );
        } else {
          result.push({
            id: 'uncategorized',
            name: 'Uncategorized',
            bookmarkIds,
          });
        }
      }
      
      return result;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/background/index.ts src/background/index.test.ts
git commit -m "feat: implement applyCategoryEdit for rename, merge, delete"
```

---

### Task 5: Modify runOrganization for Category Editor

**Files:**
- Modify: `src/background/index.ts`
- Modify: `src/background/index.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.integration.test.ts`:

```typescript
describe('runOrganization category editor', () => {
  it('sends categories after categorization phase', async () => {
    const mockSendMessage = vi.fn();
    
    vi.stubGlobal('chrome', {
      bookmarks: {
        getTree: vi.fn().mockResolvedValue([{
          id: '0',
          title: 'Root',
          children: Array(10).fill(null).map((_, i) => ({
            id: `${i}`,
            title: `Bookmark ${i}`,
            url: `https://example${i}.com`,
          })),
        }]),
        create: vi.fn(),
        removeTree: vi.fn(),
      },
      runtime: { sendMessage: mockSendMessage, lastError: null },
    });

    vi.mock('../modules/fetcher', () => ({
      fetchBookmark: vi.fn(async (b) => ({
        ...b,
        status: 'ok',
        meta: { title: b.title },
        headings: [],
      })),
    }));

    vi.mock('../modules/categorizer', () => ({
      categorizeBookmarks: vi.fn(() => [
        { id: 'cat-1', name: 'Development', bookmarkIds: ['0', '1', '2'] },
        { id: 'cat-2', name: 'News', bookmarkIds: ['3', '4'] },
      ]),
    }));

    const { runOrganization, resetState } = await import('../background/index');
    resetState();
    
    await runOrganization();

    // Should send categories in progress message
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'progress',
        categories: expect.arrayContaining([
          expect.objectContaining({ name: 'Development' }),
          expect.objectContaining({ name: 'News' }),
        ]),
      })
    );

    vi.unstubAllGlobals();
  });

  it('uses edited categories if available', async () => {
    const mockOrganize = vi.fn();
    
    vi.mock('../modules/organizer', () => ({
      organizeBookmarks: mockOrganize,
      clearOrganizedFolder: vi.fn(),
    }));

    vi.mock('../lib/storage', () => ({
      getEditedCategories: vi.fn(() => [
        { id: 'cat-1', name: 'Edited Category', bookmarkIds: ['0', '1'] },
      ]),
      clearEditedCategories: vi.fn(),
    }));

    const { runOrganization, resetState } = await import('../background/index');
    resetState();
    
    await runOrganization();

    // Should use edited categories
    expect(mockOrganize).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ category: 'Edited Category' }),
      ]),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.integration.test.ts`
Expected: FAIL with "categories not sent" or "edited categories not used"

- [ ] **Step 3: Write minimal implementation**

Modify `src/background/index.ts`:

Find the `runOrganization` function and update the categorization phase:

```typescript
export async function runOrganization(
  options?: OrganizationOptions
): Promise<boolean> {
  // ... existing early returns ...

  state.isRunning = true;
  state.shouldAbort = false;

  try {
    // ... fetch and dedupe phases ...

    // Categorization phase
    const categorized = categorizeBookmarks(deduped);
    
    // Convert to EditedCategory format
    const categories: EditedCategory[] = categorized.map(c => ({
      id: c.category,
      name: c.category,
      bookmarkIds: c.bookmarks.map(b => b.id),
    }));
    
    // Send categories to UI for editing
    sendProgress({
      type: 'progress',
      current: state.current,
      total: state.total,
      currentUrl: 'Categories generated - waiting for review',
      categories,
    });
    
    // Wait for user edits (poll storage)
    let editedCategories = await getEditedCategories();
    const maxWaitTime = 300000; // 5 minutes
    const startTime = Date.now();
    
    while (editedCategories.length === 0 && Date.now() - startTime < maxWaitTime) {
      if (state.shouldAbort) {
        throw new Error('Operation cancelled');
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      editedCategories = await getEditedCategories();
    }
    
    // Use edited categories if available, otherwise use original
    const finalCategories = editedCategories.length > 0 ? editedCategories : categories;
    
    // Convert back to CategorizedBookmark format for organizer
    const finalCategorized = finalCategories.flatMap(cat =>
      cat.bookmarkIds.map(id => {
        const bookmark = deduped.find(b => b.id === id);
        return bookmark ? { ...bookmark, category: cat.name } : null;
      }).filter(Boolean) as CategorizedBookmark[]
    );
    
    // Clear edited categories
    await clearEditedCategories();
    
    // Organization phase
    const folderName = state.isTrialMode ? 'Trial' : 'Organized';
    await organizeBookmarks(finalCategorized, deadlinks, unreachable, folderName);

    // ... completion handling ...
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/background/index.ts src/background/index.integration.test.ts
git commit -m "feat: add category editor support to runOrganization"
```

---

### Task 6: Add Message Handlers for Category Editor

**Files:**
- Modify: `src/background/index.ts`
- Modify: `src/background/index.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.integration.test.ts`:

```typescript
describe('handleMessage category editor', () => {
  it('handles APPLY_CATEGORY_EDIT message', async () => {
    const mockSaveEditedCategories = vi.fn();
    
    vi.mock('../lib/storage', () => ({
      saveEditedCategories: mockSaveEditedCategories,
    }));

    const { handleMessage } = await import('../background/index');
    
    const sendResponse = vi.fn();
    handleMessage(
      {
        type: 'APPLY_CATEGORY_EDIT',
        categories: [
          { id: 'cat-1', name: 'Edited', bookmarkIds: ['bm-1'] },
        ],
      },
      {},
      sendResponse
    );

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockSaveEditedCategories).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Edited' }),
      ])
    );

    vi.unstubAllGlobals();
  });

  it('handles REGENERATE_CATEGORIES message', async () => {
    const mockClearEditedCategories = vi.fn();
    
    vi.mock('../lib/storage', () => ({
      clearEditedCategories: mockClearEditedCategories,
    }));

    const { handleMessage, state } = await import('../background/index');
    state.shouldAbort = false;
    
    const sendResponse = vi.fn();
    handleMessage({ type: 'REGENERATE_CATEGORIES' }, {}, sendResponse);

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(state.shouldAbort).toBe(true);
    expect(mockClearEditedCategories).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.integration.test.ts`
Expected: FAIL with "APPLY_CATEGORY_EDIT not handled"

- [ ] **Step 3: Write minimal implementation**

Modify `src/background/index.ts`:

Find the `handleMessage` function and add new cases:

```typescript
export function handleMessage(
  message: { type: string; maxBookmarks?: number; categories?: EditedCategory[] },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean {
  if (message.type === "START_ORGANIZE") {
    // ... existing code ...
  }
  
  if (message.type === "CANCEL") {
    // ... existing code ...
  }
  
  if (message.type === "RESET") {
    // ... existing code ...
  }
  
  // NEW: Apply category edits
  if (message.type === "APPLY_CATEGORY_EDIT") {
    saveEditedCategories(message.categories!).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  // NEW: Regenerate categories
  if (message.type === "REGENERATE_CATEGORIES") {
    state.shouldAbort = true;
    clearEditedCategories().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/background/index.ts src/background/index.integration.test.ts
git commit -m "feat: add message handlers for category editor"
```

---

## Phase 3: Frontend - UI (Day 2)

### Task 7: Add Category Editor UI to Popup HTML

**Files:**
- Modify: `src/popup/popup.html`

- [ ] **Step 1: Add category editor UI**

Modify `src/popup/popup.html`:

Add new state div after complete-state:

```html
    <!-- Category Editor State -->
    <div id="editor-state" class="state hidden">
      <h2>Category Preview</h2>
      <p class="editor-help">Review and edit categories before organizing</p>
      
      <div id="category-tree" class="category-tree">
        <!-- Categories will be rendered here -->
      </div>
      
      <div class="editor-actions">
        <button id="regenerate-btn" class="btn btn-secondary">
          🔄 Regenerate
        </button>
        <button id="apply-btn" class="btn btn-primary">
          ✅ Apply Changes
        </button>
      </div>
    </div>
```

Add category item template (hidden, used for cloning):

```html
    <!-- Category Item Template -->
    <template id="category-template">
      <div class="category-item">
        <div class="category-header">
          <span class="category-name"></span>
          <span class="category-count"></span>
        </div>
        <div class="category-actions">
          <button class="btn-edit" title="Rename">✏️</button>
          <button class="btn-merge" title="Merge">🔀</button>
          <button class="btn-delete" title="Delete">🗑️</button>
        </div>
      </div>
    </template>
```

- [ ] **Step 2: Commit**

```bash
git add src/popup/popup.html
git commit -m "feat: add category editor UI to popup"
```

---

### Task 8: Style Category Editor

**Files:**
- Modify: `src/popup/styles.css`

- [ ] **Step 1: Add category editor styles**

Add to `src/popup/styles.css`:

```css
/* Category Editor Styles */
.category-tree {
  margin: 16px 0;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--border-color, #ddd);
  border-radius: 8px;
  padding: 8px;
}

.category-item {
  padding: 12px;
  margin-bottom: 8px;
  background: var(--bg-secondary, #f5f5f5);
  border-radius: 6px;
  transition: background 0.2s;
}

.category-item:hover {
  background: var(--bg-hover, #e8e8e8);
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.category-name {
  font-weight: 600;
  font-size: 14px;
}

.category-count {
  font-size: 12px;
  color: var(--text-secondary, #666);
  background: var(--bg-primary, #fff);
  padding: 2px 8px;
  border-radius: 12px;
}

.category-actions {
  display: flex;
  gap: 8px;
}

.category-actions button {
  padding: 4px 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  border-radius: 4px;
  transition: background 0.2s;
}

.category-actions button:hover {
  background: var(--bg-hover, #e8e8e8);
}

.editor-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 16px;
}

.editor-help {
  font-size: 13px;
  color: var(--text-secondary, #666);
  font-style: italic;
  margin-bottom: 12px;
}

.btn-secondary {
  background: var(--bg-secondary, #f5f5f5);
  color: var(--text-primary, #333);
}

.btn-secondary:hover {
  background: var(--bg-hover, #e8e8e8);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/popup/styles.css
git commit -m "feat: add styles for category editor"
```

---

### Task 9: Add Category Editor Elements to PopupElements

**Files:**
- Modify: `src/popup/index.ts`
- Modify: `src/popup/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/popup/index.test.ts`:

```typescript
describe('category editor elements', () => {
  it('includes editor elements in PopupElements', () => {
    const { PopupElements } = await import('../popup/index');
    const elements: PopupElements = {
      // ... existing elements ...
      editorState: createMockElement() as HTMLElement,
      categoryTree: createMockElement() as HTMLElement,
      regenerateBtn: createMockElement() as HTMLButtonElement,
      applyBtn: createMockElement() as HTMLButtonElement,
    };
    expect(elements.editorState).toBeDefined();
    expect(elements.categoryTree).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/popup/index.test.ts`
Expected: FAIL with "Property 'editorState' does not exist"

- [ ] **Step 3: Write minimal implementation**

Modify `src/popup/index.ts`:

1. Update `PopupElements` interface:

```typescript
export interface PopupElements {
  idleState: HTMLElement;
  processingState: HTMLElement;
  completeState: HTMLElement;
  errorState: HTMLElement;
  editorState: HTMLElement;  // NEW
  startBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
  doneBtn: HTMLButtonElement;
  retryBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;
  regenerateBtn: HTMLButtonElement;  // NEW
  applyBtn: HTMLButtonElement;  // NEW
  bookmarkCount: HTMLElement;
  progressBar: HTMLElement;
  progressText: HTMLElement;
  currentUrl: HTMLElement;
  progressCount: HTMLElement;
  resultsList: HTMLElement;
  errorMessage: HTMLElement;
  trialCount: HTMLInputElement;
  categoryTree: HTMLElement;  // NEW
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
      editorState: document.getElementById('editor-state')!,  // NEW
      startBtn: document.getElementById('start-btn')! as HTMLButtonElement,
      cancelBtn: document.getElementById('cancel-btn')! as HTMLButtonElement,
      doneBtn: document.getElementById('done-btn')! as HTMLButtonElement,
      retryBtn: document.getElementById('retry-btn')! as HTMLButtonElement,
      resetBtn: document.getElementById('reset-btn')! as HTMLButtonElement,
      regenerateBtn: document.getElementById('regenerate-btn')! as HTMLButtonElement,  // NEW
      applyBtn: document.getElementById('apply-btn')! as HTMLButtonElement,  // NEW
      bookmarkCount: document.getElementById('bookmark-count')!,
      progressBar: document.getElementById('progress-bar')!,
      progressText: document.getElementById('progress-text')!,
      currentUrl: document.getElementById('current-url')!,
      progressCount: document.getElementById('progress-count')!,
      resultsList: document.getElementById('results-list')!,
      errorMessage: document.getElementById('error-message')!,
      trialCount: document.getElementById('trial-count')! as HTMLInputElement,
      categoryTree: document.getElementById('category-tree')!,  // NEW
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
git commit -m "feat: add category editor elements to PopupElements"
```

---

### Task 10: Implement renderCategoryTree Function

**Files:**
- Modify: `src/popup/index.ts`
- Modify: `src/popup/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/popup/index.test.ts`:

```typescript
describe('renderCategoryTree', () => {
  it('renders categories with bookmark counts', async () => {
    const { renderCategoryTree, setElements } = await import('../popup/index');
    setElements(mockElements);
    
    const categories: EditedCategory[] = [
      { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1', 'bm-2', 'bm-3'] },
      { id: 'cat-2', name: 'News', bookmarkIds: ['bm-4'] },
    ];
    
    renderCategoryTree(categories);
    
    const items = mockElements.categoryTree.querySelectorAll('.category-item');
    expect(items).toHaveLength(2);
    
    const firstItem = items[0];
    expect(firstItem.querySelector('.category-name')?.textContent).toBe('Development');
    expect(firstItem.querySelector('.category-count')?.textContent).toBe('3');
  });

  it('clears existing categories before rendering', async () => {
    const { renderCategoryTree, setElements } = await import('../popup/index');
    setElements(mockElements);
    
    // Add existing item
    mockElements.categoryTree.innerHTML = '<div class="category-item">Old</div>';
    
    renderCategoryTree([
      { id: 'cat-1', name: 'New', bookmarkIds: [] },
    ]);
    
    const items = mockElements.categoryTree.querySelectorAll('.category-item');
    expect(items).toHaveLength(1);
    expect(items[0].querySelector('.category-name')?.textContent).toBe('New');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/popup/index.test.ts`
Expected: FAIL with "renderCategoryTree is not defined"

- [ ] **Step 3: Write minimal implementation**

Add to `src/popup/index.ts`:

```typescript
/**
 * Render category tree in editor
 */
export function renderCategoryTree(categories: EditedCategory[]): void {
  const els = getElements();
  
  // Clear existing
  els.categoryTree.innerHTML = '';
  
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/popup/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/popup/index.ts src/popup/index.test.ts
git commit -m "feat: implement renderCategoryTree function"
```

---

### Task 11: Implement Category Edit Handlers

**Files:**
- Modify: `src/popup/index.ts`
- Modify: `src/popup/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/popup/index.test.ts`:

```typescript
describe('category edit handlers', () => {
  it('handleRenameCategory prompts for new name', async () => {
    const { handleRenameCategory, setCategories, getCategories } = await import('../popup/index');
    
    vi.stubGlobal('prompt', vi.fn().mockReturnValue('Programming'));
    
    setCategories([
      { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1'] },
    ]);
    
    handleRenameCategory('cat-1');
    
    const categories = getCategories();
    expect(categories[0].name).toBe('Programming');
    
    vi.unstubAllGlobals();
  });

  it('handleDeleteCategory moves bookmarks to Uncategorized', async () => {
    const { handleDeleteCategory, setCategories, getCategories } = await import('../popup/index');
    
    setCategories([
      { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1', 'bm-2'] },
      { id: 'cat-2', name: 'News', bookmarkIds: ['bm-3'] },
    ]);
    
    handleDeleteCategory('cat-1');
    
    const categories = getCategories();
    expect(categories).toHaveLength(2);
    
    const uncategorized = categories.find(c => c.name === 'Uncategorized');
    expect(uncategorized?.bookmarkIds).toEqual(['bm-1', 'bm-2']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/popup/index.test.ts`
Expected: FAIL with "handleRenameCategory is not defined"

- [ ] **Step 3: Write minimal implementation**

Add to `src/popup/index.ts`:

```typescript
// Category state
let currentCategories: EditedCategory[] = [];

export function setCategories(categories: EditedCategory[]): void {
  currentCategories = categories;
}

export function getCategories(): EditedCategory[] {
  return currentCategories;
}

/**
 * Handle rename category
 */
export function handleRenameCategory(categoryId: string): void {
  const category = currentCategories.find(c => c.id === categoryId);
  if (!category) return;
  
  const newName = prompt('Enter new category name:', category.name);
  if (!newName || newName.trim() === '') return;
  
  currentCategories = currentCategories.map(c =>
    c.id === categoryId ? { ...c, name: newName.trim() } : c
  );
  
  renderCategoryTree(currentCategories);
}

/**
 * Handle merge category
 */
export function handleMergeCategory(sourceId: string): void {
  const source = currentCategories.find(c => c.id === sourceId);
  if (!source) return;
  
  // Get target category (exclude source)
  const targets = currentCategories.filter(c => c.id !== sourceId);
  if (targets.length === 0) {
    alert('No other categories to merge with');
    return;
  }
  
  const targetNames = targets.map(t => t.name).join(', ');
  const targetName = prompt(`Merge "${source.name}" into which category?\n\nAvailable: ${targetNames}`);
  if (!targetName) return;
  
  const target = targets.find(t => t.name.toLowerCase() === targetName.toLowerCase());
  if (!target) {
    alert('Category not found');
    return;
  }
  
  // Merge
  currentCategories = currentCategories
    .filter(c => c.id !== sourceId)
    .map(c =>
      c.id === target.id
        ? { ...c, bookmarkIds: [...c.bookmarkIds, ...source.bookmarkIds] }
        : c
    );
  
  renderCategoryTree(currentCategories);
}

/**
 * Handle delete category
 */
export function handleDeleteCategory(categoryId: string): void {
  const category = currentCategories.find(c => c.id === categoryId);
  if (!category) return;
  
  if (!confirm(`Delete "${category.name}"? Bookmarks will be moved to Uncategorized.`)) {
    return;
  }
  
  // Delete and move to Uncategorized
  const bookmarkIds = category.bookmarkIds;
  let result = currentCategories.filter(c => c.id !== categoryId);
  
  if (bookmarkIds.length > 0) {
    const uncategorized = result.find(c => c.name === 'Uncategorized');
    if (uncategorized) {
      result = result.map(c =>
        c.name === 'Uncategorized'
          ? { ...c, bookmarkIds: [...c.bookmarkIds, ...bookmarkIds] }
          : c
      );
    } else {
      result.push({
        id: 'uncategorized',
        name: 'Uncategorized',
        bookmarkIds,
      });
    }
  }
  
  currentCategories = result;
  renderCategoryTree(currentCategories);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/popup/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/popup/index.ts src/popup/index.test.ts
git commit -m "feat: implement category edit handlers (rename, merge, delete)"
```

---

### Task 12: Update handleProgressMessage for Category Editor

**Files:**
- Modify: `src/popup/index.ts`
- Modify: `src/popup/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/popup/index.test.ts`:

```typescript
describe('handleProgressMessage category editor', () => {
  it('shows editor state when categories received', async () => {
    const { handleProgressMessage, setElements } = await import('../popup/index');
    setElements(mockElements);
    
    const message: ProgressEvent = {
      type: 'progress',
      current: 50,
      total: 100,
      currentUrl: 'Categories generated',
      categories: [
        { id: 'cat-1', name: 'Development', bookmarkIds: ['bm-1'] },
      ],
    };
    
    handleProgressMessage(message);
    
    expect(mockElements.editorState.classList.contains('hidden')).toBe(false);
    expect(mockElements.processingState.classList.contains('hidden')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/popup/index.test.ts`
Expected: FAIL with "editor state not shown"

- [ ] **Step 3: Write minimal implementation**

Modify `src/popup/index.ts`:

Find the `handleProgressMessage` function and update:

```typescript
export function handleProgressMessage(message: ProgressEvent): boolean {
  if (message.type === 'progress') {
    // Check if categories are available (show editor)
    if (message.categories && message.categories.length > 0) {
      showState('editor');
      setCategories(message.categories);
      renderCategoryTree(message.categories);
      return true;
    }
    
    // Normal progress update
    updateProgress(message.current, message.total, message.currentUrl);

    if (message.isTrialMode) {
      const els = getElements();
      els.progressCount.textContent = `Trial: ${message.current} of ${message.total}`;
    }

    return true;
  } else if (message.type === 'complete') {
    // ... existing code ...
  } else if (message.type === 'error') {
    // ... existing code ...
  }
  return false;
}
```

Also update `showState` function:

```typescript
export function showState(state: 'idle' | 'processing' | 'complete' | 'error' | 'editor'): void {
  const els = getElements();
  
  els.idleState.classList.toggle('hidden', state !== 'idle');
  els.processingState.classList.toggle('hidden', state !== 'processing');
  els.completeState.classList.toggle('hidden', state !== 'complete');
  els.errorState.classList.toggle('hidden', state !== 'error');
  els.editorState.classList.toggle('hidden', state !== 'editor');  // NEW
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/popup/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/popup/index.ts src/popup/index.test.ts
git commit -m "feat: show category editor when categories received"
```

---

### Task 13: Implement Apply and Regenerate Buttons

**Files:**
- Modify: `src/popup/index.ts`
- Modify: `src/popup/index.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/popup/index.integration.test.ts`:

```typescript
describe('apply and regenerate buttons', () => {
  it('apply button sends edited categories', async () => {
    const mockSendMessage = vi.fn().mockResolvedValue({ success: true });
    
    vi.stubGlobal('chrome', {
      runtime: { sendMessage: mockSendMessage, onMessage: { addListener: vi.fn() } },
    });

    const { initPopup, setElements, setCategories } = await import('../popup/index');
    setElements(mockElements);
    setCategories([
      { id: 'cat-1', name: 'Edited', bookmarkIds: ['bm-1'] },
    ]);
    
    initPopup();
    
    mockElements.applyBtn.click();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'APPLY_CATEGORY_EDIT',
        categories: expect.arrayContaining([
          expect.objectContaining({ name: 'Edited' }),
        ]),
      })
    );

    vi.unstubAllGlobals();
  });

  it('regenerate button sends regenerate message', async () => {
    const mockSendMessage = vi.fn().mockResolvedValue({ success: true });
    
    vi.stubGlobal('chrome', {
      runtime: { sendMessage: mockSendMessage, onMessage: { addListener: vi.fn() } },
    });

    const { initPopup, setElements } = await import('../popup/index');
    setElements(mockElements);
    
    initPopup();
    
    mockElements.regenerateBtn.click();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'REGENERATE_CATEGORIES' })
    );

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/popup/index.integration.test.ts`
Expected: FAIL with "APPLY_CATEGORY_EDIT not sent"

- [ ] **Step 3: Write minimal implementation**

Modify `src/popup/index.ts`:

Find the `initPopup` function and add button handlers:

```typescript
export function initPopup(): void {
  const els = getElements();
  
  // ... existing button handlers ...
  
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
      showStatusMessage(`❌ Failed to apply changes: ${error}`, 3000);
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
      showStatusMessage(`❌ Failed to regenerate: ${error}`, 3000);
    }
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/popup/index.integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/popup/index.ts src/popup/index.integration.test.ts
git commit -m "feat: implement apply and regenerate button handlers"
```

---

## Phase 4: Testing & Documentation (Day 3)

### Task 14: Run Full Test Suite

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

### Task 15: Update Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `USAGE.md`

- [ ] **Step 1: Update CLAUDE.md**

Add to Features table:

```markdown
| **Category editor** | Preview and edit categories before organizing |
```

- [ ] **Step 2: Update USAGE.md**

Add section:

```markdown
## Category Preview and Editing

After categorization completes, you can review and edit the generated categories:

1. **Review Categories**: Browse the category tree showing all generated categories
2. **Rename**: Click ✏️ to rename a category
3. **Merge**: Click 🔀 to merge two categories
4. **Delete**: Click 🗑️ to delete a category (bookmarks move to "Uncategorized")
5. **Apply Changes**: Click "Apply Changes" to proceed with organization
6. **Regenerate**: Click "Regenerate" to re-run categorization

### Editing Operations

- **Rename**: Changes the category name for all bookmarks in that category
- **Merge**: Combines two categories, moving all bookmarks from source to target
- **Delete**: Removes the category and moves bookmarks to "Uncategorized"

Note: Complex operations like drag-drop and undo/redo are not supported to keep the interface simple.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md USAGE.md
git commit -m "docs: update documentation for category editor"
```

---

## Summary

**Total Tasks:** 15
**Estimated Time:** 3 days

**Phase 1:** Backend types and storage (Tasks 1-3) - Day 1 morning
**Phase 2:** Backend logic (Tasks 4-6) - Day 1 afternoon
**Phase 3:** Frontend UI (Tasks 7-13) - Day 2
**Phase 4:** Testing and docs (Tasks 14-15) - Day 3

**Key Features:**
- ✅ Category tree preview after categorization
- ✅ Rename, merge, delete operations
- ✅ Apply Changes and Regenerate buttons
- ✅ IndexedDB storage for edited structure
- ✅ Basic editing only (no drag-drop, undo/redo)

**Testing Strategy:**
- Unit tests for all edit operations
- Integration tests for workflow
- TDD approach throughout
- 95%+ coverage target
