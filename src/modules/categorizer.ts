// src/modules/categorizer.ts

import { ProcessedBookmark, CategorizedBookmark } from '../types';
import { STOP_WORDS } from '../utils/stop-words';
import { TfIdf } from '../utils/tfidf';
import { kmeans } from 'ml-kmeans';

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
function getTopTerms(tfidf: TfIdf, docIndices: number[], topN: number = 3): string[] {
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
function buildVectors(tfidf: TfIdf, numDocs: number, vocabulary: string[]): number[][] {
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
  result.clusters.forEach((clusterIndex: number, docIndex: number) => {
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
  parentTfidf: TfIdf,
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
      subResult.clusters.forEach((clusterIndex: number, localIndex: number) => {
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
