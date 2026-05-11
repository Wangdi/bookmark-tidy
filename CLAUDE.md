# Bookmark Tidy

A Chrome extension that organizes and tidies up user bookmarks by merging duplicates, removing deadlinks, and categorizing using TF-IDF + K-means clustering.

**Documentation:**
- [SPEC.md](./SPEC.md) - Technical specification
- [AGENT.md](./AGENT.md) - Instructions for AI agents

## Project Structure

```
bookmark-tidy/
├── src/
│   ├── background/       # Service worker (orchestrator)
│   ├── modules/          # Core business logic
│   │   ├── fetcher.ts    # Fetch pages, extract meta/headings, detect deadlinks
│   │   ├── deduper.ts    # URL normalization and deduplication
│   │   ├── categorizer.ts # TF-IDF + K-means clustering
│   │   └── organizer.ts  # Create folder structure in bookmarks
│   ├── popup/            # Extension popup UI
│   ├── utils/            # Shared utilities
│   │   ├── tfidf.ts      # Custom TF-IDF implementation
│   │   ├── url-normalizer.ts # URL normalization functions
│   │   └── stop-words.ts # Stop words for tokenization
│   └── types/            # TypeScript interfaces
├── dist/                 # Build output (load this in Chrome)
└── docs/
    └── superpowers/
        ├── specs/        # Design specifications
        └── plans/        # Implementation plans
```

## Commands

```bash
pnpm install        # Install dependencies
pnpm run dev        # Development build (watch mode)
pnpm run build      # Production build
pnpm run typecheck  # Type check
pnpm run test       # Run tests
pnpm run test:watch # Run tests in watch mode
```

## Loading the Extension

1. Run `pnpm run build`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist/` folder

## Architecture

The extension uses a modular pipeline architecture:

1. **Fetcher** - Fetches each bookmark URL, extracts metadata and headings, classifies as ok/deadlink/unreachable
2. **Deduper** - Normalizes URLs (removes tracking params, www, protocol) and merges duplicates
3. **Categorizer** - Builds TF-IDF vectors from bookmark content, clusters with K-means, generates smart 1-2 word category names
4. **Organizer** - Creates `📁Organized/` folder with category folders, sub-categories (for >10 items), and error folders

## Key Design Decisions

- **Non-AI categorization**: Uses TF-IDF + K-means instead of LLM APIs
- **Lightweight extraction**: Meta tags + headings only (avoids CORS issues)
- **Error separation**: `⚠ Deadlinks/` (404s, DNS failures) vs `⚠ Unreachable/` (timeouts, 5xx)
- **Fresh output**: `📁Organized/` folder is deleted and recreated on each run
- **Rate limiting**: Batch of 5 URLs with 500ms delay

## Dependencies

- `ml-kmeans` - K-means clustering algorithm
- TF-IDF - Custom lightweight implementation (see `src/utils/tfidf.ts`)

## Future Improvements

See design spec for planned enhancements:
- Full content extraction using hidden tabs + Readability.js for better categorization quality
