// src/modules/deduper.ts

import { ProcessedBookmark } from '../types';
import { normalizeUrl } from '../utils/url-normalizer';

export interface DeduperResult {
  bookmarks: ProcessedBookmark[];
  duplicatesMerged: number;
}

/**
 * Check if a title looks like a URL
 */
function titleLooksLikeUrl(title: string): boolean {
  // Check if title starts with http:// or https:// or contains common URL patterns
  return /^(https?:\/\/|www\.)/i.test(title) || title.includes('/');
}

/**
 * Deduplicate bookmarks based on normalized URLs
 */
export function dedupeBookmarks(bookmarks: ProcessedBookmark[]): DeduperResult {
  const seen = new Map<string, ProcessedBookmark>();
  let duplicatesMerged = 0;

  for (const bookmark of bookmarks) {
    const normalizedUrl = normalizeUrl(bookmark.url);

    if (seen.has(normalizedUrl)) {
      // Duplicate found - decide which title to keep
      const existing = seen.get(normalizedUrl)!;

      // Keep the title that doesn't look like a URL, or the longer one
      const existingLooksLikeUrl = titleLooksLikeUrl(existing.title);
      const currentLooksLikeUrl = titleLooksLikeUrl(bookmark.title);

      if (existingLooksLikeUrl && !currentLooksLikeUrl) {
        // Replace with bookmark that has a real title
        seen.set(normalizedUrl, bookmark);
      } else if (!existingLooksLikeUrl && currentLooksLikeUrl) {
        // Keep existing, it has a real title
      } else {
        // Both look like URLs or both don't - keep the longer title
        if (bookmark.title.length > existing.title.length) {
          seen.set(normalizedUrl, bookmark);
        }
      }

      duplicatesMerged++;
    } else {
      seen.set(normalizedUrl, bookmark);
    }
  }

  return {
    bookmarks: Array.from(seen.values()),
    duplicatesMerged,
  };
}
