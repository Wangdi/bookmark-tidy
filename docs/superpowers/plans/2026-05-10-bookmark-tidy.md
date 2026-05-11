# Bookmark Tidy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension that organizes bookmarks by merging duplicates, removing deadlinks, and categorizing using TF-IDF + K-means clustering.

**Architecture:** Modular design with separate modules for fetching, deduplication, categorization, and organization. Background service worker orchestrates the pipeline. Popup provides UI for triggering and progress display.

**Tech Stack:** TypeScript, Vite, Chrome Extension Manifest V3, natural (TF-IDF), ml-kmeans (clustering)

---

## Task 1: Project Setup & Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `manifest.json`
- Create: `src/types/index.ts`

- [ ] **Step 1: Initialize project with package.json**

```bash
pnpm init
```

- [ ] **Step 2: Install dependencies**

```bash
pnpm add natural ml-kmeans
pnpm add -D typescript vite @types/chrome @crxjs/vite-plugin
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
```

- [ ] **Step 5: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "Bookmark Tidy",
  "version": "1.0.0",
  "description": "Organize and tidy up your Chrome bookmarks",
  "permissions": ["bookmarks"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "src/background/index.ts",
    "type": "module"
  },
  "action": {
    "default_popup": "src/popup/popup.html",
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

- [ ] **Step 6: Create types/index.ts**

```typescript
export interface RawBookmark {
  id: string;
  url: string;
  title: string;
  parentId?: string;
}

export interface BookmarkMeta {
  description?: string;
  ogTitle?: string;
  keywords?: string[];
}

export interface ProcessedBookmark extends RawBookmark {
  meta: BookmarkMeta;
  headings: string[];
  status: 'ok' | 'deadlink' | 'unreachable';
  error?: string;
}

export interface CategorizedBookmark extends ProcessedBookmark {
  category: string;
  subCategory?: string;
}

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
}

export interface OrganizerState {
  isRunning: boolean;
  shouldAbort: boolean;
}

export interface ClusterResult {
  bookmarks: CategorizedBookmark[];
  categoryNames: string[];
}
```

- [ ] **Step 7: Create icons directory with placeholder icons**

```bash
mkdir -p public/icons
```

Create a simple placeholder icon (you'll need actual icons later):
```bash
# Create placeholder icon files (replace with actual icons later)
touch public/icons/icon16.png
touch public/icons/icon48.png
touch public/icons/icon128.png
```

- [ ] **Step 8: Add scripts to package.json**

Add to `package.json`:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json vite.config.ts manifest.json src/types/index.ts
git commit -m "chore: initial project setup with TypeScript, Vite, and Chrome Extension config"
```

---

## Task 2: URL Normalizer Utility

**Files:**
- Create: `src/utils/url-normalizer.ts`
- Create: `src/utils/stop-words.ts`

- [ ] **Step 1: Create URL normalizer**

```typescript
// src/utils/url-normalizer.ts

const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'ref',
  'source',
  'fbclid',
  'gclid',
  'msclkid',
];

/**
 * Normalize a URL for deduplication purposes
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // 1. lowercase
    let normalized = parsed.hostname.toLowerCase();

    // 2. remove www.
    normalized = normalized.replace(/^www\./, '');

    // 3. remove protocol (already done by using hostname)

    // 4. add path (remove trailing slash)
    let path = parsed.pathname;
    if (path.endsWith('/') && path.length > 1) {
      path = path.slice(0, -1);
    }
    normalized += path;

    // 5. sort query params and remove tracking params
    const params = new URLSearchParams(parsed.search);
    const filteredParams: string[] = [];

    params.forEach((value, key) => {
      if (!TRACKING_PARAMS.includes(key.toLowerCase())) {
        filteredParams.push(`${key}=${value}`);
      }
    });

    if (filteredParams.length > 0) {
      filteredParams.sort();
      normalized += '?' + filteredParams.join('&');
    }

    // 6. add hash if present
    if (parsed.hash) {
      normalized += parsed.hash;
    }

    return normalized;
  } catch {
    // Invalid URL, return as-is
    return url.toLowerCase();
  }
}

/**
 * Check if a URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}
```

- [ ] **Step 2: Create stop words list**

```typescript
// src/utils/stop-words.ts

/**
 * Common English stop words to filter out during TF-IDF
 */
export const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
  'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his',
  'our', 'their', 'what', 'which', 'who', 'whom', 'when', 'where', 'why',
  'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then', 'once',
  'if', 'because', 'while', 'after', 'before', 'until', 'about', 'into',
  'through', 'during', 'above', 'below', 'between', 'under', 'again',
  'further', 'any', 'up', 'down', 'out', 'off', 'over', 'under',
  // Common web-specific words
  'http', 'https', 'www', 'com', 'org', 'net', 'html', 'php', 'asp',
  'page', 'pages', 'home', 'site', 'website', 'web', 'link', 'links',
  'click', 'here', 'new', 'old', 'read', 'more', 'view', 'share', 'like',
  'follow', 'subscribe', 'contact', 'privacy', 'policy', 'terms', 'search',
  'login', 'sign', 'register', 'menu', 'navigation', 'skip', 'content',
]);
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/url-normalizer.ts src/utils/stop-words.ts
git commit -m "feat: add URL normalizer and stop words utilities"
```

---

## Task 3: Deduper Module

**Files:**
- Create: `src/modules/deduper.ts`

- [ ] **Step 1: Create deduper module**

```typescript
// src/modules/deduper.ts

import { ProcessedBookmark } from '../types';
import { normalizeUrl } from '../utils/url-normalizer';

/**
 * Result of deduplication
 */
export interface DeduperResult {
  bookmarks: ProcessedBookmark[];
  duplicatesMerged: number;
  duplicateGroups: Map<string, ProcessedBookmark[]>;
}

/**
 * Pick the best title from a group of duplicate bookmarks
 * Strategy: prefer longest title that doesn't look like a URL
 */
function pickBestTitle(bookmarks: ProcessedBookmark[]): string {
  const sorted = [...bookmarks].sort((a, b) => {
    // Prefer titles that don't look like URLs
    const aIsUrl = a.title.includes('://') || a.title.startsWith('www.');
    const bIsUrl = b.title.includes('://') || b.title.startsWith('www.');

    if (aIsUrl && !bIsUrl) return 1;
    if (!aIsUrl && bIsUrl) return -1;

    // Otherwise, prefer longer titles
    return b.title.length - a.title.length;
  });

  return sorted[0].title;
}

/**
 * Deduplicate bookmarks based on normalized URLs
 */
export function dedupeBookmarks(bookmarks: ProcessedBookmark[]): DeduperResult {
  const groups = new Map<string, ProcessedBookmark[]>();

  // Group by normalized URL
  for (const bookmark of bookmarks) {
    const normUrl = normalizeUrl(bookmark.url);

    if (!groups.has(normUrl)) {
      groups.set(normUrl, []);
    }
    groups.get(normUrl)!.push(bookmark);
  }

  // Process each group
  const deduplicated: ProcessedBookmark[] = [];
  let duplicatesMerged = 0;

  for (const [, group] of groups) {
    if (group.length === 1) {
      deduplicated.push(group[0]);
    } else {
      // Pick the best title and keep the first URL
      const bestTitle = pickBestTitle(group);
      const representative = { ...group[0], title: bestTitle };
      deduplicated.push(representative);
      duplicatesMerged += group.length - 1;
    }
  }

  return {
    bookmarks: deduplicated,
    duplicatesMerged,
    duplicateGroups: groups,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/deduper.ts
git commit -m "feat: add deduper module for URL normalization and deduplication"
```

---

## Task 4: Fetcher Module

**Files:**
- Create: `src/modules/fetcher.ts`

- [ ] **Step 1: Create fetcher module**

```typescript
// src/modules/fetcher.ts

import { RawBookmark, ProcessedBookmark, BookmarkMeta } from '../types';
import { isValidUrl } from '../utils/url-normalizer';

const FETCH_TIMEOUT = 30000; // 30 seconds
const BATCH_SIZE = 5;
const BATCH_DELAY = 500; // 500ms between batches

export interface FetcherOptions {
  onProgress?: (current: number, total: number, url: string) => void;
  shouldAbort?: () => boolean;
}

export interface FetcherResult {
  bookmarks: ProcessedBookmark[];
  deadlinks: ProcessedBookmark[];
  unreachable: ProcessedBookmark[];
}

/**
 * Extract metadata and headings from HTML content
 */
function extractContent(html: string): { meta: BookmarkMeta; headings: string[] } {
  const meta: BookmarkMeta = {};
  const headings: string[] = [];

  // Simple regex-based extraction (works in service worker without DOM)
  // Extract meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
  if (descMatch) {
    meta.description = descMatch[1];
  }

  // Extract og:title
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
  if (ogTitleMatch) {
    meta.ogTitle = ogTitleMatch[1];
  }

  // Extract keywords
  const keywordsMatch = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']*)["']/i);
  if (keywordsMatch) {
    meta.keywords = keywordsMatch[1].split(',').map(k => k.trim()).filter(k => k);
  }

  // Extract headings (h1-h6)
  const headingRegex = /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi;
  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    // Strip HTML tags from heading content
    const text = match[1].replace(/<[^>]*>/g, '').trim();
    if (text) {
      headings.push(text);
    }
  }

  // Also extract title tag
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  if (titleMatch) {
    // Add title as a heading if not already present
    const titleText = titleMatch[1].trim();
    if (titleText && !headings.includes(titleText)) {
      headings.unshift(titleText);
    }
  }

  return { meta, headings };
}

/**
 * Determine if an error indicates a deadlink vs unreachable
 */
function classifyError(error: Error): 'deadlink' | 'unreachable' {
  const message = error.message.toLowerCase();

  // DNS failures, 404s, 410s are definitive deadlinks
  if (
    message.includes('enotfound') ||
    message.includes('dns') ||
    message.includes('404') ||
    message.includes('410') ||
    message.includes('name not resolved')
  ) {
    return 'deadlink';
  }

  // Everything else is potentially temporary
  return 'unreachable';
}

/**
 * Fetch a single bookmark with timeout
 */
async function fetchBookmark(bookmark: RawBookmark): Promise<ProcessedBookmark> {
  // Validate URL first
  if (!isValidUrl(bookmark.url)) {
    return {
      ...bookmark,
      meta: {},
      headings: [],
      status: 'unreachable',
      error: 'Invalid URL format',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(bookmark.url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    // Check status code
    if (response.status >= 400 && response.status < 500) {
      // 4xx errors - definitive deadlink
      return {
        ...bookmark,
        meta: {},
        headings: [],
        status: 'deadlink',
        error: `${response.status} ${response.statusText}`,
      };
    }

    if (response.status >= 500) {
      // 5xx errors - might be temporary
      return {
        ...bookmark,
        meta: {},
        headings: [],
        status: 'unreachable',
        error: `${response.status} ${response.statusText}`,
      };
    }

    // Extract content from HTML
    const html = await response.text();
    const { meta, headings } = extractContent(html);

    return {
      ...bookmark,
      meta,
      headings,
      status: 'ok',
    };
  } catch (error) {
    clearTimeout(timeoutId);

    const status = classifyError(error as Error);
    return {
      ...bookmark,
      meta: {},
      headings: [],
      status,
      error: (error as Error).message,
    };
  }
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch all bookmarks with rate limiting
 */
export async function fetchBookmarks(
  bookmarks: RawBookmark[],
  options: FetcherOptions = {}
): Promise<FetcherResult> {
  const result: FetcherResult = {
    bookmarks: [],
    deadlinks: [],
    unreachable: [],
  };

  const total = bookmarks.length;

  // Process in batches
  for (let i = 0; i < bookmarks.length; i += BATCH_SIZE) {
    // Check for abort
    if (options.shouldAbort?.()) {
      break;
    }

    const batch = bookmarks.slice(i, i + BATCH_SIZE);

    // Fetch batch concurrently
    const batchResults = await Promise.all(
      batch.map(async (bookmark) => {
        options.onProgress?.(i + batch.indexOf(bookmark) + 1, total, bookmark.url);
        return fetchBookmark(bookmark);
      })
    );

    // Sort results
    for (const processed of batchResults) {
      if (processed.status === 'ok') {
        result.bookmarks.push(processed);
      } else if (processed.status === 'deadlink') {
        result.deadlinks.push(processed);
      } else {
        result.unreachable.push(processed);
      }
    }

    // Delay between batches (except for last batch)
    if (i + BATCH_SIZE < bookmarks.length) {
      await sleep(BATCH_DELAY);
    }
  }

  return result;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/fetcher.ts
git commit -m "feat: add fetcher module for fetching and extracting bookmark content"
```

---

## Task 5: Categorizer Module

**Files:**
- Create: `src/modules/categorizer.ts`

- [ ] **Step 1: Create categorizer module**

```typescript
// src/modules/categorizer.ts

import { ProcessedBookmark, CategorizedBookmark } from '../types';
import { STOP_WORDS } from '../utils/stop-words';
import natural from 'natural';
import kmeans from 'ml-kmeans';

const { TfIdf } = natural;

const MAX_CATEGORIES = 15;
const MIN_CATEGORIES = 3;
const SUB_CATEGORY_THRESHOLD = 10;
const MAX_CATEGORY_NAME_LENGTH = 50;

export interface CategorizerResult {
  bookmarks: CategorizedBookmark[];
  categoryNames: string[];
}

/**
 * Build text corpus from bookmarks
 */
function buildCorpus(bookmarks: ProcessedBookmark[]): string[] {
  return bookmarks.map(bookmark => {
    const parts: string[] = [];

    // Add title (weighted more by repeating)
    if (bookmark.title) {
      parts.push(bookmark.title);
      parts.push(bookmark.title); // Double weight for title
    }

    // Add meta description
    if (bookmark.meta.description) {
      parts.push(bookmark.meta.description);
    }

    // Add OG title
    if (bookmark.meta.ogTitle) {
      parts.push(bookmark.meta.ogTitle);
    }

    // Add keywords (weighted)
    if (bookmark.meta.keywords && bookmark.meta.keywords.length > 0) {
      parts.push(bookmark.meta.keywords.join(' '));
      parts.push(bookmark.meta.keywords.join(' ')); // Double weight
    }

    // Add headings
    if (bookmark.headings.length > 0) {
      parts.push(bookmark.headings.join(' '));
    }

    return parts.join(' ');
  });
}

/**
 * Tokenize and clean text
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Compute optimal number of clusters
 */
function computeClusterCount(n: number): number {
  return Math.min(MAX_CATEGORIES, Math.max(MIN_CATEGORIES, Math.ceil(Math.sqrt(n / 2))));
}

/**
 * Generate category name from cluster terms
 */
function generateCategoryName(topTerms: string[], allTopTerms: string[][]): string {
  if (topTerms.length === 0) {
    return 'Uncategorized';
  }

  // Check if first term is unique across all clusters
  const firstTerm = topTerms[0];
  const firstTermCount = allTopTerms.filter(terms => terms[0] === firstTerm).length;

  let name: string;
  if (firstTermCount === 1 && firstTerm) {
    // Unique first term - use single word
    name = firstTerm;
  } else if (topTerms.length > 1) {
    // Not unique - use two words
    name = `${topTerms[0]} ${topTerms[1]}`;
  } else {
    name = firstTerm || 'Uncategorized';
  }

  // Capitalize first letter of each word
  name = name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Truncate if too long
  if (name.length > MAX_CATEGORY_NAME_LENGTH) {
    name = name.substring(0, MAX_CATEGORY_NAME_LENGTH);
  }

  return name;
}

/**
 * Get top terms from a cluster centroid
 */
function getTopTerms(tfidf: InstanceType<typeof TfIdf>, docIndices: number[], topN: number = 3): string[] {
  // Collect all terms from documents in this cluster
  const termScores = new Map<string, number>();

  for (const docIndex of docIndices) {
    const terms = tfidf.listTerms(docIndex);
    for (const term of terms.slice(0, 20)) {
      const current = termScores.get(term.term) || 0;
      termScores.set(term.term, current + term.tfidf);
    }
  }

  // Sort by score and return top N
  return Array.from(termScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([term]) => term);
}

/**
 * Build TF-IDF vectors for clustering
 */
function buildVectors(tfidf: InstanceType<typeof TfIdf>, numDocs: number, vocabulary: string[]): number[][] {
  const vectors: number[][] = [];

  for (let i = 0; i < numDocs; i++) {
    const vector: number[] = [];
    const termScores = new Map<string, number>();

    tfidf.listTerms(i).forEach(item => {
      termScores.set(item.term, item.tfidf);
    });

    for (const term of vocabulary) {
      vector.push(termScores.get(term) || 0);
    }

    vectors.push(vector);
  }

  return vectors;
}

/**
 * Categorize bookmarks using TF-IDF and K-means clustering
 */
export function categorizeBookmarks(bookmarks: ProcessedBookmark[]): CategorizerResult {
  if (bookmarks.length < MIN_CATEGORIES) {
    // Not enough bookmarks for meaningful categorization
    return {
      bookmarks: bookmarks.map(b => ({ ...b, category: 'Bookmarks' })),
      categoryNames: ['Bookmarks'],
    };
  }

  // Build corpus
  const corpus = buildCorpus(bookmarks);

  // Compute TF-IDF
  const tfidf = new TfIdf();
  corpus.forEach(doc => {
    const tokens = tokenize(doc);
    tfidf.addDocument(tokens.join(' '));
  });

  // Build vocabulary
  const vocabulary = new Set<string>();
  for (let i = 0; i < corpus.length; i++) {
    tfidf.listTerms(i).forEach(item => vocabulary.add(item.term));
  }
  const vocabArray = Array.from(vocabulary);

  // Build vectors for clustering
  const vectors = buildVectors(tfidf, bookmarks.length, vocabArray);

  // Determine cluster count
  const k = computeClusterCount(bookmarks.length);

  // Run K-means clustering
  const result = kmeans(vectors, k, {
    initialization: 'kmeans++',
    maxIterations: 100,
  });

  // Group bookmarks by cluster
  const clusterGroups: number[][] = Array.from({ length: k }, () => []);
  result.clusters.forEach((clusterIndex, docIndex) => {
    clusterGroups[clusterIndex].push(docIndex);
  });

  // Get top terms for each cluster
  const allTopTerms = clusterGroups.map(indices => getTopTerms(tfidf, indices, 5));

  // Generate category names
  const categoryNames = allTopTerms.map(terms => generateCategoryName(terms, allTopTerms));

  // Assign categories to bookmarks
  const categorized: CategorizedBookmark[] = bookmarks.map((bookmark, index) => {
    const clusterIndex = result.clusters[index];
    const category = categoryNames[clusterIndex];

    return {
      ...bookmark,
      category,
    };
  });

  // Process sub-categories for large clusters
  const subCategorized = processSubCategories(categorized, tfidf, vocabArray);

  return {
    bookmarks: subCategorized,
    categoryNames,
  };
}

/**
 * Process sub-categories for clusters with more than threshold bookmarks
 */
function processSubCategories(
  bookmarks: CategorizedBookmark[],
  parentTfidf: InstanceType<typeof TfIdf>,
  parentVocab: string[]
): CategorizedBookmark[] {
  // Group by category
  const categoryGroups = new Map<string, CategorizedBookmark[]>();
  for (const bookmark of bookmarks) {
    if (!categoryGroups.has(bookmark.category)) {
      categoryGroups.set(bookmark.category, []);
    }
    categoryGroups.get(bookmark.category)!.push(bookmark);
  }

  const result: CategorizedBookmark[] = [];

  for (const [category, group] of categoryGroups) {
    if (group.length > SUB_CATEGORY_THRESHOLD) {
      // Re-cluster this group for sub-categories
      const subK = Math.max(2, Math.ceil(group.length / 8));

      // Build vectors for this group
      const groupIndices = group.map(b => bookmarks.indexOf(b));
      const groupVectors = groupIndices.map(i => {
        const termScores = new Map<string, number>();
        parentTfidf.listTerms(i).forEach(item => {
          termScores.set(item.term, item.tfidf);
        });
        return parentVocab.map(term => termScores.get(term) || 0);
      });

      // Cluster
      const subResult = kmeans(groupVectors, subK, {
        initialization: 'kmeans++',
        maxIterations: 50,
      });

      // Generate sub-category names
      const subClusterGroups: number[][] = Array.from({ length: subK }, () => []);
      subResult.clusters.forEach((clusterIndex, localIndex) => {
        subClusterGroups[clusterIndex].push(localIndex);
      });

      const subTopTerms = subClusterGroups.map(indices => {
        const termScores = new Map<string, number>();
        for (const localIndex of indices) {
          const terms = parentTfidf.listTerms(groupIndices[localIndex]);
          for (const term of terms.slice(0, 10)) {
            const current = termScores.get(term.term) || 0;
            termScores.set(term.term, current + term.tfidf);
          }
        }
        return Array.from(termScores.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([term]) => term);
      });

      const subCategoryNames = subTopTerms.map(terms => generateCategoryName(terms, subTopTerms));

      // Assign sub-categories
      group.forEach((bookmark, localIndex) => {
        const subClusterIndex = subResult.clusters[localIndex];
        result.push({
          ...bookmark,
          subCategory: subCategoryNames[subClusterIndex],
        });
      });
    } else {
      // No sub-category needed
      result.push(...group);
    }
  }

  return result;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/categorizer.ts
git commit -m "feat: add categorizer module with TF-IDF and K-means clustering"
```

---

## Task 6: Organizer Module

**Files:**
- Create: `src/modules/organizer.ts`

- [ ] **Step 1: Create organizer module**

```typescript
// src/modules/organizer.ts

import { CategorizedBookmark, ProcessedBookmark } from '../types';

const ORGANIZED_FOLDER_NAME = '📁Organized';
const DEADLINKS_FOLDER_NAME = '⚠ Deadlinks';
const UNREACHABLE_FOLDER_NAME = '⚠ Unreachable';

export interface OrganizerResult {
  success: boolean;
  stats: {
    processed: number;
    duplicatesMerged: number;
    deadlinks: number;
    unreachable: number;
    categories: number;
  };
}

/**
 * Find existing organized folder
 */
async function findOrganizedFolder(): Promise<chrome.bookmarks.BookmarkTreeNode | null> {
  const tree = await chrome.bookmarks.getTree();
  const root = tree[0];

  // Search in root level children (Bookmarks Bar, Other Bookmarks, etc.)
  for (const rootChild of root.children || []) {
    const found = searchFolder(rootChild, ORGANIZED_FOLDER_NAME);
    if (found) return found;
  }

  return null;
}

/**
 * Recursively search for a folder by name
 */
function searchFolder(node: chrome.bookmarks.BookmarkTreeNode, name: string): chrome.bookmarks.BookmarkTreeNode | null {
  if (node.title === name && !node.url) {
    return node;
  }

  for (const child of node.children || []) {
    const found = searchFolder(child, name);
    if (found) return found;
  }

  return null;
}

/**
 * Delete existing organized folder
 */
async function deleteOrganizedFolder(): Promise<void> {
  const existing = await findOrganizedFolder();
  if (existing && existing.id) {
    await chrome.bookmarks.removeTree(existing.id);
  }
}

/**
 * Get the "Other Bookmarks" folder ID (usually "1")
 */
async function getOtherBookmarksFolderId(): Promise<string> {
  const tree = await chrome.bookmarks.getTree();
  const root = tree[0];

  // Find "Other Bookmarks" folder
  for (const child of root.children || []) {
    // Usually "Other Bookmarks" has id "2" but let's find it by checking
    if (child.id === '2' || child.title === 'Other Bookmarks' || child.title === 'Other bookmarks') {
      return child.id;
    }
  }

  // Fallback to Bookmarks Bar
  return '1';
}

/**
 * Create a bookmark folder
 */
async function createFolder(title: string, parentId: string): Promise<chrome.bookmarks.BookmarkTreeNode> {
  return chrome.bookmarks.create({
    title,
    parentId,
  });
}

/**
 * Create a bookmark
 */
async function createBookmark(
  title: string,
  url: string,
  parentId: string
): Promise<chrome.bookmarks.BookmarkTreeNode> {
  return chrome.bookmarks.create({
    title,
    url,
    parentId,
  });
}

/**
 * Organize bookmarks into folder structure
 */
export async function organizeBookmarks(
  categorizedBookmarks: CategorizedBookmark[],
  deadlinks: ProcessedBookmark[],
  unreachable: ProcessedBookmark[],
  duplicatesMerged: number
): Promise<OrganizerResult> {
  // Delete existing organized folder
  await deleteOrganizedFolder();

  // Get parent folder for our organized folder
  const parentId = await getOtherBookmarksFolderId();

  // Create root organized folder
  const organizedFolder = await createFolder(ORGANIZED_FOLDER_NAME, parentId);

  // Group categorized bookmarks by category
  const categoryGroups = new Map<string, Map<string, CategorizedBookmark[]>>();

  for (const bookmark of categorizedBookmarks) {
    if (!categoryGroups.has(bookmark.category)) {
      categoryGroups.set(bookmark.category, new Map());
    }

    const subCategory = bookmark.subCategory || '__none__';
    if (!categoryGroups.get(bookmark.category)!.has(subCategory)) {
      categoryGroups.get(bookmark.category)!.set(subCategory, []);
    }
    categoryGroups.get(bookmark.category)!.get(subCategory)!.push(bookmark);
  }

  // Create category folders and bookmarks
  for (const [category, subGroups] of categoryGroups) {
    const hasSubCategories = subGroups.size > 1 || subGroups.has('__none__') === false;

    if (hasSubCategories && subGroups.size > 1) {
      // Create category folder with sub-categories
      const categoryFolder = await createFolder(category, organizedFolder.id);

      for (const [subCategory, bookmarks] of subGroups) {
        if (subCategory === '__none__') {
          // Bookmarks without sub-category go directly in category folder
          for (const bookmark of bookmarks) {
            await createBookmark(bookmark.title, bookmark.url, categoryFolder.id);
          }
        } else {
          // Create sub-category folder
          const subFolder = await createFolder(subCategory, categoryFolder.id);

          for (const bookmark of bookmarks) {
            await createBookmark(bookmark.title, bookmark.url, subFolder.id);
          }
        }
      }
    } else {
      // Create category folder directly
      const categoryFolder = await createFolder(category, organizedFolder.id);

      const allBookmarks = Array.from(subGroups.values()).flat();
      for (const bookmark of allBookmarks) {
        await createBookmark(bookmark.title, bookmark.url, categoryFolder.id);
      }
    }
  }

  // Create deadlinks folder if needed
  if (deadlinks.length > 0) {
    const deadlinksFolder = await createFolder(DEADLINKS_FOLDER_NAME, organizedFolder.id);

    for (const bookmark of deadlinks) {
      const title = bookmark.error
        ? `${bookmark.title} (${bookmark.error})`
        : bookmark.title;
      await createBookmark(title, bookmark.url, deadlinksFolder.id);
    }
  }

  // Create unreachable folder if needed
  if (unreachable.length > 0) {
    const unreachableFolder = await createFolder(UNREACHABLE_FOLDER_NAME, organizedFolder.id);

    for (const bookmark of unreachable) {
      const title = bookmark.error
        ? `${bookmark.title} (${bookmark.error})`
        : bookmark.title;
      await createBookmark(title, bookmark.url, unreachableFolder.id);
    }
  }

  // Calculate stats
  const uniqueCategories = new Set(categorizedBookmarks.map(b => b.category));

  return {
    success: true,
    stats: {
      processed: categorizedBookmarks.length + deadlinks.length + unreachable.length,
      duplicatesMerged,
      deadlinks: deadlinks.length,
      unreachable: unreachable.length,
      categories: uniqueCategories.size,
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/organizer.ts
git commit -m "feat: add organizer module for creating folder structure"
```

---

## Task 7: Background Service Worker

**Files:**
- Create: `src/background/index.ts`

- [ ] **Step 1: Create background service worker**

```typescript
// src/background/index.ts

import { RawBookmark, ProgressEvent, OrganizerState } from '../types';
import { fetchBookmarks } from '../modules/fetcher';
import { dedupeBookmarks } from '../modules/deduper';
import { categorizeBookmarks } from '../modules/categorizer';
import { organizeBookmarks } from '../modules/organizer';

const state: OrganizerState = {
  isRunning: false,
  shouldAbort: false,
};

/**
 * Get all bookmarks from Chrome
 */
async function getAllBookmarks(): Promise<RawBookmark[]> {
  const tree = await chrome.bookmarks.getTree();
  const bookmarks: RawBookmark[] = [];

  function traverse(node: chrome.bookmarks.BookmarkTreeNode) {
    if (node.url) {
      // It's a bookmark (not a folder)
      bookmarks.push({
        id: node.id,
        url: node.url,
        title: node.title,
        parentId: node.parentId,
      });
    }

    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  for (const root of tree) {
    traverse(root);
  }

  return bookmarks;
}

/**
 * Send progress event to popup
 */
async function sendProgress(event: ProgressEvent): Promise<void> {
  try {
    await chrome.runtime.sendMessage(event);
  } catch {
    // Popup might be closed, ignore
  }
}

/**
 * Run the organization pipeline
 */
async function runOrganization(): Promise<void> {
  if (state.isRunning) {
    return;
  }

  state.isRunning = true;
  state.shouldAbort = false;

  try {
    // Step 1: Get all bookmarks
    const rawBookmarks = await getAllBookmarks();

    if (rawBookmarks.length === 0) {
      await sendProgress({
        type: 'error',
        current: 0,
        total: 0,
        error: 'No bookmarks found',
      });
      return;
    }

    const total = rawBookmarks.length;

    // Step 2: Fetch all bookmarks
    await sendProgress({
      type: 'progress',
      current: 0,
      total,
      currentUrl: 'Starting...',
    });

    const fetchResult = await fetchBookmarks(rawBookmarks, {
      onProgress: async (current, total, url) => {
        await sendProgress({
          type: 'progress',
          current,
          total,
          currentUrl: url,
        });
      },
      shouldAbort: () => state.shouldAbort,
    });

    if (state.shouldAbort) {
      await sendProgress({
        type: 'error',
        current: 0,
        total: 0,
        error: 'Operation cancelled',
      });
      return;
    }

    // Step 3: Deduplicate
    const dedupeResult = dedupeBookmarks(fetchResult.bookmarks);

    // Step 4: Categorize
    const categorizeResult = categorizeBookmarks(dedupeResult.bookmarks);

    // Step 5: Organize
    const organizeResult = await organizeBookmarks(
      categorizeResult.bookmarks,
      fetchResult.deadlinks,
      fetchResult.unreachable,
      dedupeResult.duplicatesMerged
    );

    // Send completion
    await sendProgress({
      type: 'complete',
      current: total,
      total,
      stats: organizeResult.stats,
    });
  } catch (error) {
    await sendProgress({
      type: 'error',
      current: 0,
      total: 0,
      error: (error as Error).message,
    });
  } finally {
    state.isRunning = false;
    state.shouldAbort = false;
  }
}

/**
 * Cancel running operation
 */
function cancelOperation(): void {
  state.shouldAbort = true;
}

/**
 * Get current state
 */
function getState(): OrganizerState {
  return { ...state };
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'START_ORGANIZE') {
    runOrganization();
    sendResponse({ success: true });
  } else if (message.type === 'CANCEL') {
    cancelOperation();
    sendResponse({ success: true });
  } else if (message.type === 'GET_STATE') {
    sendResponse(getState());
  }
  return true; // Keep message channel open for async response
});

// Log when service worker starts
console.log('Bookmark Tidy service worker started');
```

- [ ] **Step 2: Commit**

```bash
git add src/background/index.ts
git commit -m "feat: add background service worker as orchestrator"
```

---

## Task 8: Popup UI

**Files:**
- Create: `src/popup/popup.html`
- Create: `src/popup/styles.css`
- Create: `src/popup/index.ts`

- [ ] **Step 1: Create popup HTML**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bookmark Tidy</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <div id="app">
    <!-- IDLE State -->
    <div id="idle-state" class="state">
      <h1>📚 Bookmark Tidy</h1>
      <p class="status-text">Ready to organize bookmarks</p>
      <button id="start-btn" class="btn primary">Organize Bookmarks</button>
      <p id="bookmark-count" class="count-text"></p>
    </div>

    <!-- PROCESSING State -->
    <div id="processing-state" class="state hidden">
      <h1>📚 Bookmark Tidy</h1>
      <p class="status-text">Processing bookmarks...</p>
      <div class="progress-container">
        <div id="progress-bar" class="progress-bar"></div>
      </div>
      <p id="progress-text" class="progress-text">0%</p>
      <p id="current-url" class="current-url"></p>
      <p id="progress-count" class="count-text"></p>
      <button id="cancel-btn" class="btn secondary">Cancel</button>
    </div>

    <!-- COMPLETE State -->
    <div id="complete-state" class="state hidden">
      <h1>📚 Bookmark Tidy</h1>
      <p class="status-text success">✅ Organization complete!</p>
      <div class="results">
        <h3>📊 Results:</h3>
        <ul id="results-list"></ul>
      </div>
      <p class="folder-hint">Check 📁Organized folder</p>
      <button id="done-btn" class="btn primary">Done</button>
    </div>

    <!-- ERROR State -->
    <div id="error-state" class="state hidden">
      <h1>📚 Bookmark Tidy</h1>
      <p class="status-text error">❌ Error</p>
      <p id="error-message" class="error-message"></p>
      <button id="retry-btn" class="btn primary">Try Again</button>
    </div>
  </div>

  <script type="module" src="./index.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Create popup CSS**

```css
/* src/popup/styles.css */

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  width: 320px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: #f5f5f5;
  color: #333;
}

#app {
  padding: 20px;
}

.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.state.hidden {
  display: none;
}

h1 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 16px;
}

.status-text {
  font-size: 14px;
  color: #666;
  margin-bottom: 20px;
}

.status-text.success {
  color: #2e7d32;
  font-weight: 500;
}

.status-text.error {
  color: #c62828;
  font-weight: 500;
}

.btn {
  width: 100%;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn.primary {
  background: #1a73e8;
  color: white;
}

.btn.primary:hover {
  background: #1557b0;
}

.btn.secondary {
  background: #e0e0e0;
  color: #333;
}

.btn.secondary:hover {
  background: #d0d0d0;
}

.count-text {
  font-size: 12px;
  color: #888;
  margin-top: 12px;
}

.progress-container {
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-bar {
  height: 100%;
  background: #1a73e8;
  border-radius: 4px;
  width: 0%;
  transition: width 0.2s;
}

.progress-text {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 8px;
}

.current-url {
  font-size: 12px;
  color: #666;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 8px;
}

.results {
  width: 100%;
  text-align: left;
  background: white;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.results h3 {
  font-size: 14px;
  margin-bottom: 12px;
}

.results ul {
  list-style: none;
}

.results li {
  font-size: 13px;
  padding: 4px 0;
  border-bottom: 1px solid #eee;
}

.results li:last-child {
  border-bottom: none;
}

.folder-hint {
  font-size: 12px;
  color: #666;
  margin-bottom: 16px;
}

.error-message {
  font-size: 13px;
  color: #c62828;
  background: #ffebee;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
  word-wrap: break-word;
}
```

- [ ] **Step 3: Create popup TypeScript**

```typescript
// src/popup/index.ts

import { ProgressEvent } from '../types';

// DOM Elements
const idleState = document.getElementById('idle-state')!;
const processingState = document.getElementById('processing-state')!;
const completeState = document.getElementById('complete-state')!;
const errorState = document.getElementById('error-state')!;

const startBtn = document.getElementById('start-btn')!;
const cancelBtn = document.getElementById('cancel-btn')!;
const doneBtn = document.getElementById('done-btn')!;
const retryBtn = document.getElementById('retry-btn')!;

const bookmarkCount = document.getElementById('bookmark-count')!;
const progressBar = document.getElementById('progress-bar')!;
const progressText = document.getElementById('progress-text')!;
const currentUrl = document.getElementById('current-url')!;
const progressCount = document.getElementById('progress-count')!;
const resultsList = document.getElementById('results-list')!;
const errorMessage = document.getElementById('error-message')!;

/**
 * Show a specific state
 */
function showState(state: 'idle' | 'processing' | 'complete' | 'error') {
  idleState.classList.add('hidden');
  processingState.classList.add('hidden');
  completeState.classList.add('hidden');
  errorState.classList.add('hidden');

  switch (state) {
    case 'idle':
      idleState.classList.remove('hidden');
      break;
    case 'processing':
      processingState.classList.remove('hidden');
      break;
    case 'complete':
      completeState.classList.remove('hidden');
      break;
    case 'error':
      errorState.classList.remove('hidden');
      break;
  }
}

/**
 * Update progress bar
 */
function updateProgress(current: number, total: number, url?: string) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  progressBar.style.width = `${percent}%`;
  progressText.textContent = `${percent}%`;

  if (url) {
    currentUrl.textContent = `Fetching: ${url}`;
  }

  progressCount.textContent = `${current} of ${total} processed`;
}

/**
 * Show results
 */
function showResults(stats: ProgressEvent['stats']) {
  if (!stats) return;

  resultsList.innerHTML = `
    <li>• ${stats.processed} bookmarks processed</li>
    <li>• ${stats.duplicatesMerged} duplicates merged</li>
    <li>• ${stats.deadlinks} deadlinks found</li>
    <li>• ${stats.unreachable} unreachable</li>
    <li>• ${stats.categories} categories created</li>
  `;
}

/**
 * Get bookmark count from background
 */
async function getBookmarkCount(): Promise<number> {
  const tree = await chrome.bookmarks.getTree();
  let count = 0;

  function traverse(node: chrome.bookmarks.BookmarkTreeNode) {
    if (node.url) count++;
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  for (const root of tree) {
    traverse(root);
  }

  return count;
}

/**
 * Initialize popup
 */
async function init() {
  // Get current state
  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });

  if (state?.isRunning) {
    showState('processing');
  } else {
    showState('idle');
    const count = await getBookmarkCount();
    bookmarkCount.textContent = `${count} bookmarks found`;
  }
}

/**
 * Start organization
 */
async function startOrganization() {
  showState('processing');
  updateProgress(0, 0, 'Starting...');

  await chrome.runtime.sendMessage({ type: 'START_ORGANIZE' });
}

/**
 * Cancel organization
 */
async function cancelOrganization() {
  await chrome.runtime.sendMessage({ type: 'CANCEL' });
  showState('idle');

  const count = await getBookmarkCount();
  bookmarkCount.textContent = `${count} bookmarks found`;
}

/**
 * Handle done button
 */
function handleDone() {
  window.close();
}

/**
 * Handle retry button
 */
async function handleRetry() {
  await startOrganization();
}

// Listen for progress updates
chrome.runtime.onMessage.addListener((message: ProgressEvent) => {
  if (message.type === 'progress') {
    updateProgress(message.current, message.total, message.currentUrl);
  } else if (message.type === 'complete') {
    showResults(message.stats);
    showState('complete');
  } else if (message.type === 'error') {
    errorMessage.textContent = message.error || 'Unknown error';
    showState('error');
  }
});

// Event listeners
startBtn.addEventListener('click', startOrganization);
cancelBtn.addEventListener('click', cancelOrganization);
doneBtn.addEventListener('click', handleDone);
retryBtn.addEventListener('click', handleRetry);

// Initialize
init();
```

- [ ] **Step 4: Commit**

```bash
git add src/popup/
git commit -m "feat: add popup UI with progress display and results"
```

---

## Task 9: Fix Build Configuration

**Files:**
- Modify: `vite.config.ts`
- Modify: `manifest.json`
- Modify: `package.json`

- [ ] **Step 1: Update vite.config.ts for proper extension build**

```typescript
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        popup: resolve(__dirname, 'src/popup/index.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background/index.js';
          }
          if (chunkInfo.name === 'popup') {
            return 'popup/index.js';
          }
          return '[name].js';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
```

- [ ] **Step 2: Update manifest.json with correct paths**

```json
{
  "manifest_version": 3,
  "name": "Bookmark Tidy",
  "version": "1.0.0",
  "description": "Organize and tidy up your Chrome bookmarks",
  "permissions": ["bookmarks"],
  "host_permissions": ["<all_urls>"],
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
  },
  "web_accessible_resources": [
    {
      "resources": ["popup/*"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

- [ ] **Step 3: Add a build script that copies static files**

Create `scripts/build.js`:

```javascript
// scripts/build.js
import { cpSync, mkdirSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Ensure dist directories exist
mkdirSync(resolve(root, 'dist/icons'), { recursive: true });
mkdirSync(resolve(root, 'dist/popup'), { recursive: true });

// Copy static files
cpSync(resolve(root, 'public/icons'), resolve(root, 'dist/icons'), { recursive: true });

// Copy popup HTML
cpSync(resolve(root, 'src/popup/popup.html'), resolve(root, 'dist/popup/popup.html'));

// Copy manifest
cpSync(resolve(root, 'manifest.json'), resolve(root, 'dist/manifest.json'));

console.log('Static files copied to dist/');
```

- [ ] **Step 4: Update package.json scripts**

```json
{
  "name": "bookmark-tidy",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite build --watch --mode development",
    "build": "vite build && node scripts/build.js",
    "typecheck": "tsc --noEmit"
  },
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

- [ ] **Step 5: Create icons directory in public**

```bash
mkdir -p public/icons
```

Create simple SVG icons temporarily (you'll want real icons):

```bash
# Create a simple placeholder icon (16x16)
cat > public/icons/icon16.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
  <rect width="16" height="16" fill="#1a73e8"/>
  <text x="8" y="12" font-size="10" fill="white" text-anchor="middle">📚</text>
</svg>
EOF
```

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts manifest.json package.json scripts/ public/
git commit -m "fix: update build configuration for Chrome extension"
```

---

## Task 10: Final Testing & Integration

**Files:**
- Verify all files build correctly
- Test extension in Chrome

- [ ] **Step 1: Run typecheck**

```bash
pnpm run typecheck
```

Expected: No errors

- [ ] **Step 2: Run build**

```bash
pnpm run build
```

Expected: Build succeeds with output in `dist/`

- [ ] **Step 3: Verify dist structure**

```bash
ls -la dist/
```

Expected:
```
dist/
├── background/
│   └── index.js
├── popup/
│   ├── index.js
│   └── popup.html
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── manifest.json
```

- [ ] **Step 4: Load extension in Chrome**

1. Open Chrome
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `dist/` folder

- [ ] **Step 5: Test basic functionality**

1. Click the extension icon
2. Verify popup opens showing bookmark count
3. Click "Organize Bookmarks"
4. Verify progress bar updates
5. Verify completion shows results
6. Check that `📁Organized` folder was created in bookmarks

- [ ] **Step 6: Fix any issues found during testing**

If issues are found, fix them and re-run the build.

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "feat: complete bookmark-tidy Chrome extension v1.0.0"
```

---

## Self-Review Checklist

After implementing all tasks:

- [ ] Verify all spec requirements are implemented:
  - [ ] Merge duplicate bookmarks (normalized URL matching)
  - [ ] Remove deadlink bookmarks (separate deadlinks/unreachable folders)
  - [ ] Organize into categories using TF-IDF + K-means
  - [ ] Smart 1-2 word category names
  - [ ] Sub-categories for >10 bookmarks
  - [ ] Create `📁Organized` folder
  - [ ] Popup UI with progress
  - [ ] Cancel functionality
  - [ ] Error handling with reports

- [ ] No placeholder code (TBD, TODO, etc.)
- [ ] All types are consistent across files
- [ ] Build succeeds without errors
- [ ] Extension loads in Chrome
- [ ] Basic functionality works
