// src/utils/tfidf.ts
// Lightweight TF-IDF implementation to replace the heavy 'natural' library

/**
 * Simple TF-IDF implementation for text clustering
 */
export class TfIdf {
  private documents: string[][] = [];
  private documentFrequency: Map<string, number> = new Map();
  private vocabulary: Set<string> = new Set();

  /**
   * Add a document to the corpus
   */
  addDocument(text: string): void {
    const tokens = this.tokenize(text);
    this.documents.push(tokens);

    // Update document frequency
    const uniqueTokens = new Set(tokens);
    for (const token of uniqueTokens) {
      this.documentFrequency.set(token, (this.documentFrequency.get(token) || 0) + 1);
      this.vocabulary.add(token);
    }
  }

  /**
   * Get list of terms with their TF-IDF scores for a document
   */
  listTerms(docIndex: number): Array<{ term: string; tfidf: number }> {
    if (docIndex < 0 || docIndex >= this.documents.length) {
      return [];
    }

    const tokens = this.documents[docIndex];
    const termFrequency = new Map<string, number>();
    const totalTerms = tokens.length;

    // Calculate term frequency
    for (const token of tokens) {
      termFrequency.set(token, (termFrequency.get(token) || 0) + 1);
    }

    // Calculate TF-IDF for each term
    const results: Array<{ term: string; tfidf: number }> = [];
    const numDocs = this.documents.length;

    for (const [term, tf] of termFrequency) {
      const df = this.documentFrequency.get(term) || 1;
      // TF-IDF = (term frequency / total terms) * log(total docs / document frequency)
      const idf = Math.log(numDocs / df);
      const tfidf = (tf / totalTerms) * idf;
      results.push({ term, tfidf });
    }

    // Sort by TF-IDF score descending
    results.sort((a, b) => b.tfidf - a.tfidf);

    return results;
  }

  /**
   * Get the vocabulary (all unique terms)
   */
  getVocabulary(): string[] {
    return Array.from(this.vocabulary);
  }

  /**
   * Get the number of documents
   */
  getDocumentCount(): number {
    return this.documents.length;
  }

  /**
   * Simple tokenization - split on whitespace and punctuation
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 1);
  }
}
