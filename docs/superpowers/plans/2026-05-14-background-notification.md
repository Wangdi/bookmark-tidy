# Background Notification - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Chrome notifications when organization job completes, only when popup is not focused.

**Architecture:** Use Chrome notifications API, track popup focus state, send notification on terminal job states (complete/error), store user preferences in Chrome storage sync.

**Tech Stack:** TypeScript, Vitest, Chrome Extensions API (notifications, storage)

**Branch:** feature/background-notification

---

## File Structure

**New files:**
- None (all changes to existing files)

**Modified files:**
- `manifest.json` - Add "notifications" permission
- `src/types/index.ts` - Add NotificationOptions type
- `src/background/index.ts` - Add notification logic and focus tracking
- `src/background/index.test.ts` - Unit tests for notification functions
- `src/background/index.integration.test.ts` - Integration tests for notification workflow
- `src/popup/index.ts` - Track focus state, update notification preferences
- `src/popup/index.test.ts` - Tests for focus tracking
- `src/popup/popup.html` - Add notification toggle UI
- `src/popup/styles.css` - Style notification toggle

---

## Phase 1: Backend - Core Logic

### Task 1: Add Notifications Permission to Manifest

**Files:**
- Modify: `manifest.json`

- [ ] **Step 1: Add notifications permission**

Modify `manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Bookmark Tidy",
  "version": "1.0.0",
  "description": "Organize and tidy up your Chrome bookmarks",
  "permissions": ["bookmarks", "notifications"],
  ...
}
```

- [ ] **Step 2: Commit**

```bash
git add manifest.json
git commit -m "feat: add notifications permission to manifest"
```

---

### Task 2: Add NotificationOptions Type

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/background/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.test.ts`:

```typescript
describe('NotificationOptions type', () => {
  it('accepts enabled flag', () => {
    const options: import('../types').NotificationOptions = { enabled: true };
    expect(options.enabled).toBe(true);
  });

  it('accepts undefined enabled for default', () => {
    const options: import('../types').NotificationOptions = {};
    expect(options.enabled).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.test.ts`
Expected: FAIL with "Cannot find namespace 'NotificationOptions'"

- [ ] **Step 3: Write minimal implementation**

Add to `src/types/index.ts`:

```typescript
export interface NotificationOptions {
  enabled?: boolean;  // default: true
}

export interface NotificationPayload {
  type: 'success' | 'error' | 'cancelled';
  title: string;
  message: string;
  stats?: {
    processed: number;
    categories: number;
    deadlinks: number;
    duplicatesMerged: number;
    unreachable: number;
  };
  error?: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/background/index.test.ts
git commit -m "feat: add NotificationOptions and NotificationPayload types"
```

---

### Task 3: Implement Notification Functions

**Files:**
- Modify: `src/background/index.ts`
- Modify: `src/background/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.test.ts`:

```typescript
import { vi } from 'vitest';

describe('Notification functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isPopupFocused', () => {
    it('returns true when popup is connected', async () => {
      const mockPort = { name: 'popup', disconnected: false };
      vi.spyOn(chrome.runtime, 'connect').mockReturnValue(mockPort as any);
      
      const result = await import('../background/index').then(m => m.isPopupFocused());
      expect(result).toBe(true);
    });

    it('returns false when popup is not connected', async () => {
      vi.spyOn(chrome.runtime, 'connect').mockImplementation(() => {
        throw new Error('No connection');
      });
      
      const result = await import('../background/index').then(m => m.isPopupFocused());
      expect(result).toBe(false);
    });
  });

  describe('sendNotification', () => {
    it('creates notification with correct options', async () => {
      const mockCreate = vi.fn().mockResolvedValue('notification-id');
      vi.spyOn(chrome.notifications, 'create').mockImplementation(mockCreate);
      
      const payload = {
        type: 'success' as const,
        title: 'Organization Complete',
        message: 'Processed 100 bookmarks',
      };
      
      await import('../background/index').then(m => m.sendNotification(payload));
      
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'basic',
          title: 'Organization Complete',
          message: 'Processed 100 bookmarks',
          iconUrl: 'icons/icon128.png',
        })
      );
    });

    it('includes stats in notification message', async () => {
      const mockCreate = vi.fn().mockResolvedValue('notification-id');
      vi.spyOn(chrome.notifications, 'create').mockImplementation(mockCreate);
      
      const payload = {
        type: 'success' as const,
        title: 'Organization Complete',
        message: 'Finished',
        stats: {
          processed: 100,
          categories: 15,
          deadlinks: 5,
          duplicatesMerged: 10,
          unreachable: 3,
        },
      };
      
      await import('../background/index').then(m => m.sendNotification(payload));
      
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('100 bookmarks'),
        })
      );
    });
  });

  describe('getNotificationPreferences', () => {
    it('returns default enabled when not set', async () => {
      vi.spyOn(chrome.storage.sync, 'get').mockResolvedValue({});
      
      const result = await import('../background/index').then(m => m.getNotificationPreferences());
      expect(result.enabled).toBe(true);
    });

    it('returns stored preferences', async () => {
      vi.spyOn(chrome.storage.sync, 'get').mockResolvedValue({
        notificationOptions: { enabled: false }
      });
      
      const result = await import('../background/index').then(m => m.getNotificationPreferences());
      expect(result.enabled).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.test.ts`
Expected: FAIL with functions not defined

- [ ] **Step 3: Write minimal implementation**

Add to `src/background/index.ts` (after imports):

```typescript
import { NotificationOptions, NotificationPayload } from '../types';

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/background/index.ts src/background/index.test.ts
git commit -m "feat: implement notification functions with focus detection"
```

---

### Task 4: Integrate Notifications into runOrganization

**Files:**
- Modify: `src/background/index.ts`
- Modify: `src/background/index.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.integration.test.ts`:

```typescript
describe('runOrganization with notifications', () => {
  it('sends notification on completion when popup not focused', async () => {
    // Mock popup as not focused
    vi.spyOn(chrome.runtime, 'connect').mockImplementation(() => {
      throw new Error('No popup');
    });
    
    const mockNotify = vi.fn().mockResolvedValue('notif-id');
    vi.spyOn(chrome.notifications, 'create').mockImplementation(mockNotify);
    
    // ... setup mocks for successful run
    
    await runOrganization();
    
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Bookmark Tidy - Organization Complete',
      })
    );
  });

  it('does not send notification when popup is focused', async () => {
    // Mock popup as focused
    const mockPort = { name: 'popup-check', disconnected: false };
    vi.spyOn(chrome.runtime, 'connect').mockReturnValue(mockPort as any);
    
    const mockNotify = vi.fn().mockResolvedValue('notif-id');
    vi.spyOn(chrome.notifications, 'create').mockImplementation(mockNotify);
    
    await runOrganization();
    
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('does not send notification when disabled', async () => {
    vi.spyOn(chrome.runtime, 'connect').mockImplementation(() => {
      throw new Error('No popup');
    });
    
    vi.spyOn(chrome.storage.sync, 'get').mockResolvedValue({
      notificationOptions: { enabled: false }
    });
    
    const mockNotify = vi.fn().mockResolvedValue('notif-id');
    vi.spyOn(chrome.notifications, 'create').mockImplementation(mockNotify);
    
    await runOrganization();
    
    expect(mockNotify).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.integration.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Modify `src/background/index.ts` in the `runOrganization` function:

Find the completion handling and add:

```typescript
export async function runOrganization(): Promise<boolean> {
  // ... existing code ...

  try {
    // ... existing processing logic ...

    // Completion
    const stats = {
      processed: processedBookmarks.length,
      duplicatesMerged: duplicatesMerged,
      deadlinks: deadlinks.length,
      unreachable: unreachable.length,
      categories: categoryNames.length,
    };

    await sendProgress({
      type: 'complete',
      current: processedBookmarks.length,
      total: processedBookmarks.length,
      stats,
    });

    // Send notification if popup not focused and notifications enabled
    const popupFocused = await isPopupFocused();
    const notificationPrefs = await getNotificationPreferences();
    
    if (!popupFocused && notificationPrefs.enabled !== false) {
      await sendNotification({
        type: 'success',
        title: 'Bookmark Tidy - Organization Complete',
        message: 'Successfully organized your bookmarks!',
        stats,
      });
    }

    return true;
  } catch (error) {
    // Error handling
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await sendProgress({
      type: 'error',
      current: state.current,
      total: state.total,
      error: errorMessage,
    });

    // Send error notification if popup not focused
    const popupFocused = await isPopupFocused();
    const notificationPrefs = await getNotificationPreferences();
    
    if (!popupFocused && notificationPrefs.enabled !== false) {
      await sendNotification({
        type: 'error',
        title: 'Bookmark Tidy - Error',
        message: 'Organization failed',
        error: errorMessage,
      });
    }

    return false;
  } finally {
    state.isRunning = false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/background/index.ts src/background/index.integration.test.ts
git commit -m "feat: integrate notifications into runOrganization pipeline"
```

---

## Phase 2: Frontend - UI and Preferences

### Task 5: Add Notification Toggle to Popup

**Files:**
- Modify: `src/popup/popup.html`
- Modify: `src/popup/styles.css`

- [ ] **Step 1: Add notification toggle UI**

Modify `src/popup/popup.html`, add before the reset button:

```html
    <div class="settings-group">
      <label class="toggle-label">
        <input type="checkbox" id="notification-toggle" checked />
        <span class="toggle-slider"></span>
        <span class="toggle-text">Enable notifications</span>
      </label>
      <p class="settings-hint">Get notified when organization completes</p>
    </div>
    
    <div class="divider"></div>
    <button id="reset-btn" class="btn danger">Clear All Data</button>
```

- [ ] **Step 2: Add toggle styles**

Add to `src/popup/styles.css`:

```css
.settings-group {
  margin: 16px 0;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.toggle-label input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: relative;
  width: 44px;
  height: 24px;
  background-color: var(--border-color, #ddd);
  border-radius: 24px;
  transition: background-color 0.2s;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  border-radius: 50%;
  transition: transform 0.2s;
}

.toggle-label input:checked + .toggle-slider {
  background-color: var(--primary-color, #4285f4);
}

.toggle-label input:checked + .toggle-slider::before {
  transform: translateX(20px);
}

.toggle-text {
  font-size: 14px;
  color: var(--text-primary, #333);
}

.settings-hint {
  margin-top: 4px;
  margin-left: 56px;
  font-size: 12px;
  color: var(--text-secondary, #666);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/popup/popup.html src/popup/styles.css
git commit -m "feat: add notification toggle UI to popup"
```

---

### Task 6: Implement Notification Preference Handling

**Files:**
- Modify: `src/popup/index.ts`
- Modify: `src/popup/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/popup/index.test.ts`:

```typescript
describe('notification preferences', () => {
  it('loads notification preference from storage', async () => {
    vi.spyOn(chrome.storage.sync, 'get').mockResolvedValue({
      notificationOptions: { enabled: false }
    });
    
    const elements = getElements();
    await loadNotificationPreference();
    
    expect(elements.notificationToggle.checked).toBe(false);
  });

  it('defaults to enabled when not set', async () => {
    vi.spyOn(chrome.storage.sync, 'get').mockResolvedValue({});
    
    const elements = getElements();
    await loadNotificationPreference();
    
    expect(elements.notificationToggle.checked).toBe(true);
  });

  it('saves preference on change', async () => {
    const mockSet = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(chrome.storage.sync, 'set').mockImplementation(mockSet);
    
    const elements = getElements();
    elements.notificationToggle.checked = false;
    
    await handleNotificationToggle();
    
    expect(mockSet).toHaveBeenCalledWith({
      notificationOptions: { enabled: false }
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/popup/index.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Add to `src/popup/index.ts`:

1. Update `PopupElements` interface:

```typescript
export interface PopupElements {
  // ... existing elements ...
  notificationToggle: HTMLInputElement;  // NEW
}
```

2. Update `getElements` function:

```typescript
export function getElements(): PopupElements {
  if (!elements) {
    elements = {
      // ... existing elements ...
      notificationToggle: document.getElementById('notification-toggle')! as HTMLInputElement,
    };
  }
  return elements;
}
```

3. Add preference functions:

```typescript
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
```

4. Add event listener in `initializePopup`:

```typescript
export async function initializePopup() {
  const els = getElements();
  
  // ... existing initialization ...
  
  // Load and setup notification preference
  await loadNotificationPreference();
  els.notificationToggle.addEventListener('change', handleNotificationToggle);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/popup/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/popup/index.ts src/popup/index.test.ts
git commit -m "feat: implement notification preference handling in popup"
```

---

### Task 7: Handle Notification Click

**Files:**
- Modify: `src/background/index.ts`
- Modify: `src/background/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.test.ts`:

```typescript
describe('handleNotificationClick', () => {
  it('opens popup when notification clicked', async () => {
    const mockOpen = vi.fn().mockResolvedValue({ id: 'popup-tab' });
    vi.spyOn(chrome.action, 'openPopup').mockImplementation(mockOpen);
    
    await handleNotificationClick('notification-id');
    
    expect(mockOpen).toHaveBeenCalled();
  });

  it('opens bookmarks page as fallback', async () => {
    vi.spyOn(chrome.action, 'openPopup').mockRejectedValue(new Error('Not available'));
    const mockCreate = vi.fn().mockResolvedValue({ id: 'bookmarks-tab' });
    vi.spyOn(chrome.tabs, 'create').mockImplementation(mockCreate);
    
    await handleNotificationClick('notification-id');
    
    expect(mockCreate).toHaveBeenCalledWith({ url: 'chrome://bookmarks/' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.test.ts`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Add to `src/background/index.ts`:

```typescript
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

// Register notification click handler
chrome.notifications.onClicked.addListener(handleNotificationClick);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/background/index.ts src/background/index.test.ts
git commit -m "feat: handle notification click to open popup or bookmarks"
```

---

## Phase 3: Testing & Documentation

### Task 8: Add Integration Tests

**Files:**
- Modify: `src/background/index.integration.test.ts`

- [ ] **Step 1: Add end-to-end notification test**

Add to `src/background/index.integration.test.ts`:

```typescript
describe('notification workflow', () => {
  it('complete workflow: popup closed, notification sent', async () => {
    // Setup: popup not focused
    vi.spyOn(chrome.runtime, 'connect').mockImplementation(() => {
      throw new Error('No popup');
    });
    
    const mockNotify = vi.fn().mockResolvedValue('notif-id');
    vi.spyOn(chrome.notifications, 'create').mockImplementation(mockNotify);
    
    // ... setup successful organization mocks
    
    await runOrganization();
    
    // Verify notification was sent
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Bookmark Tidy - Organization Complete',
        message: expect.stringContaining('Successfully organized'),
      })
    );
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm test src/background/index.integration.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/background/index.integration.test.ts
git commit -m "test: add integration tests for notification workflow"
```

---

### Task 9: Update Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `USAGE.md`

- [ ] **Step 1: Update CLAUDE.md**

Add to Features table:

```markdown
| **Background notifications** | Chrome notifications when job completes (popup not focused) |
```

- [ ] **Step 2: Update USAGE.md**

Add section:

```markdown
## Background Notifications

Get notified when bookmark organization completes, even if you close the popup:

1. **Enable notifications**: Toggle is on by default in the popup
2. **Start organization**: Click "Organize Bookmarks"
3. **Close popup**: Feel free to close the popup and do other work
4. **Get notified**: When complete, you'll see a notification with summary

**Notification shows:**
- Total bookmarks processed
- Categories created
- Deadlinks found
- Duplicates merged

**Preferences:**
- Toggle notifications on/off in the popup
- Setting is saved automatically
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md USAGE.md
git commit -m "docs: update documentation for notification feature"
```

---

### Task 10: Final Verification

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 2: Run tests with coverage**

Run: `pnpm test:coverage`
Expected: Coverage ≥ 95% for modified files

- [ ] **Step 3: Build project**

Run: `pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Manual testing**

1. Load extension in Chrome
2. Enable notifications (should be on by default)
3. Start organization and close popup
4. Wait for completion
5. Verify notification appears
6. Click notification
7. Verify popup or bookmarks page opens
8. Disable notifications
9. Repeat and verify no notification

---

## Success Criteria

- [ ] Notification appears when organization completes (popup not focused)
- [ ] No notification when popup is focused
- [ ] No notification when user disabled notifications
- [ ] Notification shows summary stats
- [ ] Clicking notification opens popup or bookmarks page
- [ ] User can toggle notifications in popup
- [ ] Preference persists across sessions
- [ ] All tests pass
- [ ] No performance regression

---

## Notes

- Use Chrome storage sync for cross-device preference sync
- Notification click handler registered at module load
- Focus detection uses runtime.connect() attempt
- All code follows existing project patterns
