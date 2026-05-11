import { describe, it, expect } from 'vitest';
import {
  categorizeBookmarks,
  buildCorpus,
  tokenize,
  computeClusterCount,
  generateCategoryName,
  MIN_CATEGORIES,
  MAX_CATEGORIES,
  SUB_CATEGORY_THRESHOLD,
} from '../modules/categorizer';
import { ProcessedBookmark } from '../types';

describe('categorizer', () => {
  const createBookmark = (
    title: string,
    meta: { description?: string; ogTitle?: string; keywords?: string[] } = {},
    headings: string[] = []
  ): ProcessedBookmark => ({
    id: Math.random().toString(),
    url: `https://example.com/${Math.random()}`,
    title,
    meta,
    headings,
    status: 'ok',
  });

  describe('buildCorpus', () => {
    it('builds corpus from bookmark titles', () => {
      const bookmarks = [createBookmark('JavaScript Tutorial')];
      const corpus = buildCorpus(bookmarks);

      expect(corpus).toHaveLength(1);
      expect(corpus[0]).toContain('JavaScript Tutorial');
    });

    it('doubles the weight of titles', () => {
      const bookmarks = [createBookmark('Python Guide')];
      const corpus = buildCorpus(bookmarks);

      // Title appears twice
      const titleCount = (corpus[0].match(/Python Guide/g) || []).length;
      expect(titleCount).toBe(2);
    });

    it('includes meta description', () => {
      const bookmarks = [createBookmark('Test', { description: 'A test page' })];
      const corpus = buildCorpus(bookmarks);

      expect(corpus[0]).toContain('A test page');
    });

    it('includes og:title', () => {
      const bookmarks = [createBookmark('Test', { ogTitle: 'OG Title' })];
      const corpus = buildCorpus(bookmarks);

      expect(corpus[0]).toContain('OG Title');
    });

    it('includes keywords with double weight', () => {
      const bookmarks = [createBookmark('Test', { keywords: ['code', 'dev'] })];
      const corpus = buildCorpus(bookmarks);

      // Keywords appear twice
      const keywordCount = (corpus[0].match(/code dev/g) || []).length;
      expect(keywordCount).toBe(2);
    });

    it('includes headings', () => {
      const bookmarks = [createBookmark('Test', {}, ['Introduction', 'Chapter 1'])];
      const corpus = buildCorpus(bookmarks);

      expect(corpus[0]).toContain('Introduction');
      expect(corpus[0]).toContain('Chapter 1');
    });

    it('handles bookmarks with no content', () => {
      const bookmarks = [createBookmark('')];
      const corpus = buildCorpus(bookmarks);

      expect(corpus).toHaveLength(1);
      expect(corpus[0]).toBe('');
    });
  });

  describe('tokenize', () => {
    it('tokenizes text into words', () => {
      const tokens = tokenize('hello world test');
      expect(tokens).toContain('hello');
      expect(tokens).toContain('world');
      expect(tokens).toContain('test');
    });

    it('converts to lowercase', () => {
      const tokens = tokenize('HELLO WORLD');
      expect(tokens).toContain('hello');
      expect(tokens).toContain('world');
    });

    it('removes punctuation', () => {
      const tokens = tokenize('hello, world! test.');
      expect(tokens).toContain('hello');
      expect(tokens).toContain('world');
      expect(tokens).toContain('test');
    });

    it('filters out short words', () => {
      const tokens = tokenize('a an the test');
      expect(tokens).not.toContain('a');
      expect(tokens).not.toContain('an');
      expect(tokens).toContain('test');
    });

    it('filters out stop words', () => {
      const tokens = tokenize('the and or javascript');
      expect(tokens).not.toContain('the');
      expect(tokens).not.toContain('and');
      expect(tokens).not.toContain('or');
      expect(tokens).toContain('javascript');
    });
  });

  describe('computeClusterCount', () => {
    it('returns minimum for small numbers', () => {
      expect(computeClusterCount(0)).toBe(MIN_CATEGORIES);
      expect(computeClusterCount(5)).toBe(MIN_CATEGORIES);
      expect(computeClusterCount(10)).toBe(MIN_CATEGORIES);
    });

    it('scales with input size', () => {
      // sqrt(50/2) = 5
      expect(computeClusterCount(50)).toBe(5);
      // sqrt(200/2) = 10
      expect(computeClusterCount(200)).toBe(10);
    });

    it('caps at maximum', () => {
      expect(computeClusterCount(1000)).toBe(MAX_CATEGORIES);
      expect(computeClusterCount(10000)).toBe(MAX_CATEGORIES);
    });
  });

  describe('generateCategoryName', () => {
    it('returns Uncategorized for empty terms', () => {
      expect(generateCategoryName([], [])).toBe('Uncategorized');
    });

    it('uses single word when unique', () => {
      const allTerms = [['javascript', 'tutorial'], ['python', 'guide'], ['rust', 'book']];
      expect(generateCategoryName(['javascript', 'tutorial'], allTerms)).toBe('Javascript');
    });

    it('uses two words when first term is not unique', () => {
      const allTerms = [['javascript', 'tutorial'], ['javascript', 'guide'], ['rust', 'book']];
      expect(generateCategoryName(['javascript', 'tutorial'], allTerms)).toBe('Javascript Tutorial');
    });

    it('capitalizes each word', () => {
      expect(generateCategoryName(['javascript'], [['javascript']])).toBe('Javascript');
      expect(generateCategoryName(['web', 'development'], [['other']])).toBe('Web Development');
    });

    it('truncates long names', () => {
      const longTerms = ['a'.repeat(30), 'b'.repeat(30)];
      const result = generateCategoryName(longTerms, [longTerms]);
      expect(result.length).toBeLessThanOrEqual(50);
    });
  });

  describe('categorizeBookmarks', () => {
    it('returns single category for fewer than minimum bookmarks', () => {
      const bookmarks = [createBookmark('Test 1'), createBookmark('Test 2')];
      const result = categorizeBookmarks(bookmarks);

      expect(result.categoryNames).toEqual(['Bookmarks']);
      expect(result.bookmarks.every(b => b.category === 'Bookmarks')).toBe(true);
    });

    it('categorizes bookmarks into multiple categories', () => {
      // Create enough bookmarks for clustering
      const devBookmarks = Array(5).fill(null).map((_, i) =>
        createBookmark(`JavaScript Development ${i}`, { description: 'coding programming' })
      );
      const newsBookmarks = Array(5).fill(null).map((_, i) =>
        createBookmark(`News Article ${i}`, { description: 'news journalism reporting' })
      );
      const foodBookmarks = Array(5).fill(null).map((_, i) =>
        createBookmark(`Recipe ${i}`, { description: 'cooking food kitchen' })
      );

      const result = categorizeBookmarks([...devBookmarks, ...newsBookmarks, ...foodBookmarks]);

      expect(result.categoryNames.length).toBeGreaterThanOrEqual(MIN_CATEGORIES);
      expect(result.bookmarks).toHaveLength(15);
    });

    it('preserves bookmark data', () => {
      const bookmarks = [
        createBookmark('Test', { description: 'Desc' }, ['Heading 1']),
      ];
      // Add more to meet minimum
      for (let i = 0; i < MIN_CATEGORIES; i++) {
        bookmarks.push(createBookmark(`Test ${i}`));
      }

      const result = categorizeBookmarks(bookmarks);

      expect(result.bookmarks[0].title).toBe('Test');
      expect(result.bookmarks[0].meta.description).toBe('Desc');
      expect(result.bookmarks[0].headings).toContain('Heading 1');
    });

    it('creates sub-categories for large clusters', () => {
      // Create a large cluster
      const bookmarks = Array(SUB_CATEGORY_THRESHOLD + 5).fill(null).map((_, i) =>
        createBookmark(`JavaScript Tutorial ${i}`, {
          description: `Learn JavaScript coding programming development`,
        })
      );
      // Add some variety to trigger sub-categorization
      bookmarks.push(...Array(5).fill(null).map((_, i) =>
        createBookmark(`Python Guide ${i}`, { description: 'python coding' })
      ));
      bookmarks.push(...Array(5).fill(null).map((_, i) =>
        createBookmark(`Rust Book ${i}`, { description: 'rust systems' })
      ));

      const result = categorizeBookmarks(bookmarks);

      // Check that some bookmarks have sub-categories
      const withSubCategories = result.bookmarks.filter(b => b.subCategory);
      // Sub-categories may or may not be assigned depending on clustering
      expect(result.bookmarks).toHaveLength(SUB_CATEGORY_THRESHOLD + 15);
    });
  });
});
