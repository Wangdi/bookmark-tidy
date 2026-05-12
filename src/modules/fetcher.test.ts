import { describe, it, expect } from 'vitest';
import { extractContent, classifyError, BATCH_SIZE, BATCH_DELAY } from '../modules/fetcher';

describe('fetcher', () => {
  describe('extractContent', () => {
    it('extracts meta description', () => {
      const html = '<html><head><meta name="description" content="Test description"></head></html>';
      const result = extractContent(html);

      expect(result.meta.description).toBe('Test description');
    });

    it('extracts og:title', () => {
      const html = '<html><head><meta property="og:title" content="OG Title"></head></html>';
      const result = extractContent(html);

      expect(result.meta.ogTitle).toBe('OG Title');
    });

    it('extracts keywords', () => {
      const html = '<html><head><meta name="keywords" content="javascript, typescript, node"></head></html>';
      const result = extractContent(html);

      expect(result.meta.keywords).toEqual(['javascript', 'typescript', 'node']);
    });

    it('extracts headings h1-h6', () => {
      const html = `
        <html>
          <body>
            <h1>Main Title</h1>
            <h2>Section 1</h2>
            <h3>Subsection</h3>
            <h4>Detail</h4>
            <h5>Note</h5>
            <h6>Footer</h6>
          </body>
        </html>
      `;
      const result = extractContent(html);

      expect(result.headings).toContain('Main Title');
      expect(result.headings).toContain('Section 1');
      expect(result.headings).toContain('Subsection');
      expect(result.headings).toContain('Detail');
      expect(result.headings).toContain('Note');
      expect(result.headings).toContain('Footer');
    });

    it('extracts title tag and puts it first', () => {
      const html = '<html><head><title>Page Title</title></head><body><h1>Heading</h1></body></html>';
      const result = extractContent(html);

      expect(result.headings[0]).toBe('Page Title');
      expect(result.headings).toContain('Heading');
    });

    it('strips HTML tags from heading content', () => {
      const html = '<h1><strong>Bold</strong> Title <em>Italic</em></h1>';
      const result = extractContent(html);

      expect(result.headings).toContain('Bold Title Italic');
    });

    it('handles empty HTML', () => {
      const html = '<html></html>';
      const result = extractContent(html);

      expect(result.meta.description).toBeUndefined();
      expect(result.meta.ogTitle).toBeUndefined();
      expect(result.meta.keywords).toBeUndefined();
      expect(result.headings).toEqual([]);
    });

    it('handles missing meta tags', () => {
      const html = '<html><head></head><body><h1>Only Heading</h1></body></html>';
      const result = extractContent(html);

      expect(result.meta).toEqual({});
      expect(result.headings).toContain('Only Heading');
    });

    it('does not duplicate title if same as h1', () => {
      const html = '<html><head><title>Same Title</title></head><body><h1>Same Title</h1></body></html>';
      const result = extractContent(html);

      const titleCount = result.headings.filter(h => h === 'Same Title').length;
      expect(titleCount).toBe(1);
    });

    it('handles case-insensitive meta tag matching', () => {
      const html = '<META NAME="DESCRIPTION" CONTENT="Test">';
      const result = extractContent(html);

      expect(result.meta.description).toBe('Test');
    });

    it('trims whitespace from keywords', () => {
      const html = '<meta name="keywords" content="  javascript ,  typescript  , node  ">';
      const result = extractContent(html);

      expect(result.meta.keywords).toEqual(['javascript', 'typescript', 'node']);
    });

    it('filters empty keywords', () => {
      const html = '<meta name="keywords" content="javascript,,node">';
      const result = extractContent(html);

      expect(result.meta.keywords).toEqual(['javascript', 'node']);
    });
  });

  describe('classifyError', () => {
    it('classifies DNS errors as deadlink', () => {
      expect(classifyError(new Error('ENOTFOUND example.com'))).toBe('deadlink');
      expect(classifyError(new Error('dns lookup failed'))).toBe('deadlink');
      expect(classifyError(new Error('name not resolved'))).toBe('deadlink');
    });

    it('classifies 404 as deadlink', () => {
      expect(classifyError(new Error('404 Not Found'))).toBe('deadlink');
    });

    it('classifies 410 Gone as deadlink', () => {
      expect(classifyError(new Error('410 Gone'))).toBe('deadlink');
    });

    it('classifies other errors as unreachable', () => {
      expect(classifyError(new Error('timeout'))).toBe('unreachable');
      expect(classifyError(new Error('network error'))).toBe('unreachable');
      expect(classifyError(new Error('500 Internal Server Error'))).toBe('unreachable');
      expect(classifyError(new Error('ECONNREFUSED'))).toBe('unreachable');
    });

    it('is case insensitive', () => {
      expect(classifyError(new Error('ENOTFOUND'))).toBe('deadlink');
      expect(classifyError(new Error('enotfound'))).toBe('deadlink');
      expect(classifyError(new Error('DNS ERROR'))).toBe('deadlink');
    });
  });

  describe('constants', () => {
    it('BATCH_SIZE is 5', () => {
      expect(BATCH_SIZE).toBe(5);
    });

    it('BATCH_DELAY is 500ms', () => {
      expect(BATCH_DELAY).toBe(500);
    });
  });
});
