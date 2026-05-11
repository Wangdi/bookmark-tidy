# Bookmark Tidy - Usage Guide

## Loading the Extension in Chrome

1. **Build the extension** (if you haven't already):
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
- **Large bundle warning**: The ~14MB background script is expected due to the NLP library

## Development

See [CLAUDE.md](./CLAUDE.md) for development commands and architecture details.
