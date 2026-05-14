# Detailed Progress Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add detailed progress metrics to provide visibility into each phase of the organization process.

**Architecture:** Extend ProgressEvent type with detailed metrics, add telemetry collection in each module, create expandable "Show Details" panel in UI (collapsed by default), lazy evaluation for performance.

**Tech Stack:** TypeScript, Vitest, Chrome Extensions API, Performance API for timing

**Branch:** feature/detailed-progress

---

## File Structure

**New files:**
- None (all changes to existing files)

**Modified files:**
- `src/types/index.ts` - Add DetailedMetrics and PhaseMetrics types
- `src/background/index.ts` - Collect and stream detailed metrics
- `src/background/index.test.ts` - Unit tests for metrics collection
- `src/background/index.integration.test.ts` - Integration tests for metrics streaming
- `src/modules/fetcher.ts` - Collect fetch phase metrics
- `src/modules/fetcher.test.ts` - Tests for fetch metrics
- `src/modules/fetcher.integration.test.ts` - Integration tests for fetch metrics
- `src/modules/categorizer.ts` - Collect categorization metrics
- `src/modules/categorizer.test.ts` - Tests for categorization metrics
- `src/modules/organizer.ts` - Collect organization metrics
- `src/modules/organizer.test.ts` - Tests for organization metrics
- `src/modules/organizer.integration.test.ts` - Integration tests for organization metrics
- `src/popup/popup.html` - Add "Show Details" button and collapsible panel
- `src/popup/styles.css` - Style details panel and toggle button
- `src/popup/index.ts` - Handle toggle and display detailed metrics
- `src/popup/index.test.ts` - Unit tests for details panel
- `src/popup/index.integration.test.ts` - Integration tests for details display

---

## Phase 1: Backend - Type Definitions (Day 1)

### Task 1: Add DetailedMetrics Type

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Write the failing test**

Create test in `src/background/index.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('DetailedMetrics type', () => {
  it('accepts fetch phase metrics', () => {
    const metrics: import('../types').DetailedMetrics = {
      fetch: {
        totalUrls: 100,
        successful: 95,
        failed: 3,
        timedOut: 2,
        averageTime: 250,
        totalTime: 25000,
      },
    };
    expect(metrics.fetch?.totalUrls).toBe(100);
  });

  it('accepts storage metrics', () => {
    const metrics: import('../types').DetailedMetrics = {
      storage: {
        indexedDbWrites: 100,
        indexedDbReads: 200,
        checkpointSaves: 10,
        estimatedSize: 6 * 1024 * 1024, // 6MB
      },
    };
    expect(metrics.storage?.estimatedSize).toBe(6 * 1024 * 1024);
  });

  it('accepts categorization metrics', () => {
    const metrics: import('../types').DetailedMetrics = {
      categorization: {
        vocabularySize: 5000,
        vectorDimensions: 5000,
        clusters: 8,
        iterations: 15,
        convergenceTime: 1200,
      },
    };
    expect(metrics.categorization?.clusters).toBe(8);
  });

  it('accepts organization metrics', () => {
    const metrics: import('../types').DetailedMetrics = {
      organization: {
        foldersCreated: 8,
        bookmarksCreated: 95,
        batches: 10,
        averageBatchTime: 50,
      },
    };
    expect(metrics.organization?.foldersCreated).toBe(8);
  });

  it('accepts performance stats', () => {
    const metrics: import('../types').DetailedMetrics = {
      performance: {
        totalElapsed: 30000,
        averagePerBookmark: 300,
        memoryEstimate: 8 * 1024 * 1024, // 8MB
      },
    };
    expect(metrics.performance?.totalElapsed).toBe(30000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.test.ts`
Expected: FAIL with "Cannot find namespace 'DetailedMetrics'"

- [ ] **Step 3: Write minimal implementation**

Add to `src/types/index.ts`:

```typescript
export interface FetchMetrics {
  totalUrls: number;
  successful: number;
  failed: number;
  timedOut: number;
  averageTime: number;  // ms per URL
  totalTime: number;    // total fetch time in ms
}

export interface StorageMetrics {
  indexedDbWrites: number;
  indexedDbReads: number;
  checkpointSaves: number;
  estimatedSize: number;  // bytes
}

export interface CategorizationMetrics {
  vocabularySize: number;
  vectorDimensions: number;
  clusters: number;
  iterations: number;
  convergenceTime: number;  // ms
}

export interface OrganizationMetrics {
  foldersCreated: number;
  bookmarksCreated: number;
  batches: number;
  averageBatchTime: number;  // ms per batch
}

export interface PerformanceMetrics {
  totalElapsed: number;  // ms
  averagePerBookmark: number;  // ms per bookmark
  memoryEstimate: number;  // bytes
}

export interface DetailedMetrics {
  fetch?: FetchMetrics;
  storage?: StorageMetrics;
  categorization?: CategorizationMetrics;
  organization?: OrganizationMetrics;
  performance?: PerformanceMetrics;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/background/index.test.ts
git commit -m "feat: add DetailedMetrics type for progress reporting"
```

---

### Task 2: Extend ProgressEvent with DetailedMetrics

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.test.ts`:

```typescript
describe('ProgressEvent detailed metrics', () => {
  it('includes detailedMetrics in progress event', () => {
    const event: import('../types').ProgressEvent = {
      type: 'progress',
      current: 50,
      total: 100,
      detailedMetrics: {
        fetch: {
          totalUrls: 100,
          successful: 50,
          failed: 0,
          timedOut: 0,
          averageTime: 200,
          totalTime: 10000,
        },
      },
    };
    expect(event.detailedMetrics?.fetch?.successful).toBe(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.test.ts`
Expected: FAIL with "Property 'detailedMetrics' does not exist"

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
  detailedMetrics?: DetailedMetrics;  // NEW: detailed phase metrics
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/background/index.test.ts
git commit -m "feat: add detailedMetrics to ProgressEvent"
```

---

## Phase 2: Backend - Metrics Collection (Day 1 continued)

### Task 3: Add Metrics Collection State

**Files:**
- Modify: `src/background/index.ts`
- Modify: `src/background/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.test.ts`:

```typescript
describe('metrics collection state', () => {
  it('initializes metrics collector', () => {
    const { createMetricsCollector } = await import('../background/index');
    const collector = createMetricsCollector();
    
    expect(collector.getMetrics()).toEqual({});
  });

  it('updates fetch metrics', () => {
    const { createMetricsCollector } = await import('../background/index');
    const collector = createMetricsCollector();
    
    collector.updateFetch({
      totalUrls: 100,
      successful: 95,
      failed: 3,
      timedOut: 2,
      averageTime: 250,
      totalTime: 25000,
    });
    
    expect(collector.getMetrics().fetch?.successful).toBe(95);
  });

  it('updates storage metrics', () => {
    const { createMetricsCollector } = await import('../background/index');
    const collector = createMetricsCollector();
    
    collector.updateStorage({
      indexedDbWrites: 100,
      indexedDbReads: 200,
      checkpointSaves: 10,
      estimatedSize: 6 * 1024 * 1024,
    });
    
    expect(collector.getMetrics().storage?.checkpointSaves).toBe(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.test.ts`
Expected: FAIL with "createMetricsCollector is not defined"

- [ ] **Step 3: Write minimal implementation**

Add to `src/background/index.ts`:

```typescript
/**
 * Metrics collector for detailed progress reporting
 */
export function createMetricsCollector() {
  const metrics: DetailedMetrics = {};

  return {
    updateFetch(fetch: FetchMetrics) {
      metrics.fetch = fetch;
    },

    updateStorage(storage: StorageMetrics) {
      metrics.storage = storage;
    },

    updateCategorization(categorization: CategorizationMetrics) {
      metrics.categorization = categorization;
    },

    updateOrganization(organization: OrganizationMetrics) {
      metrics.organization = organization;
    },

    updatePerformance(performance: PerformanceMetrics) {
      metrics.performance = performance;
    },

    getMetrics(): DetailedMetrics {
      return { ...metrics };
    },

    reset() {
      Object.keys(metrics).forEach(key => delete metrics[key as keyof DetailedMetrics]);
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/background/index.ts src/background/index.test.ts
git commit -m "feat: implement metrics collector for detailed progress"
```

---

### Task 4: Add Timing Utilities

**Files:**
- Modify: `src/background/index.ts`
- Modify: `src/background/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.test.ts`:

```typescript
describe('timing utilities', () => {
  it('creates timer that tracks elapsed time', async () => {
    const { createTimer } = await import('../background/index');
    const timer = createTimer();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const elapsed = timer.elapsed();
    expect(elapsed).toBeGreaterThanOrEqual(100);
    expect(elapsed).toBeLessThan(200);
  });

  it('timer can be stopped and restarted', async () => {
    const { createTimer } = await import('../background/index');
    const timer = createTimer();
    
    await new Promise(resolve => setTimeout(resolve, 50));
    timer.stop();
    
    const elapsed1 = timer.elapsed();
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const elapsed2 = timer.elapsed();
    expect(elapsed2).toBe(elapsed1); // Should not change after stop
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.test.ts`
Expected: FAIL with "createTimer is not defined"

- [ ] **Step 3: Write minimal implementation**

Add to `src/background/index.ts`:

```typescript
/**
 * Timer for tracking elapsed time
 */
export function createTimer() {
  let startTime = performance.now();
  let stopped = false;
  let elapsedAtStop = 0;

  return {
    elapsed(): number {
      if (stopped) {
        return elapsedAtStop;
      }
      return performance.now() - startTime;
    },

    stop() {
      elapsedAtStop = performance.now() - startTime;
      stopped = true;
    },

    reset() {
      startTime = performance.now();
      stopped = false;
      elapsedAtStop = 0;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/background/index.ts src/background/index.test.ts
git commit -m "feat: implement timing utilities for metrics collection"
```

---

### Task 5: Collect Fetch Phase Metrics

**Files:**
- Modify: `src/modules/fetcher.ts`
- Modify: `src/modules/fetcher.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/modules/fetcher.test.ts`:

```typescript
describe('fetch metrics collection', () => {
  it('returns metrics from fetchBookmark', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<html><head><title>Test</title></head></html>'),
    }));

    const { fetchBookmark } = await import('../modules/fetcher');
    const result = await fetchBookmark({ id: '1', url: 'https://example.com', title: 'Test' });

    expect(result.metrics).toBeDefined();
    expect(result.metrics?.fetchTime).toBeGreaterThanOrEqual(0);
    expect(result.metrics?.status).toBe(200);

    vi.unstubAllGlobals();
  });

  it('tracks batch fetch metrics', async () => {
    const { fetchBatch } = await import('../modules/fetcher');
    
    const bookmarks = [
      { id: '1', url: 'https://example1.com', title: 'Test 1' },
      { id: '2', url: 'https://example2.com', title: 'Test 2' },
    ];

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<html><head><title>Test</title></head></html>'),
    }));

    const results = await fetchBatch(bookmarks);
    
    expect(results.metrics).toBeDefined();
    expect(results.metrics.totalUrls).toBe(2);
    expect(results.metrics.successful).toBeGreaterThanOrEqual(0);
    expect(results.metrics.averageTime).toBeGreaterThanOrEqual(0);

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/modules/fetcher.test.ts`
Expected: FAIL with "Property 'metrics' does not exist"

- [ ] **Step 3: Write minimal implementation**

Modify `src/modules/fetcher.ts`:

1. Add metrics to return type:

```typescript
export interface FetchResult {
  id: string;
  url: string;
  title: string;
  status: 'ok' | 'deadlink' | 'unreachable';
  meta?: Record<string, string>;
  headings?: string[];
  error?: string;
  metrics?: {
    fetchTime: number;
    status: number;
  };
}

export interface BatchFetchResult {
  results: FetchResult[];
  metrics: {
    totalUrls: number;
    successful: number;
    failed: number;
    timedOut: number;
    averageTime: number;
    totalTime: number;
  };
}
```

2. Update `fetchBookmark` function:

```typescript
export async function fetchBookmark(bookmark: { id: string; url: string; title: string }): Promise<FetchResult> {
  const startTime = performance.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(bookmark.url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const fetchTime = performance.now() - startTime;

    if (!response.ok) {
      return {
        id: bookmark.id,
        url: bookmark.url,
        title: bookmark.title,
        status: response.status === 404 || response.status === 410 ? 'deadlink' : 'unreachable',
        error: `HTTP ${response.status}`,
        metrics: { fetchTime, status: response.status },
      };
    }

    const html = await response.text();
    const { meta, headings } = extractMetadata(html);

    return {
      id: bookmark.id,
      url: bookmark.url,
      title: bookmark.title,
      status: 'ok',
      meta,
      headings,
      metrics: { fetchTime, status: response.status },
    };
  } catch (error) {
    const fetchTime = performance.now() - startTime;
    
    return {
      id: bookmark.id,
      url: bookmark.url,
      title: bookmark.title,
      status: 'unreachable',
      error: error instanceof Error ? error.message : 'Unknown error',
      metrics: { fetchTime, status: 0 },
    };
  }
}
```

3. Add `fetchBatch` function:

```typescript
export async function fetchBatch(bookmarks: Array<{ id: string; url: string; title: string }>): Promise<BatchFetchResult> {
  const startTime = performance.now();
  
  const results = await Promise.all(bookmarks.map(fetchBookmark));
  
  const totalTime = performance.now() - startTime;
  const successful = results.filter(r => r.status === 'ok').length;
  const failed = results.filter(r => r.status === 'deadlink').length;
  const timedOut = results.filter(r => r.status === 'unreachable').length;
  const averageTime = results.reduce((sum, r) => sum + (r.metrics?.fetchTime || 0), 0) / results.length;

  return {
    results,
    metrics: {
      totalUrls: bookmarks.length,
      successful,
      failed,
      timedOut,
      averageTime,
      totalTime,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/modules/fetcher.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/fetcher.ts src/modules/fetcher.test.ts
git commit -m "feat: add metrics collection to fetcher module"
```

---

### Task 6: Collect Categorization Metrics

**Files:**
- Modify: `src/modules/categorizer.ts`
- Modify: `src/modules/categorizer.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/modules/categorizer.test.ts`:

```typescript
describe('categorization metrics', () => {
  it('returns vocabulary size', async () => {
    const { categorize } = await import('../modules/categorizer');
    
    const bookmarks = [
      { id: '1', url: 'https://example.com', title: 'JavaScript Tutorial', content: 'Learn JS programming' },
      { id: '2', url: 'https://example.com', title: 'Python Guide', content: 'Python programming basics' },
    ];

    const result = await categorize(bookmarks, { numClusters: 2 });
    
    expect(result.metrics?.vocabularySize).toBeGreaterThan(0);
    expect(result.metrics?.vectorDimensions).toBeGreaterThan(0);
  });

  it('returns clustering metrics', async () => {
    const { categorize } = await import('../modules/categorizer');
    
    const bookmarks = [
      { id: '1', url: 'https://example.com', title: 'JavaScript Tutorial', content: 'Learn JS programming' },
      { id: '2', url: 'https://example.com', title: 'Python Guide', content: 'Python programming basics' },
    ];

    const result = await categorize(bookmarks, { numClusters: 2 });
    
    expect(result.metrics?.clusters).toBe(2);
    expect(result.metrics?.iterations).toBeGreaterThan(0);
    expect(result.metrics?.convergenceTime).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/modules/categorizer.test.ts`
Expected: FAIL with "Property 'metrics' does not exist"

- [ ] **Step 3: Write minimal implementation**

Modify `src/modules/categorizer.ts`:

1. Add metrics to return type:

```typescript
export interface CategorizationResult {
  bookmarks: CategorizedBookmark[];
  metrics: {
    vocabularySize: number;
    vectorDimensions: number;
    clusters: number;
    iterations: number;
    convergenceTime: number;
  };
}
```

2. Update `categorize` function:

```typescript
export async function categorize(
  bookmarks: ProcessedBookmark[],
  options?: { numClusters?: number }
): Promise<CategorizationResult> {
  const startTime = performance.now();
  
  // Build TF-IDF vectors
  const documents = bookmarks.map(b => `${b.title} ${b.content || ''}`);
  const { vectors, vocabulary, idf } = buildTFIDFVectors(documents);
  
  const vocabularySize = vocabulary.size;
  const vectorDimensions = idf.length;

  // Determine number of clusters
  const numClusters = options?.numClusters || Math.max(3, Math.min(20, Math.floor(bookmarks.length / 10)));

  // Run K-means clustering
  const { clusters, iterations } = await kmeans(vectors, numClusters);

  const convergenceTime = performance.now() - startTime;

  // ... rest of categorization logic ...

  return {
    bookmarks: categorizedBookmarks,
    metrics: {
      vocabularySize,
      vectorDimensions,
      clusters: numClusters,
      iterations,
      convergenceTime,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/modules/categorizer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/categorizer.ts src/modules/categorizer.test.ts
git commit -m "feat: add metrics collection to categorizer module"
```

---

### Task 7: Collect Organization Metrics

**Files:**
- Modify: `src/modules/organizer.ts`
- Modify: `src/modules/organizer.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/modules/organizer.test.ts`:

```typescript
describe('organization metrics', () => {
  it('returns folders and bookmarks created', async () => {
    const mockCreate = vi.fn()
      .mockResolvedValueOnce({ id: '1', title: '📁Organized' })
      .mockResolvedValue({ id: '2', title: 'Folder' });

    vi.stubGlobal('chrome', {
      bookmarks: {
        getTree: vi.fn().mockResolvedValue([{ id: '0', title: 'Root', children: [] }]),
        removeTree: vi.fn(),
        create: mockCreate,
      },
      runtime: { lastError: null },
    });

    const { organizeBookmarks } = await import('../modules/organizer');
    const result = await organizeBookmarks(
      [{ id: '1', title: 'Test', url: 'https://example.com', category: 'Test', keywords: ['test'] }],
      [],
      []
    );

    expect(result.metrics?.foldersCreated).toBeGreaterThan(0);
    expect(result.metrics?.bookmarksCreated).toBeGreaterThan(0);

    vi.unstubAllGlobals();
  });

  it('returns batch metrics', async () => {
    vi.stubGlobal('chrome', {
      bookmarks: {
        getTree: vi.fn().mockResolvedValue([{ id: '0', title: 'Root', children: [] }]),
        removeTree: vi.fn(),
        create: vi.fn().mockResolvedValue({ id: '1', title: 'Test' }),
      },
      runtime: { lastError: null },
    });

    const { organizeBookmarks } = await import('../modules/organizer');
    
    const bookmarks = Array(25).fill(null).map((_, i) => ({
      id: `${i}`,
      title: `Bookmark ${i}`,
      url: `https://example${i}.com`,
      category: 'Test',
      keywords: ['test'],
    }));

    const result = await organizeBookmarks(bookmarks, [], []);
    
    expect(result.metrics?.batches).toBeGreaterThan(0);
    expect(result.metrics?.averageBatchTime).toBeGreaterThanOrEqual(0);

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/modules/organizer.test.ts`
Expected: FAIL with "Property 'metrics' does not exist"

- [ ] **Step 3: Write minimal implementation**

Modify `src/modules/organizer.ts`:

1. Add metrics to return type:

```typescript
export interface OrganizationResult {
  metrics: {
    foldersCreated: number;
    bookmarksCreated: number;
    batches: number;
    averageBatchTime: number;
  };
}
```

2. Update `organizeBookmarks` function:

```typescript
export async function organizeBookmarks(
  bookmarks: CategorizedBookmark[],
  deadlinks: ProcessedBookmark[],
  unreachable: ProcessedBookmark[],
  folderName: string = 'Organized'
): Promise<OrganizationResult> {
  const metrics = {
    foldersCreated: 0,
    bookmarksCreated: 0,
    batches: 0,
    averageBatchTime: 0,
  };

  const batchTimes: number[] = [];

  // ... create folder structure ...

  // Create bookmarks in batches of 10
  for (let i = 0; i < bookmarks.length; i += BATCH_SIZE) {
    const batchStartTime = performance.now();
    const batch = bookmarks.slice(i, i + BATCH_SIZE);
    
    await Promise.all(batch.map(bookmark => {
      // ... create bookmark ...
      metrics.bookmarksCreated++;
    }));

    batchTimes.push(performance.now() - batchStartTime);
    metrics.batches++;
  }

  metrics.foldersCreated = folderCount;
  metrics.averageBatchTime = batchTimes.reduce((sum, t) => sum + t, 0) / batchTimes.length;

  return { metrics };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/modules/organizer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/organizer.ts src/modules/organizer.test.ts
git commit -m "feat: add metrics collection to organizer module"
```

---

## Phase 3: Backend - Integration (Day 2)

### Task 8: Integrate Metrics into runOrganization

**Files:**
- Modify: `src/background/index.ts`
- Modify: `src/background/index.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/background/index.integration.test.ts`:

```typescript
describe('runOrganization detailed metrics', () => {
  it('includes detailed metrics in progress events', async () => {
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
        create: vi.fn().mockResolvedValue({ id: '1', title: 'Test' }),
        removeTree: vi.fn(),
      },
      runtime: { sendMessage: mockSendMessage, lastError: null },
    });

    vi.mock('../modules/fetcher', () => ({
      fetchBatch: vi.fn(async (bookmarks) => ({
        results: bookmarks.map(b => ({ ...b, status: 'ok', meta: {}, headings: [] })),
        metrics: {
          totalUrls: bookmarks.length,
          successful: bookmarks.length,
          failed: 0,
          timedOut: 0,
          averageTime: 200,
          totalTime: bookmarks.length * 200,
        },
      })),
    }));

    vi.mock('../modules/categorizer', () => ({
      categorize: vi.fn(async () => ({
        bookmarks: [],
        metrics: {
          vocabularySize: 100,
          vectorDimensions: 100,
          clusters: 3,
          iterations: 10,
          convergenceTime: 500,
        },
      })),
    }));

    vi.mock('../modules/organizer', () => ({
      organizeBookmarks: vi.fn(async () => ({
        metrics: {
          foldersCreated: 3,
          bookmarksCreated: 10,
          batches: 1,
          averageBatchTime: 50,
        },
      })),
      clearOrganizedFolder: vi.fn(),
    }));

    const { runOrganization, resetState } = await import('../background/index');
    resetState();
    
    await runOrganization();

    // Check that progress events include detailed metrics
    const progressCalls = mockSendMessage.mock.calls.filter(
      call => call[0]?.type === 'progress'
    );
    
    expect(progressCalls.length).toBeGreaterThan(0);
    expect(progressCalls[0][0].detailedMetrics).toBeDefined();

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/background/index.integration.test.ts`
Expected: FAIL with "detailedMetrics is undefined"

- [ ] **Step 3: Write minimal implementation**

Modify `src/background/index.ts`:

1. Create metrics collector instance in state:

```typescript
export const state: OrganizerState = {
  isRunning: false,
  shouldAbort: false,
  current: 0,
  total: 0,
  currentUrl: undefined,
  isTrialMode: false,
  metricsCollector: createMetricsCollector(),  // NEW
  totalTimer: createTimer(),  // NEW
};
```

2. Update `runOrganization` to collect and stream metrics:

```typescript
export async function runOrganization(
  options?: OrganizationOptions
): Promise<boolean> {
  // ... existing early returns ...

  state.isRunning = true;
  state.shouldAbort = false;
  state.metricsCollector.reset();
  state.totalTimer.reset();

  try {
    // ... existing bookmark loading ...

    // Phase 1: Fetch
    const fetchStartTime = performance.now();
    
    for (let i = 0; i < bookmarks.length; i += BATCH_SIZE) {
      const batch = bookmarks.slice(i, i + BATCH_SIZE);
      const { results, metrics: fetchMetrics } = await fetchBatch(batch);
      
      // Update fetch metrics
      state.metricsCollector.updateFetch(fetchMetrics);
      
      // Send progress with detailed metrics
      sendProgress({
        type: 'progress',
        current: i + batch.length,
        total: bookmarks.length,
        currentUrl: `Fetching batch ${Math.floor(i / BATCH_SIZE) + 1}`,
        detailedMetrics: state.metricsCollector.getMetrics(),
      });
      
      // ... rest of fetch logic ...
    }

    // Phase 2: Categorize
    const { bookmarks: categorized, metrics: categorizationMetrics } = await categorize(processedBookmarks);
    
    state.metricsCollector.updateCategorization(categorizationMetrics);
    
    sendProgress({
      type: 'progress',
      current: bookmarks.length,
      total: bookmarks.length,
      currentUrl: 'Categorization complete',
      detailedMetrics: state.metricsCollector.getMetrics(),
    });

    // Phase 3: Organize
    const { metrics: organizationMetrics } = await organizeBookmarks(
      categorized, deadlinks, unreachable, folderName
    );
    
    state.metricsCollector.updateOrganization(organizationMetrics);

    // Final performance metrics
    const totalElapsed = state.totalTimer.elapsed();
    const averagePerBookmark = totalElapsed / bookmarks.length;
    
    state.metricsCollector.updatePerformance({
      totalElapsed,
      averagePerBookmark,
      memoryEstimate: estimateMemoryUsage(bookmarks.length),
    });

    // Send completion with all metrics
    sendProgress({
      type: 'complete',
      current: bookmarks.length,
      total: bookmarks.length,
      stats: {
        processed: bookmarks.length,
        duplicatesMerged,
        deadlinks: deadlinks.length,
        unreachable: unreachable.length,
        categories: categorizedMetrics.clusters,
      },
      detailedMetrics: state.metricsCollector.getMetrics(),
    });

    return true;
  } catch (error) {
    // ... error handling ...
  } finally {
    state.isRunning = false;
    state.totalTimer.stop();
  }
}
```

3. Add memory estimation helper:

```typescript
function estimateMemoryUsage(bookmarkCount: number): number {
  // Rough estimate: ~6MB for 2000 bookmarks
  return bookmarkCount * 3 * 1024;  // ~3KB per bookmark
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/background/index.integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/background/index.ts src/background/index.integration.test.ts
git commit -m "feat: integrate detailed metrics into runOrganization pipeline"
```

---

### Task 9: Add Storage Metrics Tracking

**Files:**
- Modify: `src/lib/storage.ts`
- Modify: `src/lib/storage.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/lib/storage.test.ts`:

```typescript
describe('storage metrics', () => {
  it('tracks IndexedDB write operations', async () => {
    const { saveFetchedData, getMetrics } = await import('../lib/storage');
    
    await saveFetchedData('1', { id: '1', url: 'https://example.com', status: 'ok' });
    await saveFetchedData('2', { id: '2', url: 'https://example2.com', status: 'ok' });
    
    const metrics = getMetrics();
    expect(metrics.writes).toBe(2);
  });

  it('tracks IndexedDB read operations', async () => {
    const { saveFetchedData, getFetchedData, getMetrics } = await import('../lib/storage');
    
    await saveFetchedData('1', { id: '1', url: 'https://example.com', status: 'ok' });
    await getFetchedData('1');
    await getFetchedData('1');
    
    const metrics = getMetrics();
    expect(metrics.reads).toBe(2);
  });

  it('estimates storage size', async () => {
    const { saveFetchedData, getMetrics } = await import('../lib/storage');
    
    const data = {
      id: '1',
      url: 'https://example.com',
      title: 'Test Bookmark',
      status: 'ok',
      meta: { description: 'Test description' },
      headings: ['Heading 1', 'Heading 2'],
    };
    
    await saveFetchedData('1', data);
    
    const metrics = getMetrics();
    expect(metrics.estimatedSize).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/storage.test.ts`
Expected: FAIL with "getMetrics is not defined"

- [ ] **Step 3: Write minimal implementation**

Modify `src/lib/storage.ts`:

```typescript
// Metrics tracking
let metrics = {
  writes: 0,
  reads: 0,
  estimatedSize: 0,
};

export function getMetrics() {
  return { ...metrics };
}

export function resetMetrics() {
  metrics = { writes: 0, reads: 0, estimatedSize: 0 };
}

export async function saveFetchedData(id: string, data: FetchedData): Promise<void> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ id, data, timestamp: Date.now() });
    
    request.onsuccess = () => {
      metrics.writes++;
      metrics.estimatedSize += estimateDataSize(data);
      resolve();
    };
    
    request.onerror = () => reject(request.error);
  });
}

export async function getFetchedData(id: string): Promise<FetchedData | null> {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onsuccess = () => {
      metrics.reads++;
      resolve(request.result?.data || null);
    };
    
    request.onerror = () => reject(request.error);
  });
}

function estimateDataSize(data: FetchedData): number {
  // Rough estimate based on JSON string length
  return JSON.stringify(data).length * 2;  // UTF-16 = 2 bytes per char
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/storage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts
git commit -m "feat: add metrics tracking to storage module"
```

---

## Phase 4: Frontend - UI (Day 2 continued)

### Task 10: Add Show Details Button to Popup HTML

**Files:**
- Modify: `src/popup/popup.html`

- [ ] **Step 1: Add details button and panel**

Modify `src/popup/popup.html`:

Find the processing-state div and add after the progress-count paragraph:

```html
    <!-- Show Details button -->
    <button id="show-details-btn" class="details-btn">
      <span class="details-icon">▶</span> Show Details
    </button>

    <!-- Collapsible details panel -->
    <div id="details-panel" class="details-panel hidden">
      <div class="details-section">
        <h3>📊 Fetch Phase</h3>
        <div class="metrics-grid">
          <div class="metric">
            <span class="metric-label">Total URLs:</span>
            <span id="fetch-total" class="metric-value">-</span>
          </div>
          <div class="metric">
            <span class="metric-label">Successful:</span>
            <span id="fetch-success" class="metric-value">-</span>
          </div>
          <div class="metric">
            <span class="metric-label">Failed:</span>
            <span id="fetch-failed" class="metric-value">-</span>
          </div>
          <div class="metric">
            <span class="metric-label">Avg Time:</span>
            <span id="fetch-avg-time" class="metric-value">-</span>
          </div>
        </div>
      </div>

      <div class="details-section">
        <h3>💾 Storage</h3>
        <div class="metrics-grid">
          <div class="metric">
            <span class="metric-label">IndexedDB Writes:</span>
            <span id="storage-writes" class="metric-value">-</span>
          </div>
          <div class="metric">
            <span class="metric-label">Checkpoints:</span>
            <span id="storage-checkpoints" class="metric-value">-</span>
          </div>
          <div class="metric">
            <span class="metric-label">Estimated Size:</span>
            <span id="storage-size" class="metric-value">-</span>
          </div>
        </div>
      </div>

      <div class="details-section">
        <h3>🤖 Categorization</h3>
        <div class="metrics-grid">
          <div class="metric">
            <span class="metric-label">Vocabulary Size:</span>
            <span id="cat-vocab" class="metric-value">-</span>
          </div>
          <div class="metric">
            <span class="metric-label">Clusters:</span>
            <span id="cat-clusters" class="metric-value">-</span>
          </div>
          <div class="metric">
            <span class="metric-label">Iterations:</span>
            <span id="cat-iterations" class="metric-value">-</span>
          </div>
          <div class="metric">
            <span class="metric-label">Time:</span>
            <span id="cat-time" class="metric-value">-</span>
          </div>
        </div>
      </div>

      <div class="details-section">
        <h3>📁 Organization</h3>
        <div class="metrics-grid">
          <div class="metric">
            <span class="metric-label">Folders Created:</span>
            <span id="org-folders" class="metric-value">-</span>
          </div>
          <div class="metric">
            <span class="metric-label">Bookmarks Created:</span>
            <span id="org-bookmarks" class="metric-value">-</span>
          </div>
          <div class="metric">
            <span class="metric-label">Batches:</span>
            <span id="org-batches" class="metric-value">-</span>
          </div>
        </div>
      </div>

      <div class="details-section">
        <h3>⏱️ Performance</h3>
        <div class="metrics-grid">
          <div class="metric">
            <span class="metric-label">Total Time:</span>
            <span id="perf-total" class="metric-value">-</span>
          </div>
          <div class="metric">
            <span class="metric-label">Avg per Bookmark:</span>
            <span id="perf-avg" class="metric-value">-</span>
          </div>
          <div class="metric">
            <span class="metric-label">Memory Estimate:</span>
            <span id="perf-memory" class="metric-value">-</span>
          </div>
        </div>
      </div>
    </div>
```

- [ ] **Step 2: Commit**

```bash
git add src/popup/popup.html
git commit -m "feat: add Show Details button and collapsible panel to popup"
```

---

### Task 11: Style Details Panel

**Files:**
- Modify: `src/popup/styles.css`

- [ ] **Step 1: Add details panel styles**

Add to `src/popup/styles.css`:

```css
/* Details toggle button */
.details-btn {
  width: 100%;
  padding: 8px 16px;
  margin-top: 12px;
  background: var(--bg-secondary, #f5f5f5);
  border: 1px solid var(--border-color, #ddd);
  border-radius: 6px;
  color: var(--text-primary, #333);
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
}

.details-btn:hover {
  background: var(--bg-hover, #e8e8e8);
}

.details-icon {
  font-size: 10px;
  transition: transform 0.2s ease;
}

.details-btn.expanded .details-icon {
  transform: rotate(90deg);
}

/* Details panel */
.details-panel {
  margin-top: 12px;
  padding: 12px;
  background: var(--bg-secondary, #f5f5f5);
  border-radius: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.details-panel.hidden {
  display: none;
}

.details-section {
  margin-bottom: 16px;
}

.details-section:last-child {
  margin-bottom: 0;
}

.details-section h3 {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #333);
}

.metrics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
}

.metric {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.metric-label {
  color: var(--text-secondary, #666);
}

.metric-value {
  color: var(--text-primary, #333);
  font-weight: 500;
}

/* Scrollbar styling */
.details-panel::-webkit-scrollbar {
  width: 6px;
}

.details-panel::-webkit-scrollbar-track {
  background: var(--bg-primary, #fff);
  border-radius: 3px;
}

.details-panel::-webkit-scrollbar-thumb {
  background: var(--border-color, #ccc);
  border-radius: 3px;
}

.details-panel::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary, #999);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/popup/styles.css
git commit -m "feat: add styles for details panel and toggle button"
```

---


### Task 12: Add Details Elements to PopupElements

**Files:**
- Modify: `src/popup/index.ts`
- Modify: `src/popup/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/popup/index.test.ts`:

```typescript
describe('details panel elements', () => {
  it('includes details panel elements in PopupElements', () => {
    const { PopupElements } = await import('../popup/index');
    const elements: PopupElements = {
      // ... existing elements ...
      showDetailsBtn: createMockElement() as HTMLButtonElement,
      detailsPanel: createMockElement() as HTMLElement,
      fetchTotal: createMockElement() as HTMLElement,
      fetchSuccess: createMockElement() as HTMLElement,
      // ... other metric elements ...
    };
    expect(elements.showDetailsBtn).toBeDefined();
    expect(elements.detailsPanel).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/popup/index.test.ts`
Expected: FAIL with "Property 'showDetailsBtn' does not exist"

- [ ] **Step 3: Write minimal implementation**

Modify `src/popup/index.ts`:

1. Update `PopupElements` interface:

```typescript
export interface PopupElements {
  // ... existing elements ...
  showDetailsBtn: HTMLButtonElement;
  detailsPanel: HTMLElement;
  // Fetch metrics
  fetchTotal: HTMLElement;
  fetchSuccess: HTMLElement;
  fetchFailed: HTMLElement;
  fetchAvgTime: HTMLElement;
  // Storage metrics
  storageWrites: HTMLElement;
  storageCheckpoints: HTMLElement;
  storageSize: HTMLElement;
  // Categorization metrics
  catVocab: HTMLElement;
  catClusters: HTMLElement;
  catIterations: HTMLElement;
  catTime: HTMLElement;
  // Organization metrics
  orgFolders: HTMLElement;
  orgBookmarks: HTMLElement;
  orgBatches: HTMLElement;
  // Performance metrics
  perfTotal: HTMLElement;
  perfAvg: HTMLElement;
  perfMemory: HTMLElement;
}
```

2. Update `getElements` function:

```typescript
export function getElements(): PopupElements {
  if (!elements) {
    elements = {
      // ... existing elements ...
      showDetailsBtn: document.getElementById('show-details-btn')! as HTMLButtonElement,
      detailsPanel: document.getElementById('details-panel')! as HTMLElement,
      // Fetch metrics
      fetchTotal: document.getElementById('fetch-total')!,
      fetchSuccess: document.getElementById('fetch-success')!,
      fetchFailed: document.getElementById('fetch-failed')!,
      fetchAvgTime: document.getElementById('fetch-avg-time')!,
      // Storage metrics
      storageWrites: document.getElementById('storage-writes')!,
      storageCheckpoints: document.getElementById('storage-checkpoints')!,
      storageSize: document.getElementById('storage-size')!,
      // Categorization metrics
      catVocab: document.getElementById('cat-vocab')!,
      catClusters: document.getElementById('cat-clusters')!,
      catIterations: document.getElementById('cat-iterations')!,
      catTime: document.getElementById('cat-time')!,
      // Organization metrics
      orgFolders: document.getElementById('org-folders')!,
      orgBookmarks: document.getElementById('org-bookmarks')!,
      orgBatches: document.getElementById('org-batches')!,
      // Performance metrics
      perfTotal: document.getElementById('perf-total')!,
      perfAvg: document.getElementById('perf-avg')!,
      perfMemory: document.getElementById('perf-memory')!,
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
git commit -m "feat: add details panel elements to PopupElements"
```

---

### Task 13: Implement Toggle Details Panel

**Files:**
- Modify: `src/popup/index.ts`
- Modify: `src/popup/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/popup/index.test.ts`:

```typescript
describe('toggle details panel', () => {
  it('shows panel when clicked', async () => {
    const { toggleDetailsPanel, setElements } = await import('../popup/index');
    setElements(mockElements);
    
    mockElements.detailsPanel.classList.add('hidden');
    
    toggleDetailsPanel();
    
    expect(mockElements.detailsPanel.classList.contains('hidden')).toBe(false);
    expect(mockElements.showDetailsBtn.classList.contains('expanded')).toBe(true);
    expect(mockElements.showDetailsBtn.textContent).toContain('Hide Details');
  });

  it('hides panel when clicked again', async () => {
    const { toggleDetailsPanel, setElements } = await import('../popup/index');
    setElements(mockElements);
    
    mockElements.detailsPanel.classList.remove('hidden');
    
    toggleDetailsPanel();
    
    expect(mockElements.detailsPanel.classList.contains('hidden')).toBe(true);
    expect(mockElements.showDetailsBtn.classList.contains('expanded')).toBe(false);
    expect(mockElements.showDetailsBtn.textContent).toContain('Show Details');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/popup/index.test.ts`
Expected: FAIL with "toggleDetailsPanel is not defined"

- [ ] **Step 3: Write minimal implementation**

Add to `src/popup/index.ts`:

```typescript
/**
 * Toggle details panel visibility
 */
export function toggleDetailsPanel(): void {
  const els = getElements();
  const isHidden = els.detailsPanel.classList.contains('hidden');
  
  if (isHidden) {
    els.detailsPanel.classList.remove('hidden');
    els.showDetailsBtn.classList.add('expanded');
    els.showDetailsBtn.innerHTML = '<span class="details-icon">▼</span> Hide Details';
  } else {
    els.detailsPanel.classList.add('hidden');
    els.showDetailsBtn.classList.remove('expanded');
    els.showDetailsBtn.innerHTML = '<span class="details-icon">▶</span> Show Details';
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/popup/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/popup/index.ts src/popup/index.test.ts
git commit -m "feat: implement toggleDetailsPanel function"
```

---

### Task 14: Implement Format Metrics Functions

**Files:**
- Modify: `src/popup/index.ts`
- Modify: `src/popup/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/popup/index.test.ts`:

```typescript
describe('format metrics', () => {
  it('formats time in milliseconds', async () => {
    const { formatTime } = await import('../popup/index');
    
    expect(formatTime(500)).toBe('500ms');
    expect(formatTime(1500)).toBe('1.5s');
    expect(formatTime(60000)).toBe('1.0m');
  });

  it('formats size in bytes', async () => {
    const { formatSize } = await import('../popup/index');
    
    expect(formatSize(1024)).toBe('1.0 KB');
    expect(formatSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatSize(500)).toBe('500 B');
  });

  it('formats number with commas', async () => {
    const { formatNumber } = await import('../popup/index');
    
    expect(formatNumber(1000)).toBe('1,000');
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(100)).toBe('100');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/popup/index.test.ts`
Expected: FAIL with "formatTime is not defined"

- [ ] **Step 3: Write minimal implementation**

Add to `src/popup/index.ts`:

```typescript
/**
 * Format time in milliseconds to human-readable string
 */
export function formatTime(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    return `${(ms / 60000).toFixed(1)}m`;
  }
}

/**
 * Format size in bytes to human-readable string
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

/**
 * Format number with thousand separators
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/popup/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/popup/index.ts src/popup/index.test.ts
git commit -m "feat: implement formatTime, formatSize, formatNumber utilities"
```

---

### Task 15: Implement Update Details Panel

**Files:**
- Modify: `src/popup/index.ts`
- Modify: `src/popup/index.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/popup/index.test.ts`:

```typescript
describe('update details panel', () => {
  it('updates fetch metrics in UI', async () => {
    const { updateDetailsPanel, setElements } = await import('../popup/index');
    setElements(mockElements);
    
    const metrics: DetailedMetrics = {
      fetch: {
        totalUrls: 100,
        successful: 95,
        failed: 3,
        timedOut: 2,
        averageTime: 250,
        totalTime: 25000,
      },
    };
    
    updateDetailsPanel(metrics);
    
    expect(mockElements.fetchTotal.textContent).toBe('100');
    expect(mockElements.fetchSuccess.textContent).toBe('95');
    expect(mockElements.fetchFailed.textContent).toBe('5');  // failed + timedOut
    expect(mockElements.fetchAvgTime.textContent).toBe('250ms');
  });

  it('updates storage metrics in UI', async () => {
    const { updateDetailsPanel, setElements } = await import('../popup/index');
    setElements(mockElements);
    
    const metrics: DetailedMetrics = {
      storage: {
        indexedDbWrites: 100,
        indexedDbReads: 200,
        checkpointSaves: 10,
        estimatedSize: 6 * 1024 * 1024,
      },
    };
    
    updateDetailsPanel(metrics);
    
    expect(mockElements.storageWrites.textContent).toBe('100');
    expect(mockElements.storageCheckpoints.textContent).toBe('10');
    expect(mockElements.storageSize.textContent).toBe('6.0 MB');
  });

  it('updates categorization metrics in UI', async () => {
    const { updateDetailsPanel, setElements } = await import('../popup/index');
    setElements(mockElements);
    
    const metrics: DetailedMetrics = {
      categorization: {
        vocabularySize: 5000,
        vectorDimensions: 5000,
        clusters: 8,
        iterations: 15,
        convergenceTime: 1200,
      },
    };
    
    updateDetailsPanel(metrics);
    
    expect(mockElements.catVocab.textContent).toBe('5,000');
    expect(mockElements.catClusters.textContent).toBe('8');
    expect(mockElements.catIterations.textContent).toBe('15');
    expect(mockElements.catTime.textContent).toBe('1.2s');
  });

  it('handles missing metrics gracefully', async () => {
    const { updateDetailsPanel, setElements } = await import('../popup/index');
    setElements(mockElements);
    
    const metrics: DetailedMetrics = {};
    
    updateDetailsPanel(metrics);
    
    // Should not throw and should show dashes
    expect(mockElements.fetchTotal.textContent).toBe('-');
    expect(mockElements.catVocab.textContent).toBe('-');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/popup/index.test.ts`
Expected: FAIL with "updateDetailsPanel is not defined"

- [ ] **Step 3: Write minimal implementation**

Add to `src/popup/index.ts`:

```typescript
/**
 * Update details panel with latest metrics
 */
export function updateDetailsPanel(metrics: DetailedMetrics): void {
  const els = getElements();

  // Fetch metrics
  if (metrics.fetch) {
    els.fetchTotal.textContent = formatNumber(metrics.fetch.totalUrls);
    els.fetchSuccess.textContent = formatNumber(metrics.fetch.successful);
    els.fetchFailed.textContent = formatNumber(metrics.fetch.failed + metrics.fetch.timedOut);
    els.fetchAvgTime.textContent = formatTime(metrics.fetch.averageTime);
  } else {
    els.fetchTotal.textContent = '-';
    els.fetchSuccess.textContent = '-';
    els.fetchFailed.textContent = '-';
    els.fetchAvgTime.textContent = '-';
  }

  // Storage metrics
  if (metrics.storage) {
    els.storageWrites.textContent = formatNumber(metrics.storage.indexedDbWrites);
    els.storageCheckpoints.textContent = formatNumber(metrics.storage.checkpointSaves);
    els.storageSize.textContent = formatSize(metrics.storage.estimatedSize);
  } else {
    els.storageWrites.textContent = '-';
    els.storageCheckpoints.textContent = '-';
    els.storageSize.textContent = '-';
  }

  // Categorization metrics
  if (metrics.categorization) {
    els.catVocab.textContent = formatNumber(metrics.categorization.vocabularySize);
    els.catClusters.textContent = formatNumber(metrics.categorization.clusters);
    els.catIterations.textContent = formatNumber(metrics.categorization.iterations);
    els.catTime.textContent = formatTime(metrics.categorization.convergenceTime);
  } else {
    els.catVocab.textContent = '-';
    els.catClusters.textContent = '-';
    els.catIterations.textContent = '-';
    els.catTime.textContent = '-';
  }

  // Organization metrics
  if (metrics.organization) {
    els.orgFolders.textContent = formatNumber(metrics.organization.foldersCreated);
    els.orgBookmarks.textContent = formatNumber(metrics.organization.bookmarksCreated);
    els.orgBatches.textContent = formatNumber(metrics.organization.batches);
  } else {
    els.orgFolders.textContent = '-';
    els.orgBookmarks.textContent = '-';
    els.orgBatches.textContent = '-';
  }

  // Performance metrics
  if (metrics.performance) {
    els.perfTotal.textContent = formatTime(metrics.performance.totalElapsed);
    els.perfAvg.textContent = formatTime(metrics.performance.averagePerBookmark);
    els.perfMemory.textContent = formatSize(metrics.performance.memoryEstimate);
  } else {
    els.perfTotal.textContent = '-';
    els.perfAvg.textContent = '-';
    els.perfMemory.textContent = '-';
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/popup/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/popup/index.ts src/popup/index.test.ts
git commit -m "feat: implement updateDetailsPanel with all metric sections"
```

---

### Task 16: Connect Details Panel to Progress Messages

**Files:**
- Modify: `src/popup/index.ts`
- Modify: `src/popup/index.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/popup/index.integration.test.ts`:

```typescript
describe('handleProgressMessage with detailed metrics', () => {
  it('updates details panel when detailedMetrics present', async () => {
    const { handleProgressMessage, setElements } = await import('../popup/index');
    setElements(mockElements);
    
    const message: ProgressEvent = {
      type: 'progress',
      current: 50,
      total: 100,
      detailedMetrics: {
        fetch: {
          totalUrls: 100,
          successful: 50,
          failed: 2,
          timedOut: 1,
          averageTime: 200,
          totalTime: 10000,
        },
      },
    };

    handleProgressMessage(message);

    expect(mockElements.fetchTotal.textContent).toBe('100');
    expect(mockElements.fetchSuccess.textContent).toBe('50');
  });

  it('does not update details panel when detailedMetrics absent', async () => {
    const { handleProgressMessage, setElements } = await import('../popup/index');
    setElements(mockElements);
    
    // Set initial values
    mockElements.fetchTotal.textContent = '-';
    
    const message: ProgressEvent = {
      type: 'progress',
      current: 50,
      total: 100,
    };

    handleProgressMessage(message);

    // Should remain unchanged
    expect(mockElements.fetchTotal.textContent).toBe('-');
  });

  it('updates details panel on completion', async () => {
    const { handleProgressMessage, setElements } = await import('../popup/index');
    setElements(mockElements);
    
    const message: ProgressEvent = {
      type: 'complete',
      current: 100,
      total: 100,
      stats: {
        processed: 100,
        duplicatesMerged: 5,
        deadlinks: 3,
        unreachable: 2,
        categories: 8,
      },
      detailedMetrics: {
        performance: {
          totalElapsed: 30000,
          averagePerBookmark: 300,
          memoryEstimate: 8 * 1024 * 1024,
        },
      },
    };

    handleProgressMessage(message);

    expect(mockElements.perfTotal.textContent).toBe('30.0s');
    expect(mockElements.perfAvg.textContent).toBe('300ms');
    expect(mockElements.perfMemory.textContent).toBe('8.0 MB');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/popup/index.integration.test.ts`
Expected: FAIL with "Expected '100', received '-'"

- [ ] **Step 3: Write minimal implementation**

Modify `src/popup/index.ts`:

Find the `handleProgressMessage` function and update:

```typescript
export function handleProgressMessage(message: ProgressEvent): boolean {
  if (message.type === 'progress') {
    updateProgress(message.current, message.total, message.currentUrl);

    // Update details panel if metrics present
    if (message.detailedMetrics) {
      updateDetailsPanel(message.detailedMetrics);
    }

    // ... existing trial mode handling ...

    return true;
  } else if (message.type === 'complete') {
    showResults(message.stats);
    showState('complete');

    // Update details panel with final metrics
    if (message.detailedMetrics) {
      updateDetailsPanel(message.detailedMetrics);
    }

    // ... existing trial mode handling ...

    return true;
  } else if (message.type === 'error') {
    // ... existing error handling ...
  }
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/popup/index.integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/popup/index.ts src/popup/index.integration.test.ts
git commit -m "feat: connect details panel updates to progress messages"
```

---

### Task 17: Wire Up Toggle Button Event Handler

**Files:**
- Modify: `src/popup/index.ts`
- Modify: `src/popup/index.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/popup/index.integration.test.ts`:

```typescript
describe('toggle button event handler', () => {
  it('wires up toggle button on init', async () => {
    const mockAddEventListener = vi.fn();
    
    vi.stubGlobal('document', {
      getElementById: vi.fn().mockReturnValue({
        addEventListener: mockAddEventListener,
        classList: { add: vi.fn(), remove: vi.fn() },
      }),
    });

    const { init } = await import('../popup/index');
    init();

    // Check that event listener was added to toggle button
    expect(mockAddEventListener).toHaveBeenCalledWith('click', expect.any(Function));

    vi.unstubAllGlobals();
  });

  it('toggles panel on button click', async () => {
    const { init, setElements } = await import('../popup/index');
    setElements(mockElements);
    
    init();
    
    // Simulate button click
    const clickEvent = new Event('click');
    mockElements.showDetailsBtn.dispatchEvent(clickEvent);
    
    expect(mockElements.detailsPanel.classList.contains('hidden')).toBe(false);

    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/popup/index.integration.test.ts`
Expected: FAIL with "toggle button not wired up"

- [ ] **Step 3: Write minimal implementation**

Modify `src/popup/index.ts`:

Find the `init` function and add:

```typescript
export function init(): void {
  const els = getElements();

  // Wire up button handlers
  els.startBtn.addEventListener('click', startOrganization);
  els.cancelBtn.addEventListener('click', cancelOrganization);
  els.resetBtn.addEventListener('click', resetData);
  els.doneBtn.addEventListener('click', () => window.close());
  els.retryBtn.addEventListener('click', startOrganization);

  // Wire up details toggle button
  els.showDetailsBtn.addEventListener('click', toggleDetailsPanel);

  // Load bookmark count
  getBookmarkCount().then(count => {
    els.bookmarkCount.textContent = `${count} bookmarks found`;
  });

  // Listen for progress updates
  chrome.runtime.onMessage.addListener(handleProgressMessage);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/popup/index.integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/popup/index.ts src/popup/index.integration.test.ts
git commit -m "feat: wire up toggle button event handler in init"
```

---

## Phase 5: Testing & Documentation (Day 3)

### Task 18: Run Full Test Suite

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests pass (existing + new detailed metrics tests)

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
| **Detailed progress** | Real-time metrics for fetch, storage, categorization phases |
```

- [ ] **Step 2: Update USAGE.md**

Add to "Using the Extension" section:

```markdown
### Viewing Detailed Progress

During organization, you can view detailed metrics about each phase:

1. Click the **"Show Details"** button (collapsed by default)
2. View real-time metrics for:
   - **Fetch Phase**: URLs processed, success/failure rates, timing
   - **Storage**: IndexedDB operations, checkpoint saves, memory usage
   - **Categorization**: Vocabulary size, clusters, convergence time
   - **Organization**: Folders/bookmarks created, batch progress
   - **Performance**: Total elapsed time, average per bookmark, memory estimate
3. Click **"Hide Details"** to collapse the panel

**Note**: Detailed metrics are computed lazily and only when the panel is expanded.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md USAGE.md
git commit -m "docs: update documentation for detailed progress feature"
```

---

## Implementation Notes

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Collapsed by default | Avoid overwhelming users with data; show on demand |
| Lazy evaluation | Only compute detailed metrics when panel is expanded |
| Message streaming | Send metrics with each progress event for real-time updates |
| Separate format functions | Reusable, testable, easy to maintain |
| Metrics collector | Centralized state management in background service worker |

### Performance Considerations

- Metrics collection adds minimal overhead (~2-5ms per phase)
- Lazy evaluation ensures UI remains responsive
- Detailed metrics only computed when panel is expanded
- Metrics are streamed with existing progress messages (no extra message passing)

### Testing Strategy

- Unit tests for each format function (formatTime, formatSize, formatNumber)
- Unit tests for toggle functionality
- Unit tests for updateDetailsPanel with all metric sections
- Integration tests for message handling and UI updates
- Integration tests for end-to-end metrics streaming

### Future Enhancements

- Persist toggle state across popup sessions
- Export detailed metrics to JSON file
- Add charts/graphs for visual representation
- Historical metrics comparison across runs
