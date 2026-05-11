import { describe, it, expect } from 'vitest';
import { TfIdf } from '../utils/tfidf';

describe('TfIdf', () => {
  describe('addDocument', () => {
    it('adds documents to the corpus', () => {
      const tfidf = new TfIdf();
      tfidf.addDocument('hello world');
      expect(tfidf.getDocumentCount()).toBe(1);
    });

    it('tokenizes text into words', () => {
      const tfidf = new TfIdf();
      tfidf.addDocument('Hello World Test');
      const terms = tfidf.listTerms(0);

      expect(terms.some(t => t.term === 'hello')).toBe(true);
      expect(terms.some(t => t.term === 'world')).toBe(true);
      expect(terms.some(t => t.term === 'test')).toBe(true);
    });

    it('converts text to lowercase', () => {
      const tfidf = new TfIdf();
      tfidf.addDocument('HELLO WORLD');
      const terms = tfidf.listTerms(0);

      expect(terms.some(t => t.term === 'hello')).toBe(true);
    });

    it('removes punctuation', () => {
      const tfidf = new TfIdf();
      tfidf.addDocument('hello, world! test.');
      const terms = tfidf.listTerms(0);

      expect(terms.some(t => t.term === 'hello')).toBe(true);
      expect(terms.some(t => t.term === 'world')).toBe(true);
      expect(terms.some(t => t.term === 'test')).toBe(true);
    });
  });

  describe('listTerms', () => {
    it('returns terms sorted by TF-IDF score descending', () => {
      const tfidf = new TfIdf();
      tfidf.addDocument('apple apple apple banana');
      tfidf.addDocument('banana banana banana cherry');

      const terms = tfidf.listTerms(0);

      // 'apple' appears 3 times in doc 0, but not in doc 1 - should have high TF-IDF
      // 'banana' appears in both docs - should have lower TF-IDF
      const appleTerm = terms.find(t => t.term === 'apple');
      const bananaTerm = terms.find(t => t.term === 'banana');

      expect(appleTerm).toBeDefined();
      expect(bananaTerm).toBeDefined();
      expect(appleTerm!.tfidf).toBeGreaterThan(bananaTerm!.tfidf);
    });

    it('returns empty array for invalid document index', () => {
      const tfidf = new TfIdf();
      tfidf.addDocument('test');

      expect(tfidf.listTerms(-1)).toEqual([]);
      expect(tfidf.listTerms(99)).toEqual([]);
    });

    it('gives higher score to rare terms across documents', () => {
      const tfidf = new TfIdf();
      // Doc 0: contains 'unique'
      tfidf.addDocument('unique common common');
      // Doc 1: contains only 'common'
      tfidf.addDocument('common common common');

      const terms0 = tfidf.listTerms(0);
      const uniqueTerm = terms0.find(t => t.term === 'unique');
      const commonTerm = terms0.find(t => t.term === 'common');

      // 'unique' appears in 1 doc, 'common' in 2 docs
      // 'unique' should have higher IDF and thus higher TF-IDF
      expect(uniqueTerm!.tfidf).toBeGreaterThan(commonTerm!.tfidf);
    });
  });

  describe('getVocabulary', () => {
    it('returns all unique terms from corpus', () => {
      const tfidf = new TfIdf();
      tfidf.addDocument('apple banana');
      tfidf.addDocument('banana cherry');

      const vocab = tfidf.getVocabulary();

      expect(vocab).toContain('apple');
      expect(vocab).toContain('banana');
      expect(vocab).toContain('cherry');
      expect(vocab.length).toBe(3);
    });
  });

  describe('getDocumentCount', () => {
    it('returns 0 for empty corpus', () => {
      const tfidf = new TfIdf();
      expect(tfidf.getDocumentCount()).toBe(0);
    });

    it('returns correct count after adding documents', () => {
      const tfidf = new TfIdf();
      tfidf.addDocument('doc 1');
      tfidf.addDocument('doc 2');
      tfidf.addDocument('doc 3');

      expect(tfidf.getDocumentCount()).toBe(3);
    });
  });
});
