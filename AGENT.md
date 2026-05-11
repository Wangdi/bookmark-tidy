# Bookmark Tidy - Agent Instructions

This file contains instructions for AI agents (Claude, Gemini, Copilot, etc.) working on this project.

## Project Context

See [CLAUDE.md](./CLAUDE.md) for project overview and structure.
See [SPEC.md](./SPEC.md) for detailed specifications.

## Development Workflow

### Before Making Changes

1. Read the relevant spec section in [SPEC.md](./SPEC.md)
2. Check existing implementation patterns in `src/modules/`
3. Maintain consistency with the modular architecture

### Code Style

- TypeScript with strict mode enabled
- One module per file, single responsibility
- Pure functions preferred where possible
- All Chrome API calls should be isolated to background/organizer modules

### Testing

- Run `pnpm run typecheck` before committing
- Run `pnpm run test` to execute all tests
- Run `pnpm run test:coverage` for coverage report
- Build must succeed: `pnpm run build`
- Test extension in Chrome after significant changes
- **Maintain 95%+ test coverage** - write tests for new code

#### Testing Patterns

**Unit Tests** - Test pure functions and utilities:
```typescript
// Test exported helper functions
import { tokenize, generateCategoryName } from '../modules/categorizer';

it('tokenizes text correctly', () => {
  expect(tokenize('Hello World')).toContain('hello');
});
```

**Integration Tests** - Mock external dependencies:
- Use `vi.fn()` for mock functions
- Use `vi.stubGlobal()` for global mocks (fetch, chrome)
- See `fetcher.integration.test.ts` and `organizer.integration.test.ts` for examples

### Commit Messages

Use conventional commits:
- `feat:` - New features
- `fix:` - Bug fixes
- `refactor:` - Code refactoring
- `docs:` - Documentation changes
- `chore:` - Build/config changes

## Module Boundaries

| Module | Responsibility | Dependencies |
|--------|---------------|--------------|
| `fetcher` | Fetch URLs, extract content | `types`, `url-normalizer` |
| `deduper` | Normalize URLs, merge duplicates | `types`, `url-normalizer` |
| `categorizer` | TF-IDF, clustering, naming | `types`, `stop-words`, `tfidf`, `ml-kmeans` |
| `organizer` | Create bookmark folders | `types`, Chrome APIs |
| `background` | Orchestrate pipeline | All modules |
| `popup` | UI, progress display | `types` |

## Known Constraints

- Service worker cannot use DOM APIs directly (use DOMParser on fetched HTML)
- Chrome bookmarks API is async - always await
- Fetch timeout is 30 seconds
- Rate limit: 5 concurrent, 500ms between batches

## Future Work

When implementing enhanced content extraction (Option A):
- Use `chrome.tabs.create({ active: false })` for hidden tabs
- Integrate Readability.js for article extraction
- Consider memory impact of loading full pages
