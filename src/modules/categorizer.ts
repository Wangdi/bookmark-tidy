// src/modules/categorizer.ts

import { ProcessedBookmark, CategorizedBookmark } from '../types';
import { STOP_WORDS } from '../utils/stop-words';
import { TfIdf } from '../utils/tfidf';
import { kmeans } from 'ml-kmeans';
import { SparseVector } from '../lib/storage';

export const MAX_CATEGORIES = 15;
export const MIN_CATEGORIES = 3;
export const SUB_CATEGORY_THRESHOLD = 10;
export const MAX_CATEGORY_NAME_LENGTH = 50;

// Threshold for sparse vectors - values below this are considered zero
const SPARSE_THRESHOLD = 0.001;

export interface CategorizerResult {
  bookmarks: CategorizedBookmark[];
  categoryNames: string[];
}

/**
 * Build text corpus from bookmarks
 */
export function buildCorpus(bookmarks: ProcessedBookmark[]): string[] {
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
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Compute optimal number of clusters
 */
export function computeClusterCount(n: number): number {
  return Math.min(MAX_CATEGORIES, Math.max(MIN_CATEGORIES, Math.ceil(Math.sqrt(n / 2))));
}

/**
 * Generate category name from cluster terms
 */
export function generateCategoryName(topTerms: string[], allTopTerms: string[][]): string {
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

// ===== SPARSE VECTOR OPERATIONS =====

/**
 * Build sparse TF-IDF vectors for memory-efficient clustering
 * Only stores non-zero values
 */
export function buildSparseVectors(
  tfidf: TfIdf,
  numDocs: number,
  vocabMap: Map<string, number>
): SparseVector[] {
  const vectors: SparseVector[] = [];

  for (let i = 0; i < numDocs; i++) {
    const terms = tfidf.listTerms(i);
    const sparse: SparseVector = { indices: [], values: [] };

    for (const term of terms) {
      const idx = vocabMap.get(term.term);
      if (idx !== undefined && term.tfidf > SPARSE_THRESHOLD) {
        sparse.indices.push(idx);
        sparse.values.push(term.tfidf);
      }
    }

    vectors.push(sparse);
  }

  return vectors;
}

/**
 * Compute cosine distance between two sparse vectors
 * Returns 0 for identical vectors, 1 for orthogonal vectors
 */
export function sparseCosineDistance(a: SparseVector, b: SparseVector): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  // Build maps for faster lookup
  const aMap = new Map(a.indices.map((idx, i) => [idx, a.values[i]]));
  const bMap = new Map(b.indices.map((idx, i) => [idx, b.values[i]]));

  // Compute dot product and norm A
  for (const [idx, valA] of aMap) {
    normA += valA * valA;
    const valB = bMap.get(idx);
    if (valB !== undefined) {
      dotProduct += valA * valB;
    }
  }

  // Compute norm B
  for (const val of b.values) {
    normB += val * val;
  }

  const norm = Math.sqrt(normA) * Math.sqrt(normB);
  return norm > 0 ? 1 - dotProduct / norm : 1;
}

/**
 * Average multiple sparse vectors to create a centroid
 */
function averageSparseVectors(vectors: SparseVector[]): SparseVector {
  const sumMap = new Map<number, number>();

  for (const vector of vectors) {
    for (let i = 0; i < vector.indices.length; i++) {
      const idx = vector.indices[i];
      const val = vector.values[i];
      sumMap.set(idx, (sumMap.get(idx) || 0) + val);
    }
  }

  // Average and filter small values
  const count = vectors.length;
  const indices: number[] = [];
  const values: number[] = [];

  for (const [idx, sum] of sumMap) {
    const avg = sum / count;
    if (avg > SPARSE_THRESHOLD) {
      indices.push(idx);
      values.push(avg);
    }
  }

  return { indices, values };
}

/**
 * K-means clustering with sparse vectors
 */
export function kmeansSparse(
  vectors: SparseVector[],
  k: number,
  maxIterations: number = 100
): { clusters: number[]; centroids: SparseVector[] } {
  if (vectors.length === 0) {
    return { clusters: [], centroids: [] };
  }

  // Initialize centroids using k-means++ style selection
  const centroidIndices: number[] = [Math.floor(Math.random() * vectors.length)];

  for (let c = 1; c < k && c < vectors.length; c++) {
    // Compute distances to nearest centroid
    const distances: number[] = vectors.map((v, i) => {
      if (centroidIndices.includes(i)) return 0;
      let minDist = Infinity;
      for (const ci of centroidIndices) {
        const dist = sparseCosineDistance(v, vectors[ci]);
        if (dist < minDist) minDist = dist;
      }
      return minDist * minDist; // Square for probability
    });

    // Select next centroid with probability proportional to distance squared
    const totalDist = distances.reduce((a, b) => a + b, 0);
    if (totalDist === 0) break;

    let random = Math.random() * totalDist;
    for (let i = 0; i < distances.length; i++) {
      random -= distances[i];
      if (random <= 0) {
        centroidIndices.push(i);
        break;
      }
    }
  }

  // Initialize centroids
  let centroids = centroidIndices.map(i => ({
    indices: [...vectors[i].indices],
    values: [...vectors[i].values],
  }));

  let clusters = new Array(vectors.length).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;

    // Assign to nearest centroid
    for (let i = 0; i < vectors.length; i++) {
      let minDist = Infinity;
      let bestCluster = 0;

      for (let j = 0; j < centroids.length; j++) {
        const dist = sparseCosineDistance(vectors[i], centroids[j]);
        if (dist < minDist) {
          minDist = dist;
          bestCluster = j;
        }
      }

      if (clusters[i] !== bestCluster) {
        clusters[i] = bestCluster;
        changed = true;
      }
    }

    if (!changed) break;

    // Update centroids (average of assigned vectors)
    const clusterVectors: SparseVector[][] = Array.from({ length: k }, () => []);
    for (let i = 0; i < vectors.length; i++) {
      clusterVectors[clusters[i]].push(vectors[i]);
    }

    centroids = clusterVectors.map(group =>
      group.length > 0 ? averageSparseVectors(group) : { indices: [], values: [] }
    );
  }

  return { clusters, centroids };
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
 * Categorize bookmarks using sparse vectors for memory efficiency
 * Use this for large bookmark collections (2000+)
 */
export function categorizeBookmarksSparse(bookmarks: ProcessedBookmark[]): CategorizerResult {
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

  // Build vocabulary map for sparse vectors
  const vocabMap = new Map<string, number>();
  let vocabIndex = 0;
  for (let i = 0; i < corpus.length; i++) {
    tfidf.listTerms(i).forEach(item => {
      if (!vocabMap.has(item.term)) {
        vocabMap.set(item.term, vocabIndex++);
      }
    });
  }

  // Build sparse vectors for clustering
  const vectors = buildSparseVectors(tfidf, bookmarks.length, vocabMap);

  // Determine cluster count
  const k = computeClusterCount(bookmarks.length);

  // Run sparse K-means clustering
  const result = kmeansSparse(vectors, k);

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
  const subCategorized = processSubCategoriesSparse(categorized, tfidf, vocabMap);

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

/**
 * Process sub-categories for large clusters using sparse vectors
 */
function processSubCategoriesSparse(
  bookmarks: CategorizedBookmark[],
  parentTfidf: TfIdf,
  parentVocabMap: Map<string, number>
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
      // Re-cluster this group for sub-categories using sparse vectors
      const subK = Math.max(2, Math.ceil(group.length / 8));

      // Build sparse vectors for this group
      const groupIndices = group.map(b => bookmarks.indexOf(b));
      const groupVectors = groupIndices.map(i => {
        const sparse: SparseVector = { indices: [], values: [] };
        parentTfidf.listTerms(i).forEach(item => {
          const idx = parentVocabMap.get(item.term);
          if (idx !== undefined && item.tfidf > SPARSE_THRESHOLD) {
            sparse.indices.push(idx);
            sparse.values.push(item.tfidf);
          }
        });
        return sparse;
      });

      // Cluster with sparse K-means
      const subResult = kmeansSparse(groupVectors, subK, 50);

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
