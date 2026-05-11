import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchBookmarks, BATCH_SIZE } from '../modules/fetcher';
import { RawBookmark } from '../types';

// Mock the global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('fetcher integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createRawBookmark = (url: string, title: string = 'Test'): RawBookmark => ({
    id: Math.random().toString(),
    url,
    title,
  });

  describe('fetchBookmarks', () => {
    it('fetches a single bookmark successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        text: () => Promise.resolve(`
          <html>
            <head>
              <title>Test Page</title>
              <meta name="description" content="Test description">
            </head>
            <body><h1>Heading</h1></body>
          </html>
        `),
      });

      const result = await fetchBookmarks([createRawBookmark('https://example.com')]);

      expect(result.bookmarks).toHaveLength(1);
      expect(result.bookmarks[0].status).toBe('ok');
      expect(result.bookmarks[0].meta.description).toBe('Test description');
      expect(result.deadlinks).toHaveLength(0);
      expect(result.unreachable).toHaveLength(0);
    });

    it('classifies 404 as deadlink', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve(''),
      });

      const result = await fetchBookmarks([createRawBookmark('https://example.com/missing')]);

      expect(result.deadlinks).toHaveLength(1);
      expect(result.deadlinks[0].status).toBe('deadlink');
      expect(result.deadlinks[0].error).toBe('404 Not Found');
    });

    it('classifies 500 as unreachable', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve(''),
      });

      const result = await fetchBookmarks([createRawBookmark('https://example.com/error')]);

      expect(result.unreachable).toHaveLength(1);
      expect(result.unreachable[0].status).toBe('unreachable');
      expect(result.unreachable[0].error).toBe('500 Internal Server Error');
    });

    it('marks invalid URL as unreachable', async () => {
      const result = await fetchBookmarks([createRawBookmark('not-a-valid-url')]);

      expect(result.unreachable).toHaveLength(1);
      expect(result.unreachable[0].error).toBe('Invalid URL format');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('marks chrome:// URLs as unreachable', async () => {
      const result = await fetchBookmarks([createRawBookmark('chrome://extensions')]);

      expect(result.unreachable).toHaveLength(1);
      expect(result.unreachable[0].error).toBe('Unsupported URL scheme');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('marks view-source: URLs as unreachable', async () => {
      const result = await fetchBookmarks([createRawBookmark('view-source:https://example.com')]);

      expect(result.unreachable).toHaveLength(1);
      expect(result.unreachable[0].error).toBe('Unsupported URL scheme');
    });

    it('classifies DNS errors as deadlink', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ENOTFOUND example.com'));

      const result = await fetchBookmarks([createRawBookmark('https://nonexistent.example')]);

      expect(result.deadlinks).toHaveLength(1);
      expect(result.deadlinks[0].status).toBe('deadlink');
    });

    it('classifies network errors as unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchBookmarks([createRawBookmark('https://error.example')]);

      expect(result.unreachable).toHaveLength(1);
    });

    it('processes bookmarks in batches', async () => {
      // Create more bookmarks than batch size
      const bookmarks = Array(BATCH_SIZE * 2 + 1).fill(null).map((_, i) =>
        createRawBookmark(`https://example${i}.com`)
      );

      mockFetch.mockResolvedValue({
        status: 200,
        text: () => Promise.resolve('<html><head><title>Test</title></head></html>'),
      });

      const progressCallback = vi.fn();
      await fetchBookmarks(bookmarks, { onProgress: progressCallback });

      // Verify all bookmarks were fetched
      expect(mockFetch).toHaveBeenCalledTimes(BATCH_SIZE * 2 + 1);
    });

    it('supports cancellation via shouldAbort', async () => {
      mockFetch.mockResolvedValue({
        status: 200,
        text: () => Promise.resolve('<html><head><title>Test</title></head></html>'),
      });

      // Abort after first batch (shouldAbort is checked between batches)
      let batchCount = 0;
      const shouldAbort = () => {
        batchCount++;
        // Abort after processing first batch
        return batchCount > 1;
      };

      const bookmarks = Array(20).fill(null).map((_, i) =>
        createRawBookmark(`https://example${i}.com`)
      );

      const result = await fetchBookmarks(bookmarks, { shouldAbort });

      // Should stop after abort - first batch of BATCH_SIZE should be processed
      expect(result.bookmarks.length).toBe(BATCH_SIZE);
    });

    it('returns empty results for empty input', async () => {
      const result = await fetchBookmarks([]);

      expect(result.bookmarks).toEqual([]);
      expect(result.deadlinks).toEqual([]);
      expect(result.unreachable).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles mixed results correctly', async () => {
      mockFetch
        .mockResolvedValueOnce({
          status: 200,
          text: () => Promise.resolve('<html><head><title>OK</title></head></html>'),
        })
        .mockResolvedValueOnce({
          status: 404,
          statusText: 'Not Found',
          text: () => Promise.resolve(''),
        })
        .mockResolvedValueOnce({
          status: 500,
          statusText: 'Server Error',
          text: () => Promise.resolve(''),
        });

      const bookmarks = [
        createRawBookmark('https://ok.example.com'),
        createRawBookmark('https://missing.example.com'),
        createRawBookmark('https://error.example.com'),
      ];

      const result = await fetchBookmarks(bookmarks);

      expect(result.bookmarks).toHaveLength(1);
      expect(result.deadlinks).toHaveLength(1);
      expect(result.unreachable).toHaveLength(1);
    });
  });
});
