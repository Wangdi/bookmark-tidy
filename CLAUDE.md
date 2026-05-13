# Bookmark Tidy

A Chrome extension that organizes bookmarks by merging duplicates, removing deadlinks, and categorizing using TF-IDF + K-means clustering.

**Documentation:**
- [SPEC.md](./SPEC.md) - Technical specification
- [USAGE.md](./USAGE.md) - Installation and usage guide
- [TEST.md](./TEST.md) - Test design and coverage
- [AGENTS.md](./AGENTS.md) - Stub for other AI agents (links here)

## Quick Start

```bash
pnpm install           # Install dependencies
pnpm dev               # Development build (watch mode)
pnpm build             # Production build
pnpm test              # Run tests
pnpm test:coverage     # Tests with coverage report
```

## Project Structure

```
src/
├── background/         # Service worker (orchestrator)
│   └── index.ts        # Two-phase pipeline coordination
├── lib/
│   └── storage.ts      # IndexedDB (fetched data + checkpoints)
├── modules/
│   ├── fetcher.ts      # Fetch pages, extract meta/headings
│   ├── deduper.ts      # URL normalization and deduplication
│   ├── categorizer.ts  # Sparse TF-IDF + K-means clustering
│   └── organizer.ts    # Create folder structure (parallel batches)
├── popup/              # Extension popup UI
├── utils/
│   ├── tfidf.ts        # Custom TF-IDF implementation
│   └── url-normalizer.ts
└── types/              # TypeScript interfaces
```

## Architecture

Two-phase pipeline for handling 2000+ bookmarks:

**Phase 1: Fetch → Store**
- Fetch bookmarks in batches of 10 (concurrent)
- Store results to IndexedDB
- Checkpoint progress for crash recovery

**Phase 2: Load → Categorize → Organize**
- Load all fetched data from IndexedDB
- Dedupe by normalized URL
- Categorize using sparse TF-IDF vectors + K-means
- Create `📁Organized/` folder structure in parallel batches

## Features

| Feature | Description |
|---------|-------------|
| URL normalization | Removes tracking params, www, protocol |
| Deadlink detection | 404/410/DNS failures → `⚠ Deadlinks/` |
| Unreachable detection | Timeout/5xx → `⚠ Unreachable/` |
| Categorization | Sparse TF-IDF + K-means clustering |
| Category naming | 1-2 words from top TF-IDF terms |
| Sub-categories | Auto-generated when category >10 bookmarks |
| Crash recovery | IndexedDB checkpointing, resume on restart |
| **Trial mode** | Process random subset (10-500) of bookmarks for testing, results saved to timestamped folder |

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Non-AI categorization | TF-IDF + K-means works offline, no API costs |
| Sparse vectors | ~6MB memory vs ~65MB for dense (2000 bookmarks) |
| IndexedDB checkpointing | Resume after crash, bounded memory during fetch |
| Parallel bookmark creation | `Promise.all` batches of 10 for speed |
| Lightweight extraction | Meta tags + headings only (avoids CORS) |

## Output Structure

```
📁Organized/
├── Development/
│   ├── Javascript/
│   │   └── React Docs
│   └── Python/
├── News/
│   └── BBC
├── ⚠ Deadlinks/
│   └── old-site.com (404)
└── ⚠ Unreachable/
    └── slow-server.com (timeout)
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `ml-kmeans` | K-means clustering |
| `fake-indexeddb` | IndexedDB for tests |
| (custom) | TF-IDF in `src/utils/tfidf.ts` |

## Development

- **Spec driven** - Follow SPEC.md for specifications
- **Test driven** - Write tests before implementation
- **95%+ coverage** - Maintain test coverage

### Code Style

- TypeScript strict mode
- prefer pnpm over npm
- One module per file, single responsibility
- Pure functions preferred
- Chrome API calls isolated to background/organizer

### Commit Messages

- `feat:` - New features
- `fix:` - Bug fixes
- `refactor:` - Code refactoring
- `docs:` - Documentation
- `test:` - Test changes
