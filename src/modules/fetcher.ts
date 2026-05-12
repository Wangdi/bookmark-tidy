// src/modules/fetcher.ts

import { RawBookmark, ProcessedBookmark, BookmarkMeta } from '../types';
import { isValidUrl, isFetchableUrl } from '../utils/url-normalizer';

export const FETCH_TIMEOUT = 30000; // 30 seconds
export const BATCH_SIZE = 5;
export const BATCH_DELAY = 500; // 500ms between batches

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
export function extractContent(html: string): { meta: BookmarkMeta; headings: string[] } {
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
export function classifyError(error: Error): 'deadlink' | 'unreachable' {
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

  // Check if URL scheme is fetchable
  if (!isFetchableUrl(bookmark.url)) {
    return {
      ...bookmark,
      meta: {},
      headings: [],
      status: 'unreachable',
      error: 'Unsupported URL scheme',
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