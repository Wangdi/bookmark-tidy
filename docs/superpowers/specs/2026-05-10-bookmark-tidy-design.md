# Bookmark Tidy - Chrome Extension Design

## Overview

A Chrome extension that organizes and tidies up user bookmarks by:
1. Merging duplicate bookmarks (normalized URL matching)
2. Removing deadlink bookmarks
3. Organizing bookmarks into AI-powered categories using TF-IDF + K-means clustering
4. Creating a `📁Organized/` folder for user review

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Chrome Extension                            │
├─────────────────────────────────────────────────────────────────┤
│  Popup (UI)                                                      │
│  ┌──────────────────┐                                            │
│  │ "Organize" btn   │ ──trigger──► Background Service Worker     │
│  │ Progress bar     │ ◄──events─── (orchestrator)                │
│  │ Status messages  │                                            │
│  └──────────────────┘                                            │
├─────────────────────────────────────────────────────────────────┤
│  Background Service Worker (orchestrator)                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Pipeline: Fetch → Dedupe → Categorize → Organize           ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  Modules                                                         │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌───────────┐        │
│  │ Fetcher  │ │  Deduper │ │ Categorizer│ │ Organizer │        │
│  │          │ │          │ │            │ │           │        │
│  │ -fetch   │ │ -normalize│ │ -TF-IDF    │ │ -create   │        │
│  │ -extract │ │ -dedupe   │ │ -cluster   │ │ -move     │        │
│  │ -deadlink│ │           │ │ -name      │ │ -folder   │        │
│  └──────────┘ └──────────┘ └────────────┘ └───────────┘        │
├─────────────────────────────────────────────────────────────────┤
│  Chrome APIs                                                     │
│  chrome.bookmarks │ chrome.tabs │ chrome.runtime │ fetch        │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
Input: User clicks "Organize"
         │
         ▼
┌─────────────────────┐
│  1. FETCH BOOKMARKS │
│  chrome.bookmarks   │
│  .getTree()         │
└─────────┬───────────┘
          │ RawBookmark[]
          ▼
┌─────────────────────┐
│  2. FETCHER MODULE  │
│  - fetch(url)       │
│  - extract meta     │
│  - extract headings │
│  - detect deadlink  │
└─────────┬───────────┘
          │ ProcessedBookmark[]
          ▼
┌─────────────────────┐
│  3. DEDUPER MODULE  │
│  - normalize URLs   │
│  - group by normURL │
│  - pick best title  │
└─────────┬───────────┘
          │ DedupedBookmark[]
          ▼
┌─────────────────────┐
│  4. CATEGORIZER     │
│  - build corpus     │
│  - TF-IDF vectorize │
│  - k-means cluster  │
│  - generate names   │
│  - sub-cluster >10  │
└─────────┬───────────┘
          │ CategorizedBookmark[]
          ▼
┌─────────────────────┐
│  5. ORGANIZER       │
│  - create folder    │
│  - create bookmarks │
└─────────┬───────────┘
          │
          ▼
Output: 📁Organized/ folder structure
```

## Data Types

```typescript
interface RawBookmark {
  id: string;
  url: string;
  title: string;
}

interface ProcessedBookmark extends RawBookmark {
  meta: {
    description?: string;
    ogTitle?: string;
    keywords?: string[];
  };
  headings: string[];
  status: 'ok' | 'deadlink' | 'unreachable';
  error?: string;
}

interface CategorizedBookmark extends ProcessedBookmark {
  category: string;
  subCategory?: string;
}
```

## Module Specifications

### 1. Fetcher Module

**Purpose:** Fetch each bookmark URL and extract metadata + headings

**Input:** `RawBookmark[]`

**Output:** `ProcessedBookmark[]`

**Process:**
```
for each bookmark (batch of 5, 500ms delay between batches):
  try:
    response = fetch(url, { method: 'GET', timeout: 30000 })
    
    if (response.status >= 400 && response.status < 500):
      // 4xx errors - definitive deadlink
      mark as deadlink
    else if (response.status >= 500):
      // 5xx errors - might be temporary
      mark as unreachable
    else:
      html = response.text()
      doc = DOMParser.parseFromString(html)
      meta = extract meta tags
      headings = extract h1-h6
      return { ...bookmark, meta, headings, status: 'ok' }
      
  catch error:
    if (error is timeout or network error):
      mark as unreachable
    else if (error is DNS failure):
      mark as deadlink
    return { ...bookmark, meta: {}, headings: [], status, error }
```

**Rate limiting:** 5 concurrent fetches, 500ms delay between batches

**Error classification:**
- `deadlink`: 404, 410, DNS failure (definitively gone)
- `unreachable`: timeout, 5xx, network error, SSL error (might be temporary)

### 2. Deduper Module

**Purpose:** Identify and merge duplicate bookmarks

**Input:** `ProcessedBookmark[]`

**Output:** `ProcessedBookmark[]` (deduplicated)

**URL normalization rules:**
```
normalize(url):
  1. lowercase
  2. remove protocol (http/https)
  3. remove 'www.'
  4. remove trailing slash
  5. sort query params alphabetically
  6. remove common tracking params (utm_*, ref, source, fbclid, gclid)
```

**Deduplication logic:**
```
grouped = groupBy(bookmarks, b => normalize(b.url))
for each group with >1 bookmark:
  pick best title (longest, or one with most info)
  keep first URL encountered
  discard duplicates
```

### 3. Categorizer Module

**Purpose:** Cluster bookmarks into categories using TF-IDF + K-means

**Input:** `ProcessedBookmark[]` (deduplicated)

**Output:** `CategorizedBookmark[]`

**Process:**

**Step 1: Build corpus**
```
for each bookmark:
  text = join([
    title,
    meta.description,
    meta.ogTitle,
    meta.keywords?.join(' '),
    headings.join(' ')
  ])
  corpus.push({ id: bookmark.id, text })
```

**Step 2: TF-IDF vectorization**
```
- tokenize text (lowercase, remove punctuation, split on whitespace)
- remove stop words (the, a, an, is, are, etc.)
- compute TF (term frequency) for each document
- compute IDF (inverse document frequency) across corpus
- build TF-IDF vector for each document
```

**Step 3: Determine cluster count**
```
k = min(15, max(3, sqrt(n / 2)))
// 3-15 categories based on bookmark count
```

**Step 4: K-means clustering**
```
- initialize k centroids (k-means++ for better init)
- assign each bookmark to nearest centroid
- recalculate centroids
- repeat until convergence or max iterations (100)
```

**Step 5: Generate category names (smart 1-2 words)**
```
for each cluster:
  topTerms = terms with highest TF-IDF scores in cluster centroid
  
  // Check for potential collision with other clusters
  if topTerms[0] is unique across clusters:
    categoryName = topTerms[0]  // 1 word
  else:
    categoryName = topTerms[0] + ' ' + topTerms[1]  // 2 words
    
  // Capitalize first letter
  categoryName = capitalize(categoryName)
```

**Step 6: Sub-category split**
```
for each cluster with >10 bookmarks:
  re-cluster just that cluster (k = max(2, n/8))
  generate sub-category names (same logic)
```

### 4. Organizer Module

**Purpose:** Create the `📁Organized/` folder structure

**Input:** `CategorizedBookmark[]` + failed bookmarks

**Process:**
```
1. DELETE existing 📁Organized/ folder if exists
   - search for folder named "📁Organized" at root level
   - chrome.bookmarks.removeTree() if found

2. CREATE root folder
   - chrome.bookmarks.create({ title: "📁Organized", parentId: "1" })

3. GROUP by category
   - categories = groupBy(bookmarks, b => b.category)

4. FOR each category:
   if (category has subCategories):
     create category folder
     for each subCategory:
       create sub-category folder
       create bookmarks inside
   else:
     create category folder
     create bookmarks inside

5. CREATE error folders (if any failures)
   - if deadlinks exist: create "⚠ Deadlinks/" folder
   - if unreachable exist: create "⚠ Unreachable/" folder
   - add failed bookmarks to respective folders

6. EMIT completion event with stats
```

**Output structure:**
```
📁Organized/
├── Development Tools/
│   ├── Git Github/
│   │   ├── GitHub - repo1
│   │   └── Git Tutorial
│   └── Javascript React/
│       ├── React Docs
│       └── TypeScript Guide
├── News/
│   ├── BBC Homepage
│   └── Reuters
├── Shopping/
│   └── Amazon Wishlist
├── ⚠ Deadlinks/
│   └── old-site.com (404)
└── ⚠ Unreachable/
    └── slow-server.com (timeout)
```

### 5. Popup Module (UI)

**UI States:**

**IDLE:**
```
┌─────────────────────────────────────┐
│  📚 Bookmark Tidy                   │
│                                     │
│  Ready to organize bookmarks        │
│                                     │
│  [ Organize Bookmarks ]             │
│                                     │
│  234 bookmarks found                │
└─────────────────────────────────────┘
```

**PROCESSING:**
```
┌─────────────────────────────────────┐
│  📚 Bookmark Tidy                   │
│                                     │
│  Processing bookmarks...            │
│                                     │
│  [████████░░░░░░░░░░] 45%           │
│                                     │
│  Fetching: example.com              │
│  89 of 234 processed                │
│                                     │
│  [ Cancel ]                         │
└─────────────────────────────────────┘
```

**COMPLETE:**
```
┌─────────────────────────────────────┐
│  📚 Bookmark Tidy                   │
│                                     │
│  ✅ Organization complete!          │
│                                     │
│  📊 Results:                        │
│  • 234 bookmarks processed          │
│  • 12 duplicates merged             │
│  • 8 deadlinks found                │
│  • 3 unreachable                    │
│  • 7 categories created             │
│                                     │
│  Check 📁Organized folder           │
│                                     │
│  [ Done ]                           │
└─────────────────────────────────────┘
```

## File Structure

```
bookmark-tidy/
├── manifest.json              # Extension manifest (V3)
├── package.json
├── tsconfig.json
├── vite.config.ts             # Build config
├── src/
│   ├── background/
│   │   └── index.ts           # Service worker (orchestrator)
│   ├── modules/
│   │   ├── fetcher.ts         # Fetch + extract content
│   │   ├── deduper.ts         # URL normalization + deduplication
│   │   ├── categorizer.ts     # TF-IDF + clustering
│   │   └── organizer.ts       # Create folder structure
│   ├── popup/
│   │   ├── index.ts           # Popup entry point
│   │   ├── popup.html
│   │   └── styles.css
│   ├── utils/
│   │   ├── url-normalizer.ts  # URL normalization helpers
│   │   └── stop-words.ts      # Stop word list
│   └── types/
│       └── index.ts           # TypeScript interfaces
├── dist/                      # Build output
└── docs/
    └── superpowers/
        └── specs/
```

## Chrome Extension Manifest

```json
{
  "manifest_version": 3,
  "name": "Bookmark Tidy",
  "version": "1.0.0",
  "description": "Organize and tidy up your Chrome bookmarks",
  "permissions": [
    "bookmarks"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background/index.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

**Permissions:**
- `bookmarks` - read/write bookmarks
- `host_permissions: ["<all_urls>"]` - fetch any URL (bypass CORS)

## Dependencies

```json
{
  "dependencies": {
    "natural": "^6.0.0",
    "ml-kmeans": "^5.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "@types/chrome": "^0.0.260"
  }
}
```

| Package | Purpose |
|---------|---------|
| `natural` | TF-IDF vectorization and tokenization |
| `ml-kmeans` | K-means clustering algorithm |

## Error Handling

| Scenario | Where | Handling |
|----------|-------|----------|
| No bookmarks found | Orchestrator | Show message "No bookmarks to organize" |
| All bookmarks fail | Organizer | Create empty `📁Organized/` with note |
| Fetch timeout (30s) | Fetcher | Mark as `unreachable`, continue |
| Invalid URL format | Fetcher | Mark as `unreachable`, continue |
| Rate limited (429) | Fetcher | Increase delay, retry once |
| User clicks Cancel | Popup | Set abort flag, stop after current batch |
| Extension context invalidated | Background | Graceful stop |

## Edge Cases

| Case | Handling |
|------|----------|
| Bookmarks bar, Other bookmarks | Process all, including nested folders |
| Empty bookmark folders | Ignore empty folders |
| Bookmark with no URL (folder) | Skip folders, only process URLs |
| Same URL different titles | Keep longest/most descriptive title |
| Non-ASCII characters in titles | Preserve Unicode, handle gracefully |
| Extremely long titles | Truncate category names to 50 chars |
| < 3 bookmarks total | Skip categorization, just dedupe/remove deadlinks |
| Single bookmark in category | Don't create sub-category |
| Circular redirect | Follow up to 5 redirects, then mark unreachable |

## Build & Development

**Commands:**
```bash
pnpm install        # Install dependencies
pnpm run dev        # Development (watch mode)
pnpm run build      # Build for production
pnpm run typecheck  # Type check
```

**Loading the extension:**
1. Run `pnpm run build`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select `dist/` folder

## Future Improvements

### Enhanced Content Extraction (Option A)

For better categorization quality, implement full content extraction:

**Approach:**
- Open each bookmark in a hidden tab
- Use Readability.js to extract main article content
- Provides 200-1000+ words per bookmark vs 50-200 with meta+headings

**Trade-offs:**
- Slower processing (need to load full pages)
- More resource-intensive
- Significantly better categorization for article-type content

**Implementation notes:**
- Use `chrome.tabs.create({ active: false })` for hidden tabs
- Inject content script to extract text
- Close tab after extraction
- Consider for v2 release
