import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  init,
  startOrganization,
  cancelOrganization,
  handleRetry,
  setupEventListeners,
  setupMessageListener,
  setupPopup,
  setElements,
  setCategories,
  getCategories,
  PopupElements,
} from '../popup/index';

// Helper to create mock DOM element
function createMockElement(): HTMLElement {
  return {
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn(),
      toggle: vi.fn(),
    },
    style: {
      width: '',
    },
    textContent: '',
    innerHTML: '',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as HTMLElement;
}

// Helper to create mock button element
function createMockButton(): HTMLButtonElement {
  const listeners: Array<() => void> = [];
  return {
    ...createMockElement(),
    disabled: false,
    addEventListener: vi.fn((_event: string, handler: () => void) => {
      listeners.push(handler);
    }),
    click: () => {
      listeners.forEach(handler => handler());
    },
  } as unknown as HTMLButtonElement;
}

// Helper to create mock input element
function createMockInput(): HTMLInputElement {
  return {
    ...createMockElement(),
    value: '',
    checked: false,
  } as unknown as HTMLInputElement;
}

// Helper to create mock elements
function createMockElements(): PopupElements {
  return {
    idleState: createMockElement(),
    processingState: createMockElement(),
    completeState: createMockElement(),
    errorState: createMockElement(),
    startBtn: createMockButton(),
    cancelBtn: createMockButton(),
    doneBtn: createMockButton(),
    retryBtn: createMockButton(),
    resetBtn: createMockButton(),
    bookmarkCount: createMockElement(),
    progressBar: createMockElement(),
    progressText: createMockElement(),
    currentUrl: createMockElement(),
    progressCount: createMockElement(),
    resultsList: createMockElement(),
    errorMessage: createMockElement(),
    trialCount: createMockInput(),
    trialError: createMockElement(),
    notificationToggle: createMockInput(),
    autoNavigateToggle: createMockInput(),
    detailsToggle: createMockButton(),
    detailsPanel: createMockElement(),
    fetchMetrics: createMockElement(),
    storageMetrics: createMockElement(),
    categorizationMetrics: createMockElement(),
    organizationMetrics: createMockElement(),
    performanceMetrics: createMockElement(),
    editorState: createMockElement(),
    categoryTree: createMockElement(),
    regenerateBtn: createMockButton(),
    applyBtn: createMockButton(),
  };
}

// Mock Chrome APIs
const mockGetTree = vi.fn();
const mockSendMessage = vi.fn();

vi.stubGlobal('chrome', {
  bookmarks: {
    getTree: mockGetTree,
  },
  runtime: {
    sendMessage: mockSendMessage,
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  storage: {
    sync: {
      get: vi.fn().mockResolvedValue({ notificationOptions: { enabled: true } }),
      set: vi.fn().mockResolvedValue(undefined),
    },
  },
});

// Mock window.close
const mockWindowClose = vi.fn();
vi.stubGlobal('window', {
  close: mockWindowClose,
});

describe('popup integration', () => {
  let mockElements: PopupElements;

  beforeEach(() => {
    mockElements = createMockElements();
    setElements(mockElements);
    vi.clearAllMocks();

    // Default mock responses
    mockSendMessage.mockResolvedValue({ isRunning: false });
    mockGetTree.mockResolvedValue([
      {
        id: '0',
        title: 'Root',
        children: [
          { id: '1', title: 'Bookmark 1', url: 'https://example1.com' },
          { id: '2', title: 'Bookmark 2', url: 'https://example2.com' },
        ],
      },
    ]);
  });

  afterEach(() => {
    setElements(null);
    vi.clearAllMocks();
  });

  describe('init', () => {
    it('shows idle state when not running', async () => {
      mockSendMessage.mockResolvedValueOnce({ isRunning: false });

      await init();

      expect(mockElements.idleState.classList.remove).toHaveBeenCalledWith('hidden');
      expect(mockElements.bookmarkCount.textContent).toBe('2 bookmarks found');
    });

    it('shows processing state when running', async () => {
      mockSendMessage.mockResolvedValueOnce({ isRunning: true });

      await init();

      expect(mockElements.processingState.classList.remove).toHaveBeenCalledWith('hidden');
    });

    it('handles empty bookmark tree', async () => {
      mockGetTree.mockResolvedValueOnce([
        {
          id: '0',
          title: 'Root',
          children: [],
        },
      ]);

      await init();

      expect(mockElements.bookmarkCount.textContent).toBe('0 bookmarks found');
    });

    it('sends GET_STATE message', async () => {
      await init();

      expect(mockSendMessage).toHaveBeenCalledWith({ type: 'GET_STATE' });
    });
  });

  describe('startOrganization', () => {
    it('shows processing state and sends start message', async () => {
      await startOrganization();

      expect(mockElements.processingState.classList.remove).toHaveBeenCalledWith('hidden');
      expect(mockElements.progressBar.style.width).toBe('0%');
      expect(mockElements.currentUrl.textContent).toBe('Fetching: Starting...');
      expect(mockSendMessage).toHaveBeenCalledWith({ type: 'START_ORGANIZE' });
    });
  });

  describe('cancelOrganization', () => {
    it('sends cancel message and returns to idle state', async () => {
      await cancelOrganization();

      expect(mockSendMessage).toHaveBeenCalledWith({ type: 'CANCEL' });
      expect(mockElements.idleState.classList.remove).toHaveBeenCalledWith('hidden');
      expect(mockElements.bookmarkCount.textContent).toBe('2 bookmarks found');
    });
  });

  describe('handleRetry', () => {
    it('starts organization', async () => {
      await handleRetry();

      expect(mockElements.processingState.classList.remove).toHaveBeenCalledWith('hidden');
      expect(mockSendMessage).toHaveBeenCalledWith({ type: 'START_ORGANIZE' });
    });
  });

  describe('setupEventListeners', () => {
    it('sets up click handlers on all buttons', () => {
      setupEventListeners();

      expect(mockElements.startBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockElements.cancelBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockElements.doneBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockElements.retryBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockElements.resetBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });
  });

  describe('setupMessageListener', () => {
    it('registers a message listener', () => {
      setupMessageListener();

      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledWith(expect.any(Function));
    });

    it('listener delegates to handleProgressMessage', () => {
      setupMessageListener();

      const listener = (chrome.runtime.onMessage.addListener as ReturnType<typeof vi.fn>).mock.calls[0][0];

      // Test progress message - verify side effect
      listener({ type: 'progress', current: 5, total: 10, currentUrl: 'https://example.com' });
      expect(mockElements.progressBar.style.width).toBe('50%');
    });
  });

  describe('setupPopup', () => {
    it('calls setup functions and init', async () => {
      await setupPopup();

      expect(mockElements.startBtn.addEventListener).toHaveBeenCalled();
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
      // init calls loadNotificationPreference first, then GET_STATE
      expect(chrome.storage.sync.get).toHaveBeenCalledWith('notificationOptions');
      expect(mockSendMessage).toHaveBeenCalledWith({ type: 'GET_STATE' });
    });
  });

  describe('apply and regenerate buttons', () => {
    it('apply button sends edited categories', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue({ success: true });

      vi.stubGlobal('chrome', {
        runtime: {
          sendMessage: mockSendMessage,
          onMessage: { addListener: vi.fn() }
        },
      });

      setElements(mockElements);
      setCategories([
        { id: 'cat-1', name: 'Edited', bookmarkIds: ['bm-1'] },
      ]);

      setupEventListeners();

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
        runtime: {
          sendMessage: mockSendMessage,
          onMessage: { addListener: vi.fn() }
        },
      });

      vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));

      setElements(mockElements);

      setupEventListeners();

      mockElements.regenerateBtn.click();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'REGENERATE_CATEGORIES' })
      );

      vi.unstubAllGlobals();
    });

    it('regenerate button does nothing if user cancels confirm', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue({ success: true });

      vi.stubGlobal('chrome', {
        runtime: {
          sendMessage: mockSendMessage,
          onMessage: { addListener: vi.fn() }
        },
      });

      vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));

      setElements(mockElements);

      setupEventListeners();

      mockElements.regenerateBtn.click();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockSendMessage).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });
});
