# TEST.md - Test Documentation

Test design and coverage for the Bookmark Tidy Chrome extension.

## Running Tests

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- src/lib/storage.test.ts

# 运行测试并生成覆盖率报告
npm test -- --coverage
```

## 测试文件结构

```
src/
├── lib/
│   └── storage.test.ts          # IndexedDB 存储层测试
├── modules/
│   ├── categorizer.test.ts      # 分类器单元测试
│   ├── deduper.test.ts          # 去重模块测试
│   ├── organizer.integration.test.ts  # 组织模块集成测试
│   └── fetcher.test.ts          # 获取器测试
├── background/
│   └── index.integration.test.ts # 后台脚本集成测试
└── popup/
    └── index.test.ts            # 弹出窗口 UI 测试
```

---

## 1. `src/lib/storage.test.ts` - IndexedDB 存储层测试

### 设计思路

使用真实的 IndexedDB 实现（`fake-indexeddb`），而不是复杂的 mock。这样可以：
- 测试真实的 IndexedDB 行为
- 避免 mock 与实际实现不一致
- 代码更简洁

### 测试结构

| 测试组 | 测试内容 |
|--------|----------|
| `storeFetched` | 存储书签到 IndexedDB，覆盖已存在的数据 |
| `loadAllFetched` | 加载所有数据，包括空数据库情况 |
| `getFetchedCount` | 计数功能 |
| `clearFetched` | 清空数据 |
| `saveCheckpoint/loadCheckpoint` | 检查点的保存和加载 |
| `clearAll` | 同时清除两个存储（fetched + checkpoint） |
| `database initialization` | 数据库初始化时创建 object stores |

### 关键代码

```typescript
import 'fake-indexeddb/auto';  // 在 Node.js 中模拟真实 IndexedDB

describe('storage module', () => {
  let storage: typeof import('./storage');

  beforeEach(async () => {
    if (!storage) {
      storage = await import('./storage');
    }
    await storage.clearAll();  // 每个测试前清空数据
  });

  // 测试用例...
});
```

### 设计要点

- **模块复用**：只导入一次模块，避免多次打开数据库连接
- **数据隔离**：每个测试前后调用 `clearAll()` 确保数据隔离
- **真实行为**：使用 `fake-indexeddb` 模拟真实 IndexedDB 行为

---

## 2. `src/modules/categorizer.test.ts` - 分类器测试

### 设计思路

分层测试，从底层函数到顶层 API 逐级验证：

```
tokenize() → buildCorpus() → buildSparseVectors() → kmeansSparse() → categorizeBookmarks()
```

### 测试结构

| 测试组 | 测试内容 |
|--------|----------|
| `buildCorpus` | 语料库构建（标题权重×2、元数据、关键词、标题） |
| `tokenize` | 分词（小写、去标点、过滤短词、过滤停用词） |
| `computeClusterCount` | 聚类数量计算（最小值 3、缩放 √(N/2)、最大值 30） |
| `generateCategoryName` | 类别命名（空输入、唯一首词、非唯一首词、截断） |
| `categorizeBookmarks` | 端到端测试，验证完整分类流程 |
| `buildSparseVectors` | 稀疏向量构建（只存储非零值） |
| `sparseCosineDistance` | 余弦距离计算（相同、正交、部分重叠、空向量） |
| `kmeansSparse` | 稀疏 K-means 聚类（空输入、聚类分组、收敛） |
| `categorizeBookmarksSparse` | 稀疏向量端到端测试 |

### 边界情况测试

```typescript
// 空输入
expect(generateCategoryName([], [])).toBe('Uncategorized');

// 单词不唯一时回退
const allTerms = [['javascript'], ['javascript'], ['python']];
expect(generateCategoryName(['javascript'], allTerms)).toBe('Javascript');

// 超过 50 字符时截断
const longTerm1 = 'a'.repeat(30);
const longTerm2 = 'b'.repeat(30);
const allTerms = [[longTerm1, longTerm2], [longTerm1, 'other']];
const result = generateCategoryName([longTerm1, longTerm2], allTerms);
expect(result.length).toBe(50);
```

### 工厂函数

```typescript
const createBookmark = (
  title: string,
  meta: { description?: string; ogTitle?: string; keywords?: string[] } = {},
  headings: string[] = []
): ProcessedBookmark => ({
  id: Math.random().toString(),
  url: `https://example.com/${Math.random()}`,
  title,
  meta,
  headings,
  status: 'ok',
});
```

---

## 3. `src/modules/deduper.test.ts` - 去重模块测试

### 设计思路

覆盖所有去重场景和标题选择逻辑。

### 测试结构

| 测试组 | 测试内容 |
|--------|----------|
| 基本场景 | 空输入、单个书签 |
| URL 标准化 | 协议不同、www 前缀、尾部斜杠、追踪参数 |
| 标题选择 | URL 样式 vs 非URL 样式、长度比较 |

### 标题选择逻辑测试

```typescript
// 场景 1：一个是 URL 样式，一个不是 → 保留非 URL 样式
it('keeps longer non-URL title when merging', () => {
  const bookmarks = [
    createBookmark('https://example.com', 'https://example.com', '1'),  // URL 样式
    createBookmark('https://example.com', 'Example Site Title', '2'),   // 非 URL 样式
  ];
  const result = dedupeBookmarks(bookmarks);
  expect(result.bookmarks[0].title).toBe('Example Site Title');
});

// 场景 2：都是 URL 样式 → 保留较长的
it('keeps longer title when both look like URLs and second is longer', () => {
  const bookmarks = [
    createBookmark('https://example.com', 'https://example.com/a', '1'),
    createBookmark('https://example.com', 'https://example.com/longer-path', '2'),
  ];
  const result = dedupeBookmarks(bookmarks);
  expect(result.bookmarks[0].title).toBe('https://example.com/longer-path');
});

// 场景 3：都不是 URL 样式 → 保留较长的
it('keeps longer title when neither looks like URL and second is longer', () => {
  const bookmarks = [
    createBookmark('https://example.com', 'Short', '1'),
    createBookmark('https://example.com', 'Much Longer Title', '2'),
  ];
  const result = dedupeBookmarks(bookmarks);
  expect(result.bookmarks[0].title).toBe('Much Longer Title');
});
```

---

## 4. `src/modules/organizer.integration.test.ts` - 组织模块集成测试

### 设计思路

Mock Chrome API，测试与 Chrome 书签 API 的交互。

### Mock 设计

```typescript
const mockCreatedFolders: chrome.bookmarks.BookmarkTreeNode[] = [];
const mockCreatedBookmarks: chrome.bookmarks.BookmarkTreeNode[] = [];

vi.stubGlobal('chrome', {
  bookmarks: {
    getTree: vi.fn(async () => mockBookmarkTree),
    removeTree: vi.fn(async () => {}),
    create: vi.fn(async (details: chrome.bookmarks.CreateDetails) => {
      const id = details.url ? `bm-${mockBookmarkIdCounter++}` : `folder-${mockFolderIdCounter++}`;
      const node = createMockNode(id, details.title || '', {
        url: details.url,
        parentId: details.parentId,
      });
      if (details.url) {
        mockCreatedBookmarks.push(node);
      } else {
        mockCreatedFolders.push(node);
      }
      return node;
    }),
  },
  runtime: { lastError: null },
});
```

### 测试结构

| 测试组 | 测试内容 |
|--------|----------|
| 文件夹结构 | 创建 `📁Organized/` 根文件夹 |
| 死链接 | 创建 `⚠ Deadlinks/` 文件夹，标题包含错误信息 |
| 不可达链接 | 创建 `⚠ Unreachable/` 文件夹 |
| 子分类 | 大量书签（>10）时创建子分类 |
| 混合内容 | 同时处理正常、死链接、不可达书签 |
| 并行批量 | 验证 `Promise.all` 批量创建书签 |
| 回退逻辑 | "Other Bookmarks" 不存在时回退到 "Bookmarks Bar" |
| 子分类混合 | 有/无子分类的书签混合处理 |

---

## 5. `src/background/index.integration.test.ts` - 后台脚本集成测试

### 设计思路

Mock Chrome API 和存储模块，测试完整的两阶段流水线：

```
Phase 1: Fetch → Store to IndexedDB
Phase 2: Load → Dedupe → Categorize → Organize
```

### Mock 设计

```typescript
// Mock 存储模块
vi.mock('../lib/storage', () => ({
  storeFetched: vi.fn(async (bookmarks) => {
    mockStoredBookmarks.push(...bookmarks);
  }),
  loadAllFetched: vi.fn(async () => mockStoredBookmarks),
  clearAll: vi.fn(async () => { mockStoredBookmarks.length = 0; }),
  saveCheckpoint: vi.fn(async () => {}),
  loadCheckpoint: vi.fn(async () => null),
}));

// Mock 获取模块
vi.mock('../modules/fetcher', () => ({
  fetchBookmark: vi.fn(async (b) => ({
    ...b,
    meta: {},
    headings: [],
    status: 'ok',
  })),
}));
```

### 测试结构

| 测试组 | 测试内容 |
|--------|----------|
| `getAllBookmarks` | 从 Chrome 书签树提取书签 |
| `sendProgress` | 发送进度消息，更新状态，处理错误 |
| `runOrganization` | 核心流水线测试 |

### `runOrganization` 详细测试

```typescript
// 防止重复运行
it('does nothing if already running', async () => {
  state.isRunning = true;
  await runOrganization();
  expect(mockGetTree).not.toHaveBeenCalled();
});

// 取消处理 - 在获取过程中设置 shouldAbort
it('handles cancellation', async () => {
  vi.mocked(fetchBookmark).mockImplementationOnce(async (b) => {
    state.shouldAbort = true;  // 模拟用户取消
    return { ...b, status: 'ok' };
  });
  await runOrganization();
  expect(mockSendMessage).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'error', error: 'Operation cancelled' })
  );
});

// 批量间取消 - 需要超过 FETCH_BATCH_SIZE(10) 个书签
it('handles cancellation between batches', async () => {
  // 创建 15 个书签，触发两批处理
  mockGetTree.mockResolvedValueOnce([{
    id: '0',
    title: 'Root',
    children: Array(15).fill(null).map((_, i) => ({
      id: `${i + 1}`,
      title: `Bookmark ${i}`,
      url: `https://example${i}.com`,
    })),
  }]);
  // 在第一批后设置 shouldAbort
  // ...
});
```

### `cancelOperation` 详细测试

```typescript
// 取消时立即清除进度状态
it('clears progress state immediately', () => {
  state.current = 5;
  state.total = 10;
  state.currentUrl = 'https://example.com';

  cancelOperation();

  // 进度状态应该立即被清除
  expect(state.current).toBe(0);
  expect(state.total).toBe(0);
  expect(state.currentUrl).toBeUndefined();
  expect(state.shouldAbort).toBe(true);
});

// 即使已经取消，再次取消也会清除进度状态
it('clears progress state even when already aborted', () => {
  state.shouldAbort = true;
  state.current = 8;
  state.total = 15;

  cancelOperation();

  expect(state.current).toBe(0);
  expect(state.total).toBe(0);
});
```

### 取消 DB 一致性测试

```typescript
// 取消时丢弃部分批次结果
it('discards partial batch results when cancelled during fetch', async () => {
  // 创建 25 个书签（3 批次）
  mockGetTree.mockResolvedValueOnce([...]);

  // 在第一批获取期间设置取消
  vi.mocked(fetchBookmark).mockImplementation(async (b) => {
    fetchCount++;
    if (fetchCount === 5) {
      state.shouldAbort = true;  // 取消
    }
    return { ...b, status: 'ok' };
  });

  await runOrganization();

  // 应该发送取消错误，状态应该被清除
  expect(mockSendMessage).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'error', error: 'Operation cancelled' })
  );
  expect(state.current).toBe(0);
  expect(state.total).toBe(0);
});
```

### 弹窗重开状态一致性测试

```typescript
// 取消后弹窗重开显示正确状态
it('returns cleared state after cancellation', async () => {
  state.current = 5;
  state.total = 10;
  state.currentUrl = 'https://example.com';
  state.isRunning = true;

  cancelOperation();

  // 弹窗重开时获取的状态应该显示已清除的进度
  const currentState = { ...state };
  expect(currentState.current).toBe(0);
  expect(currentState.total).toBe(0);
  expect(currentState.currentUrl).toBeUndefined();
  expect(currentState.shouldAbort).toBe(true);
});
```

---

## 6. `src/popup/index.test.ts` - 弹出窗口 UI 测试

### 设计思路

Mock DOM 元素和 Chrome API，测试 UI 状态管理。

### Mock 设计

```typescript
// Mock DOM 元素
function createMockElement(): HTMLElement {
  return {
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn(),
      toggle: vi.fn(),
    },
    style: { width: '' },
    textContent: '',
    innerHTML: '',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as HTMLElement;
}

// Mock 所有需要的元素
function createMockElements(): PopupElements {
  return {
    idleState: createMockElement(),
    processingState: createMockElement(),
    completeState: createMockElement(),
    errorState: createMockElement(),
    startBtn: createMockElement(),
    // ...
  };
}
```

### 测试结构

| 测试组 | 测试内容 |
|--------|----------|
| `showState` | 四种状态显示（idle、processing、complete、error） |
| `updateProgress` | 进度条更新（百分比计算、URL 显示） |
| `showResults` | 结果显示（各种统计数据） |
| `countBookmarksInTree` | 递归计数（扁平、嵌套、深层结构） |
| `handleProgressMessage` | 消息处理（progress、complete、error、unknown、"Operation cancelled" 特殊处理） |
| `handleDone` | 关闭窗口 |
| `getElements` | 懒加载 DOM 元素 |
| `startOrganization` | 开始组织（发送 START_ORGANIZE 消息，处理 started: false 响应） |
| `cancelOrganization` | 取消组织（发送 CANCEL 消息，恢复 idle 状态） |
| `handleRetry` | 重试（调用 startOrganization） |
| `setupMessageListener` | 消息监听器注册 |
| `init` | 初始化（恢复状态、显示书签数量） |
| `auto-setup` | 自动初始化（DOM ready 时立即执行 vs DOMContentLoaded） |

### 关键测试

```typescript
// 使用 setElements 注入 mock，避免实际 DOM 依赖
beforeEach(() => {
  mockElements = createMockElements();
  setElements(mockElements);
});

// 测试进度更新
it('updates progress bar with correct percentage', () => {
  updateProgress(5, 10);
  expect(mockElements.progressBar.style.width).toBe('50%');
  expect(mockElements.progressText.textContent).toBe('50%');
  expect(mockElements.progressCount.textContent).toBe('5 of 10 processed');
});

// 测试自动初始化
it('sets up popup when DOM is already ready', async () => {
  vi.stubGlobal('document', { readyState: 'complete', ... });
  vi.resetModules();
  await import('../popup/index');
  // 验证 setupMessageListener 被调用
  expect(mockAddListener).toHaveBeenCalled();
});

// 测试 "Operation cancelled" 不显示错误状态
it('does NOT show error state for "Operation cancelled" error', () => {
  const message: ProgressEvent = {
    type: 'error',
    current: 0,
    total: 0,
    error: 'Operation cancelled',
  };

  const result = handleProgressMessage(message);

  // 应该返回 true（消息已处理）但不显示错误状态
  expect(result).toBe(true);
  expect(mockElements.errorState.classList.remove).not.toHaveBeenCalledWith('hidden');
  // 应该显示 idle 状态
  expect(mockElements.idleState.classList.remove).toHaveBeenCalledWith('hidden');
});

// 测试 startOrganization 处理 started: false
it('shows idle state when started: false is returned', async () => {
  const mockSendMessage = vi.fn().mockResolvedValue({ success: true, started: false });

  vi.stubGlobal('chrome', {
    runtime: { sendMessage: mockSendMessage },
    bookmarks: { getTree: vi.fn().mockResolvedValue([...]) },
  });

  await startOrganization();

  // 应该先显示 processing，然后恢复到 idle
  expect(mockElements.processingState.classList.remove).toHaveBeenCalledWith('hidden');
  expect(mockElements.idleState.classList.remove).toHaveBeenCalledWith('hidden');
});
```

---

## 测试设计原则总结

| 原则 | 说明 | 示例 |
|------|------|------|
| **隔离性** | 每个测试前后清理状态 | `beforeEach(() => storage.clearAll())` |
| **真实数据库** | 存储测试使用 `fake-indexeddb` | `import 'fake-indexeddb/auto'` |
| **工厂函数** | 简化测试数据创建 | `createBookmark(title, meta, headings)` |
| **边界覆盖** | 测试空输入、极端值、边界条件 | 空数组、超长字符串、零值 |
| **分层测试** | 先测底层函数，再测高层 API | `tokenize` → `buildCorpus` → `categorizeBookmarks` |
| **集成测试** | Mock 外部 API，测试内部逻辑 | Mock Chrome API、IndexedDB |
| **模块重置** | 需要重新导入模块时使用 `vi.resetModules()` | 测试自动初始化代码 |

---

## 覆盖率目标

| 文件 | 目标 | 当前 |
|------|------|------|
| `lib/storage.ts` | ≥95% | 100% |
| `modules/categorizer.ts` | ≥95% | 99.24% |
| `modules/deduper.ts` | ≥95% | 100% |
| `modules/fetcher.ts` | ≥95% | 100% |
| `modules/organizer.ts` | ≥95% | 100% |
| `background/index.ts` | ≥95% | 97.16% |
| `popup/index.ts` | ≥95% | ~95% |
| `utils/tfidf.ts` | ≥95% | 100% |

**总体覆盖率：99.31% 行覆盖率**

---

## Mock 外部依赖

### Chrome APIs

```typescript
vi.stubGlobal('chrome', {
  bookmarks: {
    getTree: vi.fn(async () => mockTree),
    create: vi.fn(async (details) => ({ id: '1', ...details })),
    removeTree: vi.fn(async () => {}),
  },
  runtime: {
    sendMessage: vi.fn(async () => {}),
    onMessage: { addListener: vi.fn() },
  },
});
```

### IndexedDB

```typescript
import 'fake-indexeddb/auto';
// 使用真实 IndexedDB 实现，无需 mock
```

### Fetch

```typescript
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
  status: 200,
  text: () => Promise.resolve('<html><head><title>Test</title></head></html>'),
}));
```
