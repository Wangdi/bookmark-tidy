import { describe, it, expect } from 'vitest';
import { dedupeBookmarks } from '../modules/deduper';
import { ProcessedBookmark } from '../types';

describe('deduper', () => {
  describe('dedupeBookmarks', () => {
    const createBookmark = (
      url: string,
      title: string,
      id: string = '1'
    ): ProcessedBookmark => ({
      id,
      url,
      title,
      meta: {},
      headings: [],
      status: 'ok',
    });

    it('returns empty array for empty input', () => {
      const result = dedupeBookmarks([]);
      expect(result.bookmarks).toEqual([]);
      expect(result.duplicatesMerged).toBe(0);
    });

    it('returns single bookmark unchanged', () => {
      const bookmarks = [createBookmark('https://example.com', 'Example')];
      const result = dedupeBookmarks(bookmarks);

      expect(result.bookmarks).toHaveLength(1);
      expect(result.duplicatesMerged).toBe(0);
    });

    it('merges exact duplicate URLs', () => {
      const bookmarks = [
        createBookmark('https://example.com', 'Example 1', '1'),
        createBookmark('https://example.com', 'Example 2', '2'),
      ];
      const result = dedupeBookmarks(bookmarks);

      expect(result.bookmarks).toHaveLength(1);
      expect(result.duplicatesMerged).toBe(1);
    });

    it('merges URLs that differ only by protocol', () => {
      const bookmarks = [
        createBookmark('https://example.com', 'Example 1', '1'),
        createBookmark('http://example.com', 'Example 2', '2'),
      ];
      const result = dedupeBookmarks(bookmarks);

      expect(result.bookmarks).toHaveLength(1);
      expect(result.duplicatesMerged).toBe(1);
    });

    it('merges URLs that differ only by www prefix', () => {
      const bookmarks = [
        createBookmark('https://www.example.com', 'Example 1', '1'),
        createBookmark('https://example.com', 'Example 2', '2'),
      ];
      const result = dedupeBookmarks(bookmarks);

      expect(result.bookmarks).toHaveLength(1);
      expect(result.duplicatesMerged).toBe(1);
    });

    it('merges URLs that differ only by trailing slash', () => {
      const bookmarks = [
        createBookmark('https://example.com/path/', 'Example 1', '1'),
        createBookmark('https://example.com/path', 'Example 2', '2'),
      ];
      const result = dedupeBookmarks(bookmarks);

      expect(result.bookmarks).toHaveLength(1);
      expect(result.duplicatesMerged).toBe(1);
    });

    it('merges URLs that differ only by tracking parameters', () => {
      const bookmarks = [
        createBookmark('https://example.com?utm_source=google', 'Example 1', '1'),
        createBookmark('https://example.com?ref=twitter', 'Example 2', '2'),
      ];
      const result = dedupeBookmarks(bookmarks);

      expect(result.bookmarks).toHaveLength(1);
      expect(result.duplicatesMerged).toBe(1);
    });

    it('keeps longer non-URL title when merging', () => {
      const bookmarks = [
        createBookmark('https://example.com', 'https://example.com', '1'),
        createBookmark('https://example.com', 'Example Site Title', '2'),
      ];
      const result = dedupeBookmarks(bookmarks);

      expect(result.bookmarks[0].title).toBe('Example Site Title');
    });

    it('keeps first title when both look like URLs', () => {
      const bookmarks = [
        createBookmark('https://example.com', 'https://example.com/page1', '1'),
        createBookmark('https://example.com', 'https://example.com/page2', '2'),
      ];
      const result = dedupeBookmarks(bookmarks);

      expect(result.bookmarks[0].title).toBe('https://example.com/page1');
    });

    it('preserves bookmarks with different URLs', () => {
      const bookmarks = [
        createBookmark('https://example1.com', 'Site 1', '1'),
        createBookmark('https://example2.com', 'Site 2', '2'),
        createBookmark('https://example3.com', 'Site 3', '3'),
      ];
      const result = dedupeBookmarks(bookmarks);

      expect(result.bookmarks).toHaveLength(3);
      expect(result.duplicatesMerged).toBe(0);
    });

    it('handles multiple groups of duplicates', () => {
      const bookmarks = [
        createBookmark('https://site1.com', 'Site 1a', '1'),
        createBookmark('https://site1.com', 'Site 1b', '2'),
        createBookmark('https://site2.com', 'Site 2a', '3'),
        createBookmark('https://site2.com', 'Site 2b', '4'),
        createBookmark('https://site3.com', 'Site 3', '5'),
      ];
      const result = dedupeBookmarks(bookmarks);

      expect(result.bookmarks).toHaveLength(3);
      expect(result.duplicatesMerged).toBe(2);
    });
  });
});
