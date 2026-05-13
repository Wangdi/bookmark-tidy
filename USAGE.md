# Bookmark Tidy - Usage Guide

- This is for human user to read about how to develop on this project and use the extension in Chrome

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
pnpm dev              # Development build (watch mode)
pnpm build            # Production build
pnpm typecheck        # Type check
pnpm test             # Run all tests
pnpm test:watch       # Run tests in watch mode
pnpm test:coverage    # Tests with coverage report
```

## Loading the Extension in Chrome

1. **Build the extension**:
   ```bash
   pnpm build
   ```

2. **Open Chrome extensions page**:
   - Navigate to `chrome://extensions/`
   - Or: Menu → More tools → Extensions

3. **Enable Developer mode**:
   - Toggle the switch in the top-right corner

4. **Load the extension**:
   - Click **"Load unpacked"**
   - Select the `dist/` folder

## Using the Extension

1. **Open the popup**:
   - Click the Bookmark Tidy icon in the Chrome toolbar
   - See bookmark count

2. **Organize bookmarks**:
   - Click **"Organize Bookmarks"**
   - Watch progress bar

3. **Review results**:
   - Check `📁Organized/` folder in "Other Bookmarks"
   - Deadlinks in `⚠ Deadlinks/`
   - Unreachable in `⚠ Unreachable/`

## What the Extension Does

| Feature | Description |
|---------|-------------|
| **Fetch validation** | Checks each URL, classifies as ok/deadlink/unreachable |
| **Dedupe** | Normalizes URLs (removes tracking params, www, protocol) |
| **Categorize** | Sparse TF-IDF + K-means for smart category names |
| **Sub-categories** | Folders with >10 bookmarks get subdivided |
| **Parallel processing** | Fetch in batches of 10, create bookmarks in parallel |
| **Crash recovery** | Checkpoints to IndexedDB, resume after interruption |

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

## Trial Mode

Test the organization workflow with a small subset before processing all bookmarks:

1. **Enter trial count**: In the popup, enter a number (10-500) in the trial input field
2. **Click "Organize Bookmarks"**: Processes only the specified number of randomly selected bookmarks
3. **Check results**: Review the timestamped folder, e.g., `📁Organized (Trial 50) - 2026-05-14/`
4. **Run multiple trials**: Each trial creates a new timestamped folder
5. **Run full mode**: Leave input empty to process all bookmarks to `📁Organized/`

**Trial mode benefits:**
- Quick validation of categorization quality
- Test workflow before committing to full processing
- Multiple trials can coexist with timestamp-based naming
- Full run creates separate clean `📁Organized/` folder

**Limits:**
- Minimum: 10 bookmarks
- Maximum: 500 bookmarks
- Default: 50 bookmarks

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

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Extension not loading | Select `dist/` folder, not project root |
| No bookmarks found | Extension processes all Chrome bookmarks |
| Process interrupted | Restart - will resume from checkpoint |
| Memory issues | Sparse vectors used for >500 bookmarks |

## Development

See [CLAUDE.md](./CLAUDE.md) for architecture.
See [TEST.md](./TEST.md) for testing guide.
