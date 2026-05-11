# Bookmark Tidy - Specification

This is the technical specification for the Bookmark Tidy Chrome extension.

## Overview

A Chrome extension that organizes bookmarks by:
1. Merging duplicate bookmarks (normalized URL matching)
2. Removing deadlink bookmarks
3. Categorizing using TF-IDF + K-means clustering
4. Creating `📁Organized/` folder for user review

## Data Pipeline

```
RawBookmark[] → Fetcher → ProcessedBookmark[] → Deduper → ProcessedBookmark[] → Categorizer → CategorizedBookmark[] → Organizer → Chrome Bookmarks
```

## Types

```typescript
interface RawBookmark {
  id: string;
  url: string;
  title: string;
}

interface ProcessedBookmark extends RawBookmark {
  meta: { description?: string; ogTitle?: string; keywords?: string[] };
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

### 1. Fetcher

**Input:** `RawBookmark[]`
**Output:** `{ bookmarks: ProcessedBookmark[], deadlinks: ProcessedBookmark[], unreachable: ProcessedBookmark[] }`

**Process:**
- Fetch each URL with 30s timeout
- Extract: `<title>`, `<meta description>`, `<meta og:title>`, `<meta keywords>`, `<h1>-<h6>`
- Classify status:
  - `ok` - Successful fetch, valid content
  - `deadlink` - 404, 410, DNS failure (definitively gone)
  - `unreachable` - Timeout, 5xx, network error (might be temporary)
- Rate limit: 5 concurrent, 500ms between batches

### 2. Deduper

**Input:** `ProcessedBookmark[]`
**Output:** `{ bookmarks: ProcessedBookmark[], duplicatesMerged: number }`

**URL Normalization:**
1. Lowercase
2. Remove protocol (http/https)
3. Remove `www.`
4. Remove trailing slash
5. Sort query params alphabetically
6. Remove tracking params: `utm_*`, `ref`, `source`, `fbclid`, `gclid`

**Deduplication:**
- Group by normalized URL
- Keep longest title that doesn't look like a URL
- Discard duplicates

### 3. Categorizer

**Input:** `ProcessedBookmark[]`
**Output:** `CategorizedBookmark[]`

**Process:**
1. Build corpus: title (2x weight) + description + ogTitle + keywords (2x weight) + headings
2. TF-IDF vectorization (tokenize, remove stop words, compute TF-IDF)
3. Determine cluster count: `k = min(15, max(3, sqrt(n/2)))`
4. K-means clustering (k-means++ init, max 100 iterations)
5. Generate category names:
   - Get top TF-IDF terms from cluster centroid
   - Use 1 word if unique across clusters, else 2 words
   - Capitalize first letter
6. Sub-categories: If cluster >10 bookmarks, re-cluster with `k = max(2, n/8)`

### 4. Organizer

**Input:** `CategorizedBookmark[]`, deadlinks, unreachable
**Output:** Chrome bookmark tree

**Process:**
1. Delete existing `📁Organized/` folder
2. Create `📁Organized/` in "Other Bookmarks"
3. For each category:
   - If has sub-categories: create category folder → sub-category folders → bookmarks
   - Else: create category folder → bookmarks
4. If deadlinks: create `⚠ Deadlinks/` folder with bookmarks
5. If unreachable: create `⚠ Unreachable/` folder with bookmarks

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

## UI States

| State | Display |
|-------|---------|
| Idle | Title, "Organize Bookmarks" button, bookmark count |
| Processing | Progress bar, current URL, cancel button |
| Complete | Results stats, "Done" button |
| Error | Error message, "Try Again" button |

## Error Handling

| Scenario | Handling |
|----------|----------|
| No bookmarks | Show "No bookmarks found" error |
| All fail | Create empty `📁Organized/` |
| User cancels | Stop after current batch |
| Invalid URL | Mark as unreachable |

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `natural` | ^6.0.0 | TF-IDF, tokenization |
| `ml-kmeans` | ^5.0.0 | K-means clustering |

## Chrome Permissions

- `bookmarks` - Read/write bookmarks
- `host_permissions: ["<all_urls>"]` - Fetch any URL (bypass CORS)

## Future: Enhanced Content Extraction

For better categorization, implement hidden tab + Readability.js:
- Open bookmarks in hidden tabs
- Extract full article content
- Provides 200-1000+ words vs 50-200 with meta+headings
- Trade-off: slower, more resource-intensive
