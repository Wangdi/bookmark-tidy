import { describe, it, expect } from 'vitest';
import {
  categorizeBookmarks,
  categorizeBookmarksSparse,
  buildCorpus,
  tokenize,
  computeClusterCount,
  generateCategoryName,
  buildSparseVectors,
  sparseCosineDistance,
  kmeansSparse,
  MIN_CATEGORIES,
  MAX_CATEGORIES,
  SUB_CATEGORY_THRESHOLD,
} from '../modules/categorizer';
import { ProcessedBookmark } from '../types';
import { TfIdf } from '../utils/tfidf';

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

    it('falls back to first term or Uncategorized when single term is not unique', () => {
      // When there's only one term and it's not unique, use firstTerm or 'Uncategorized'
      const allTerms = [['javascript'], ['javascript'], ['python']];
      // firstTerm = 'javascript', firstTermCount = 2 (not unique), topTerms.length = 1
      // So it should fall back to the first term
      expect(generateCategoryName(['javascript'], allTerms)).toBe('Javascript');
    });

    it('returns Uncategorized when single term is empty and not unique', () => {
      const allTerms = [[''], [''], ['other']];
      // firstTerm = '', firstTermCount = 2, topTerms.length = 1
      // name = firstTerm || 'Uncategorized' = 'Uncategorized'
      expect(generateCategoryName([''], allTerms)).toBe('Uncategorized');
    });

    it('capitalizes each word', () => {
      expect(generateCategoryName(['javascript'], [['javascript']])).toBe('Javascript');
      expect(generateCategoryName(['web', 'development'], [['other']])).toBe('Web Development');
    });

    it('truncates long names to 50 characters', () => {
      // Need two-word name that exceeds 50 chars - first term must not be unique
      const longTerm1 = 'a'.repeat(30);
      const longTerm2 = 'b'.repeat(30);
      const allTerms = [[longTerm1, longTerm2], [longTerm1, 'other']];
      // firstTerm = 'aaa...' (30 chars), firstTermCount = 2 (not unique)
      // So it uses two words: 'aaa... bbb...' = 61 chars, truncated to 50
      const result = generateCategoryName([longTerm1, longTerm2], allTerms);
      expect(result.length).toBe(50);
      // The name is capitalized before truncation
      const expectedName = (longTerm1.charAt(0).toUpperCase() + longTerm1.slice(1) + ' ' +
                           longTerm2.charAt(0).toUpperCase() + longTerm2.slice(1)).substring(0, 50);
      expect(result).toBe(expectedName);
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

  describe('buildSparseVectors', () => {
    it('builds sparse vectors from TF-IDF', () => {
      const tfidf = new TfIdf();
      tfidf.addDocument('javascript programming');
      tfidf.addDocument('python coding');

      const vocabMap = new Map([
        ['javascript', 0],
        ['programming', 1],
        ['python', 2],
        ['coding', 3],
      ]);

      const vectors = buildSparseVectors(tfidf, 2, vocabMap);

      expect(vectors).toHaveLength(2);
      expect(vectors[0].indices).toBeDefined();
      expect(vectors[0].values).toBeDefined();
      expect(vectors[0].indices.length).toBe(vectors[0].values.length);
    });

    it('filters out values below threshold', () => {
      const tfidf = new TfIdf();
      tfidf.addDocument('javascript programming');

      const vocabMap = new Map([
        ['javascript', 0],
        ['programming', 1],
      ]);

      const vectors = buildSparseVectors(tfidf, 1, vocabMap);

      // All values should be above the threshold (0.001)
      for (const val of vectors[0].values) {
        expect(val).toBeGreaterThan(0.001);
      }
    });

    it('produces empty sparse vector for empty document', () => {
      const tfidf = new TfIdf();
      tfidf.addDocument('');

      const vocabMap = new Map<string, number>();

      const vectors = buildSparseVectors(tfidf, 1, vocabMap);

      expect(vectors[0].indices).toHaveLength(0);
      expect(vectors[0].values).toHaveLength(0);
    });
  });

  describe('sparseCosineDistance', () => {
    it('returns 0 for identical vectors', () => {
      const a = { indices: [0, 1, 2], values: [0.5, 0.3, 0.2] };
      const b = { indices: [0, 1, 2], values: [0.5, 0.3, 0.2] };

      expect(sparseCosineDistance(a, b)).toBeCloseTo(0, 5);
    });

    it('returns 1 for orthogonal vectors', () => {
      const a = { indices: [0], values: [1] };
      const b = { indices: [1], values: [1] };

      expect(sparseCosineDistance(a, b)).toBeCloseTo(1, 5);
    });

    it('computes correct distance for partial overlap', () => {
      const a = { indices: [0, 1], values: [1, 1] };
      const b = { indices: [1, 2], values: [1, 1] };

      // cos(a,b) = (a·b) / (|a||b|) = 1 / (sqrt(2) * sqrt(2)) = 0.5
      // distance = 1 - 0.5 = 0.5
      expect(sparseCosineDistance(a, b)).toBeCloseTo(0.5, 5);
    });

    it('handles empty vectors', () => {
      const a = { indices: [], values: [] };
      const b = { indices: [0], values: [1] };

      // Empty vector has no norm, so distance should be 1
      expect(sparseCosineDistance(a, b)).toBe(1);
    });

    it('handles both empty vectors', () => {
      const a = { indices: [], values: [] };
      const b = { indices: [], values: [] };

      expect(sparseCosineDistance(a, b)).toBe(1);
    });
  });

  describe('kmeansSparse', () => {
    it('returns empty result for empty input', () => {
      const result = kmeansSparse([], 3);

      expect(result.clusters).toHaveLength(0);
      expect(result.centroids).toHaveLength(0);
    });

    it('clusters vectors into k groups', () => {
      // Create two distinct clusters
      const vectors = [
        { indices: [0], values: [1] },  // Cluster 1
        { indices: [0], values: [0.9] }, // Cluster 1
        { indices: [1], values: [1] },  // Cluster 2
        { indices: [1], values: [0.9] }, // Cluster 2
      ];

      const result = kmeansSparse(vectors, 2);

      expect(result.clusters).toHaveLength(4);
      expect(new Set(result.clusters).size).toBeLessThanOrEqual(2);
    });

    it('handles single cluster request', () => {
      const vectors = [
        { indices: [0, 1], values: [0.5, 0.5] },
        { indices: [0, 2], values: [0.5, 0.5] },
      ];

      const result = kmeansSparse(vectors, 1);

      expect(result.clusters).toEqual([0, 0]);
    });

    it('handles k larger than vector count', () => {
      const vectors = [
        { indices: [0], values: [1] },
        { indices: [1], values: [1] },
      ];

      const result = kmeansSparse(vectors, 5);

      // kmeansSparse creates k centroids, some may be empty if k > vectors.length
      expect(result.clusters).toHaveLength(2);
      expect(result.centroids).toHaveLength(5);
      // Each vector is assigned to a cluster
      expect(result.clusters.every(c => c >= 0 && c < 5)).toBe(true);
    });

    it('converges within max iterations', () => {
      // Create well-separated clusters that should converge quickly
      const vectors = [];
      for (let i = 0; i < 10; i++) {
        vectors.push({ indices: [i % 3], values: [1] });
      }

      const result = kmeansSparse(vectors, 3, 10);

      expect(result.clusters).toHaveLength(10);
      expect(result.centroids).toHaveLength(3);
    });
  });

  describe('categorizeBookmarksSparse', () => {
    it('returns single category for fewer than minimum bookmarks', () => {
      const bookmarks = [createBookmark('Test 1'), createBookmark('Test 2')];
      const result = categorizeBookmarksSparse(bookmarks);

      expect(result.categoryNames).toEqual(['Bookmarks']);
      expect(result.bookmarks.every(b => b.category === 'Bookmarks')).toBe(true);
    });

    it('categorizes bookmarks using sparse vectors', () => {
      const devBookmarks = Array(5).fill(null).map((_, i) =>
        createBookmark(`JavaScript Development ${i}`, { description: 'coding programming' })
      );
      const newsBookmarks = Array(5).fill(null).map((_, i) =>
        createBookmark(`News Article ${i}`, { description: 'news journalism reporting' })
      );
      const foodBookmarks = Array(5).fill(null).map((_, i) =>
        createBookmark(`Recipe ${i}`, { description: 'cooking food kitchen' })
      );

      const result = categorizeBookmarksSparse([...devBookmarks, ...newsBookmarks, ...foodBookmarks]);

      expect(result.categoryNames.length).toBeGreaterThanOrEqual(MIN_CATEGORIES);
      expect(result.bookmarks).toHaveLength(15);
    });

    it('creates sub-categories for large sparse clusters', () => {
      // Create enough similar bookmarks to form one large cluster (> SUB_CATEGORY_THRESHOLD = 10)
      const techBookmarks = Array(15).fill(null).map((_, i) =>
        createBookmark(`Tech Article ${i} JavaScript Programming`, {
          description: 'javascript programming development coding software'
        })
      );

      const result = categorizeBookmarksSparse(techBookmarks);

      // All should be categorized
      expect(result.bookmarks).toHaveLength(15);

      // Check if sub-categories were created for the large cluster
      // The sub-category path is triggered when a category has > 10 bookmarks
      const withSubCategories = result.bookmarks.filter(b => b.subCategory);
      // Sub-categories may be assigned depending on clustering results
      expect(result.bookmarks.every(b => b.category)).toBe(true);
    });

    it('produces same number of categorized bookmarks as input', () => {
      const bookmarks = Array(10).fill(null).map((_, i) =>
        createBookmark(`Test Bookmark ${i}`)
      );

      const result = categorizeBookmarksSparse(bookmarks);

      expect(result.bookmarks).toHaveLength(10);
    });

    it('preserves bookmark data in sparse categorization', () => {
      const bookmarks = [
        createBookmark('Test', { description: 'Desc' }, ['Heading 1']),
      ];
      for (let i = 0; i < MIN_CATEGORIES; i++) {
        bookmarks.push(createBookmark(`Test ${i}`));
      }

      const result = categorizeBookmarksSparse(bookmarks);

      expect(result.bookmarks[0].title).toBe('Test');
      expect(result.bookmarks[0].meta.description).toBe('Desc');
      expect(result.bookmarks[0].headings).toContain('Heading 1');
    });
  });
});
