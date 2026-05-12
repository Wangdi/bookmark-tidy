# Bookmark Tidy - Usage Guide

## Installation

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Install Dependencies

```bash
pnpm install
```

## Commands

```bash
pnpm run dev           # Development build (watch mode)
pnpm run build         # Production build
pnpm run typecheck     # Type check
pnpm run test          # Run all tests
pnpm run test:watch    # Run tests in watch mode
pnpm run test:coverage # Run tests with coverage report
```

## Loading the Extension in Chrome

1. **Build the extension**:
   ```bash
   pnpm run build
   ```

2. **Open Chrome extensions page**:
   - Navigate to `chrome://extensions/`
   - Or: Menu → More tools → Extensions

3. **Enable Developer mode**:
   - Toggle the switch in the top-right corner

4. **Load the extension**:
   - Click **"Load unpacked"**
   - Select the `dist/` folder in your project directory

## Using the Extension

1. **Open the popup**:
   - Click the Bookmark Tidy icon in the Chrome toolbar
   - You'll see "📚 Bookmark Tidy" with a count of your bookmarks

2. **Organize your bookmarks**:
   - Click the **"Organize Bookmarks"** button
   - Watch the progress bar as it processes each bookmark

3. **Review results**:
   - When complete, check the `📁Organized/` folder in "Other Bookmarks"
   - Deadlinks will be in `⚠ Deadlinks/`
   - Unreachable sites will be in `⚠ Unreachable/`

## What the Extension Does

- **Merges duplicates**: URLs are normalized (removes tracking params, www, protocol) before matching
- **Detects deadlinks**: 404s, 410s, DNS failures are moved to `⚠ Deadlinks/`
- **Separates unreachable sites**: Timeouts, 5xx errors go to `⚠ Unreachable/`
- **Categorizes bookmarks**: Uses TF-IDF + K-means clustering to create smart 1-2 word category names
- **Creates sub-categories**: Folders with >10 bookmarks get automatically subdivided

## Output Structure

```
📁Organized/
├── Development/
│   ├── Javascript/
│   │   └── React Docs
│   └── Git/
│       └── GitHub Tutorial
├── News/
│   ├── BBC
│   └── Reuters
├── ⚠ Deadlinks/
│   └── old-site.com (404)
└── ⚠ Unreachable/
    └── slow-server.com (timeout)
```

## Troubleshooting

- **Extension not loading**: Make sure you selected the `dist/` folder, not the project root
- **No bookmarks found**: The extension processes all bookmarks in your Chrome bookmark tree
- **Service worker error**: The background script should be ~60KB. If it's 14MB+, rebuild with `pnpm run build`.

## Testing

### Run Tests

```bash
pnpm run test          # Run all tests
pnpm run test:coverage # Run with coverage report
```

### Test Structure

```
src/
├── modules/
│   ├── categorizer.test.ts           # Unit tests
│   ├── deduper.test.ts               # Unit tests
│   ├── fetcher.test.ts               # Unit tests
│   ├── fetcher.integration.test.ts   # Integration tests (mocked fetch)
│   ├── organizer.test.ts             # Unit tests
│   └── organizer.integration.test.ts # Integration tests (mocked Chrome APIs)
├── utils/
│   ├── tfidf.test.ts                 # Unit tests
│   ├── url-normalizer.test.ts        # Unit tests
│   └── stop-words.test.ts            # Unit tests
```

### How to Test Modules with External Dependencies

Modules that interact with external APIs (network, Chrome) require mocking for isolated testing.

#### Testing `fetcher.ts` (Mock `fetch` global)

```typescript
import { vi } from 'vitest';
import { fetchBookmarks } from '../modules/fetcher';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('fetcher integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches a bookmark successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      text: () => Promise.resolve('<html><head><title>Test</title></head></html>'),
    });

    const result = await fetchBookmarks([{ id: '1', url: 'https://example.com', title: 'Test' }]);

    expect(result.bookmarks).toHaveLength(1);
    expect(result.bookmarks[0].status).toBe('ok');
  });
});
```

#### Testing `organizer.ts` (Mock Chrome APIs)

```typescript
import { vi } from 'vitest';
import { organizeBookmarks } from '../modules/organizer';

vi.stubGlobal('chrome', {
  bookmarks: {
    getTree: vi.fn(async () => [{ id: '0', title: 'Root', children: [...] }]),
    removeTree: vi.fn(async () => {}),
    create: vi.fn(async (details) => ({ id: '1', title: details.title })),
  },
});

describe('organizer integration', () => {
  it('creates organized folder structure', async () => {
    const result = await organizeBookmarks(bookmarks, [], [], 0);
    expect(result.success).toBe(true);
  });
});
```

### Coverage Report

| File | Statements | Branches | Functions | Lines |
|------|------------|----------|-----------|-------|
| All files | 97.99% | 91.97% | 98.48% | 98.17% |
| categorizer.ts | 98.42% | 90.24% | 100% | 98.27% |
| deduper.ts | 94.11% | 85.71% | 100% | 94.11% |
| fetcher.ts | 98.61% | 97.5% | 90% | 100% |
| organizer.ts | 95.52% | 88.88% | 100% | 95.31% |
| tfidf.ts | 100% | 90% | 100% | 100% |

## Development

See [CLAUDE.md](./CLAUDE.md) for architecture details and design decisions.
See [AGENT.md](./AGENT.md) for AI agent instructions.
