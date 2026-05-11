import { describe, it, expect } from 'vitest';
import { normalizeUrl, isValidUrl, isFetchableUrl, extractDomain } from '../utils/url-normalizer';

describe('url-normalizer', () => {
  describe('normalizeUrl', () => {
    it('normalizes URLs by removing protocol and www', () => {
      expect(normalizeUrl('https://www.example.com/path')).toBe('example.com/path');
      expect(normalizeUrl('http://example.com/path')).toBe('example.com/path');
    });

    it('removes trailing slash from path', () => {
      expect(normalizeUrl('https://example.com/path/')).toBe('example.com/path');
    });

    it('sorts query parameters alphabetically', () => {
      expect(normalizeUrl('https://example.com?b=2&a=1')).toBe('example.com/?a=1&b=2');
    });

    it('removes tracking parameters', () => {
      expect(normalizeUrl('https://example.com?utm_source=google&id=123')).toBe('example.com/?id=123');
      expect(normalizeUrl('https://example.com?fbclid=abc&ref=twitter&page=1')).toBe('example.com/?page=1');
    });

    it('preserves hash fragment', () => {
      expect(normalizeUrl('https://example.com/path#section')).toBe('example.com/path#section');
    });

    it('handles URLs with no path', () => {
      // Root path "/" is preserved
      expect(normalizeUrl('https://www.example.com')).toBe('example.com/');
    });

    it('handles complex URLs', () => {
      const url = 'https://www.example.com/path/?utm_source=test&sort=desc&filter=active#results';
      expect(normalizeUrl(url)).toBe('example.com/path?filter=active&sort=desc#results');
    });

    it('returns lowercase for invalid URLs', () => {
      expect(normalizeUrl('NOT A URL')).toBe('not a url');
    });
  });

  describe('isValidUrl', () => {
    it('returns true for valid HTTP URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://example.com/path?query=1')).toBe(true);
    });

    it('returns true for valid non-HTTP URLs', () => {
      expect(isValidUrl('chrome://extensions')).toBe(true);
      expect(isValidUrl('file:///home/user/file.txt')).toBe(true);
    });

    it('returns false for invalid URLs', () => {
      expect(isValidUrl('not a url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
  });

  describe('isFetchableUrl', () => {
    it('returns true for HTTP/HTTPS URLs', () => {
      expect(isFetchableUrl('https://example.com')).toBe(true);
      expect(isFetchableUrl('http://example.com')).toBe(true);
    });

    it('returns false for chrome:// URLs', () => {
      expect(isFetchableUrl('chrome://extensions')).toBe(false);
      expect(isFetchableUrl('chrome://flags')).toBe(false);
    });

    it('returns false for view-source: URLs', () => {
      expect(isFetchableUrl('view-source:https://example.com')).toBe(false);
    });

    it('returns false for other unsupported schemes', () => {
      expect(isFetchableUrl('about:blank')).toBe(false);
      expect(isFetchableUrl('javascript:void(0)')).toBe(false);
      expect(isFetchableUrl('file:///home/user/file.txt')).toBe(false);
      expect(isFetchableUrl('data:text/html,<h1>test</h1>')).toBe(false);
    });

    it('is case insensitive for scheme detection', () => {
      expect(isFetchableUrl('CHROME://extensions')).toBe(false);
      expect(isFetchableUrl('View-Source:https://example.com')).toBe(false);
    });
  });

  describe('extractDomain', () => {
    it('extracts domain from URL', () => {
      expect(extractDomain('https://www.example.com/path')).toBe('example.com');
      expect(extractDomain('https://subdomain.example.com')).toBe('subdomain.example.com');
    });

    it('removes www prefix', () => {
      expect(extractDomain('https://www.example.com')).toBe('example.com');
    });

    it('returns empty string for invalid URLs', () => {
      expect(extractDomain('not a url')).toBe('');
    });
  });
});
