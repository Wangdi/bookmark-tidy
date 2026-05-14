# Trial Mode Feature - Design Specification

**Date:** 2026-05-14
**Status:** Draft
**Priority:** High
**Estimated Effort:** 2-3 days

---

## Overview

Add a trial mode that allows users to organize a random subset of N bookmarks before processing their entire collection. This provides a quick way to test the workflow, validate categorization quality, and see results without committing to processing thousands of bookmarks.

## User Stories

1. **As a user**, I want to test the bookmark organization with a small subset first, so I can verify the categorization quality before processing all bookmarks.
2. **As a user**, I want to specify how many bookmarks to include in the trial, so I can control the scope of the test.
3. **As a user**, I want trial results in a separate folder, so I don't confuse them with my final organized bookmarks.

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | User can enter a number N to process only N bookmarks | Must |
| FR-2 | Random selection of N bookmarks from total pool | Must |
| FR-3 | Trial results go to `🧪Trial/` folder | Must |
| FR-4 | Full mode results go to `📁Organized/` folder (existing) | Must |
| FR-5 | Input validation: 1 ≤ N ≤ total bookmark count | Must |
| FR-6 | Empty input processes all bookmarks (existing behavior) | Must |
| FR-7 | Progress shows "Trial mode: X of Y bookmarks" | Should |
| FR-8 | Reset clears both `📁Trial/` and `📁Organized/` folders | Must |

### Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-1 | Random selection uses Fisher-Yates shuffle for uniform distribution | Must |
| NFR-2 | Trial mode has no performance impact on full mode | Must |
| NFR-3 | UI remains responsive during random selection | Must |
| NFR-4 | Clear visual distinction between trial and full mode | Should |

---

## Design

### Architecture

**Components affected:**
1. `src/popup/index.ts` - Add trial input UI and validation
2. `src/popup/popup.html` - Add trial input field
3. `src/popup/styles.css` - Style trial input group
4. `src/background/index.ts` - Add trial mode logic and folder selection
5. `src/modules/organizer.ts` - Support custom folder name
6. `src/types/index.ts` - Add OrganizationOptions interface

**Data flow:**
```
Popup (user input)
  ↓ validate trial count
  ↓ send START_ORGANIZE { maxBookmarks?: number }
Background
  ↓ get all bookmarks
  ↓ if maxBookmarks: shuffle & slice
  ↓ process subset
  ↓ create in 📁Trial/ or 📁Organized/
  ↓ send progress with trial flag
Popup
  ↓ display "Trial mode: X of Y"
```

### UI Design

**Idle State (popup.html):**
```html
<div id="idle-state" class="state">
  <h1>📚 Bookmark Tidy</h1>
  <p class="status-text">Ready to organize bookmarks</p>
  
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
  
  <button id="start-btn" class="btn primary">Organize Bookmarks</button>
  <p id="bookmark-count" class="count-text"></p>
  <div class="divider"></div>
  <button id="reset-btn" class="btn danger">Clear All Data</button>
</div>
```

**Processing State (progress text):**
- Trial mode: `"Trial mode: Processing 25 of 1000 bookmarks"`
- Full mode: `"Processing bookmarks..."` (existing)

**Complete State (results):**
- Trial mode: Shows `"Trial results in 📁Trial/ folder"`
- Full mode: Shows `"Check 📁Organized folder"` (existing)

**Styles (styles.css):**
```css
.trial-input-group {
  margin: 16px 0;
  padding: 12px;
  background: var(--bg-secondary);
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
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 14px;
}

.trial-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.trial-hint {
  color: var(--text-secondary);
  font-size: 13px;
}

.trial-help {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  font-style: italic;
}
```

### Backend Implementation

**1. New Types (types/index.ts):**
```typescript
export interface OrganizationOptions {
  maxBookmarks?: number;  // undefined = all, number = trial mode
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
  isTrialMode?: boolean;  // NEW: flag for trial mode
}
```

**2. Random Selection (background/index.ts):**
```typescript
/**
 * Fisher-Yates shuffle for uniform random selection
 */
function shuffleArray<T>(array: T[]): T[] {
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
function selectRandomBookmarks(
  bookmarks: RawBookmark[], 
  count: number
): RawBookmark[] {
  if (count >= bookmarks.length) {
    return bookmarks;
  }
  return shuffleArray(bookmarks).slice(0, count);
}
```

**3. Modified runOrganization (background/index.ts):**
```typescript
export async function runOrganization(
  options?: OrganizationOptions
): Promise<boolean> {
  // ... existing state checks ...
  
  const tree = await chrome.bookmarks.getTree();
  let bookmarks = extractBookmarksFromTree(tree);
  const totalCount = bookmarks.length;
  
  // Apply trial mode filter
  const isTrialMode = options?.maxBookmarks !== undefined;
  if (isTrialMode && options.maxBookmarks! < bookmarks.length) {
    bookmarks = selectRandomBookmarks(bookmarks, options.maxBookmarks!);
  }
  
  state.total = bookmarks.length;
  state.isTrialMode = isTrialMode;  // Track trial mode
  
  // Update progress message
  if (isTrialMode) {
    sendProgress({
      type: 'progress',
      current: 0,
      total: bookmarks.length,
      currentUrl: `Trial mode: Processing ${bookmarks.length} of ${totalCount} bookmarks`,
      isTrialMode: true,
    });
  }
  
  // ... rest of processing ...
  
  // Pass folder name to organizer
  const folderName = isTrialMode ? 'Trial' : 'Organized';
  await organizeBookmarks(categorized, deadlinks, unreachable, folderName);
  
  // ... completion handling ...
}
```

**4. Modified organizeBookmarks (modules/organizer.ts):**
```typescript
export async function organizeBookmarks(
  bookmarks: CategorizedBookmark[],
  deadlinks: ProcessedBookmark[],
  unreachable: ProcessedBookmark[],
  folderName: string = 'Organized'  // NEW: configurable folder name
): Promise<void> {
  // Delete existing folder
  await clearOrganizedFolder(folderName);
  
  // Create new folder with custom name
  const emoji = folderName === 'Trial' ? '🧪' : '📁';
  const folder = await createFolder(`${emoji}${folderName}/`);
  
  // ... rest of organization ...
}

export async function clearOrganizedFolder(
  folderName: string = 'Organized'
): Promise<void> {
  // ... find and remove folder with matching name ...
}
```

**5. Modified resetStorage (background/index.ts):**
```typescript
export async function resetStorage(): Promise<void> {
  // ... existing cancel logic ...
  
  await clearAll();
  
  // Clear both folders
  await clearOrganizedFolder('Organized');
  await clearOrganizedFolder('Trial');
}
```

**6. Message handler (background/index.ts):**
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
  // ... existing handlers ...
}
```

### Frontend Implementation

**1. Popup Elements (popup/index.ts):**
```typescript
export interface PopupElements {
  // ... existing elements ...
  trialCount: HTMLInputElement;  // NEW
  trialHelp: HTMLElement;        // NEW
}

export function getElements(): PopupElements {
  if (!elements) {
    elements = {
      // ... existing elements ...
      trialCount: document.getElementById('trial-count')! as HTMLInputElement,
      trialHelp: document.getElementById('trial-help')!,
    };
  }
  return elements;
}
```

**2. Validation (popup/index.ts):**
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

**3. Modified startOrganization (popup/index.ts):**
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
  
  const message = trialCount !== null
    ? { type: 'START_ORGANIZE', maxBookmarks: trialCount }
    : { type: 'START_ORGANIZE' };
  
  const response = await chrome.runtime.sendMessage(message);
  
  if (response && response.started === false) {
    showState('idle');
    const count = await getBookmarkCount();
    els.bookmarkCount.textContent = `${count} bookmarks found`;
  }
}
```

**4. Modified handleProgressMessage (popup/index.ts):**
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
  } 
  else if (message.type === 'complete') {
    showResults(message.stats);
    showState('complete');
    
    // Update completion message for trial mode
    if (message.isTrialMode) {
      const els = getElements();
      const folderHint = document.querySelector('.folder-hint');
      if (folderHint) {
        folderHint.textContent = 'Check 🧪Trial folder';
      }
    }
    
    return true;
  }
  // ... existing handlers ...
}
```

---

## Error Handling

| Scenario | Behavior | User Message |
|----------|----------|--------------|
| Invalid input (negative) | Validation fails, don't start | "❌ Minimum 1 bookmark" |
| Invalid input (zero) | Validation fails, don't start | "❌ Minimum 1 bookmark" |
| Input > total count | Validation fails, don't start | "❌ Cannot exceed X bookmarks" |
| Non-numeric input | Browser validation prevents | N/A |
| Empty input | Process all bookmarks | (existing behavior) |
| Trial mode fails | Same error handling as full mode | (existing error messages) |

---

## Testing Strategy

### Unit Tests

**1. shuffleArray() tests (background/index.test.ts):**
```typescript
describe('shuffleArray', () => {
  it('returns array of same length', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(shuffleArray(arr)).toHaveLength(5);
  });

  it('contains all original elements', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray(arr);
    expect(shuffled.sort()).toEqual(arr.sort());
  });

  it('does not modify original array', () => {
    const arr = [1, 2, 3, 4, 5];
    const original = [...arr];
    shuffleArray(arr);
    expect(arr).toEqual(original);
  });

  it('produces different orders on multiple calls', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const results = new Set();
    
    for (let i = 0; i < 100; i++) {
      results.add(shuffleArray(arr).join(','));
    }
    
    expect(results.size).toBeGreaterThan(1);
  });
});
```

**2. selectRandomBookmarks() tests (background/index.test.ts):**
```typescript
describe('selectRandomBookmarks', () => {
  it('returns all bookmarks when count >= total', () => {
    const bookmarks = [bm1, bm2, bm3];
    expect(selectRandomBookmarks(bookmarks, 5)).toHaveLength(3);
  });

  it('returns exactly N bookmarks', () => {
    const bookmarks = [bm1, bm2, bm3, bm4, bm5];
    expect(selectRandomBookmarks(bookmarks, 3)).toHaveLength(3);
  });

  it('returns subset of original bookmarks', () => {
    const bookmarks = [bm1, bm2, bm3, bm4, bm5];
    const selected = selectRandomBookmarks(bookmarks, 3);
    selected.forEach(b => expect(bookmarks).toContainEqual(b));
  });
});
```

**3. validateTrialCount() tests (popup/index.test.ts):**
```typescript
describe('validateTrialCount', () => {
  it('accepts null (process all)', () => {
    expect(validateTrialCount(null, 100)).toEqual({ valid: true });
  });

  it('accepts valid count', () => {
    expect(validateTrialCount(50, 100)).toEqual({ valid: true });
  });

  it('rejects count < 1', () => {
    expect(validateTrialCount(0, 100)).toEqual({
      valid: false,
      error: 'Minimum 1 bookmark'
    });
  });

  it('rejects count > total', () => {
    expect(validateTrialCount(150, 100)).toEqual({
      valid: false,
      error: 'Cannot exceed 100 bookmarks'
    });
  });
});
```

### Integration Tests

**1. Trial mode workflow (background/index.integration.test.ts):**
```typescript
it('processes only N bookmarks in trial mode', async () => {
  // Setup 100 bookmarks
  mockGetTree.mockResolvedValueOnce([createTreeWith(100)]);
  
  // Start with maxBookmarks: 25
  await runOrganization({ maxBookmarks: 25 });
  
  // Should process only 25
  expect(fetchBookmark).toHaveBeenCalledTimes(25);
  expect(state.total).toBe(25);
});

it('creates Trial folder in trial mode', async () => {
  await runOrganization({ maxBookmarks: 10 });
  
  expect(mockCreate).toHaveBeenCalledWith(
    expect.objectContaining({ title: '🧪Trial' })
  );
});

it('creates Organized folder in full mode', async () => {
  await runOrganization();  // No options
  
  expect(mockCreate).toHaveBeenCalledWith(
    expect.objectContaining({ title: '📁Organized' })
  );
});
```

**2. Popup validation (popup/index.integration.test.ts):**
```typescript
it('shows error for invalid trial count', async () => {
  mockElements.trialCount.value = '0';
  
  await startOrganization();
  
  expect(mockElements.bookmarkCount.textContent).toContain('Minimum 1 bookmark');
  expect(mockSendMessage).not.toHaveBeenCalled();
});

it('sends maxBookmarks when trial count is set', async () => {
  mockElements.trialCount.value = '25';
  mockGetTree.mockResolvedValueOnce([createTreeWith(100)]);
  
  await startOrganization();
  
  expect(mockSendMessage).toHaveBeenCalledWith(
    expect.objectContaining({ maxBookmarks: 25 })
  );
});
```

### E2E Tests

**1. Full trial workflow:**
- User enters 25 in trial input
- Clicks "Organize Bookmarks"
- Sees "Trial mode: Processing 25 of 1000"
- Waits for completion
- Sees "Check 🧪Trial folder"
- Verifies folder contains ~25 bookmarks

**2. Reset clears both folders:**
- Run trial mode
- Run full mode
- Click "Clear All Data"
- Verify both folders are deleted

---

## Migration Path

**Phase 1: Backend (Day 1)**
1. Add `OrganizationOptions` interface to types
2. Implement `shuffleArray()` and `selectRandomBookmarks()`
3. Modify `runOrganization()` to accept options
4. Modify `organizeBookmarks()` to accept folder name
5. Update `resetStorage()` to clear both folders
6. Add unit tests

**Phase 2: Frontend (Day 2)**
1. Add trial input UI to popup.html
2. Add styles to styles.css
3. Implement `validateTrialCount()` and `getTrialCount()`
4. Modify `startOrganization()` to send options
5. Update progress/completion messages
6. Add unit tests

**Phase 3: Integration (Day 3)**
1. Add integration tests
2. Manual testing with various scenarios
3. Update documentation
4. Code review and refinement

---

## Success Criteria

- [ ] User can enter a number and process only that many bookmarks
- [ ] Random selection is uniform (verified by statistical tests)
- [ ] Results appear in `🧪Trial/` folder
- [ ] Progress shows "Trial mode: X of Y"
- [ ] Completion message references correct folder
- [ ] Reset clears both `📁Trial/` and `📁Organized/`
- [ ] Empty input processes all bookmarks (existing behavior)
- [ ] Invalid input shows error and prevents start
- [ ] All tests pass (280+ existing + new tests)
- [ ] No performance regression for full mode

---

## Open Questions

1. **Should trial mode preserve the random seed?**
   - Pro: Reproducible results for debugging
   - Con: Adds complexity, not user-facing
   - **Decision:** No, use true random for simplicity

2. **Should trial folder have timestamp?**
   - Pro: Multiple trial runs preserved
   - Con: Clutters bookmark tree
   - **Decision:** No, single `🧪Trial/` folder (overwrite each run)

3. **Should we show which bookmarks were selected?**
   - Pro: Transparency
   - Con: UI complexity
   - **Decision:** No, not in MVP. Could be future enhancement.

---

## Future Enhancements

1. **Trial history:** Keep multiple trial runs with timestamps
2. **Bookmark preview:** Show which N bookmarks were selected
3. **Smart sampling:** Stratified sampling to ensure category diversity
4. **Trial comparison:** Compare trial vs full results
5. **Folder selection:** Trial mode on specific folder only

---

## References

- [Fisher-Yates Shuffle](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle)
- [SPEC.md](../../SPEC.md) - Technical specification
- [CLAUDE.md](../../CLAUDE.md) - Architecture overview
