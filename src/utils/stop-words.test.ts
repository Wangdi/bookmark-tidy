import { describe, it, expect } from 'vitest';
import { STOP_WORDS } from '../utils/stop-words';

describe('stop-words', () => {
  describe('STOP_WORDS', () => {
    it('is a Set', () => {
      expect(STOP_WORDS).toBeInstanceOf(Set);
    });

    it('contains common articles', () => {
      expect(STOP_WORDS.has('a')).toBe(true);
      expect(STOP_WORDS.has('an')).toBe(true);
      expect(STOP_WORDS.has('the')).toBe(true);
    });

    it('contains common conjunctions', () => {
      expect(STOP_WORDS.has('and')).toBe(true);
      expect(STOP_WORDS.has('but')).toBe(true);
      expect(STOP_WORDS.has('or')).toBe(true);
    });

    it('contains common prepositions', () => {
      expect(STOP_WORDS.has('in')).toBe(true);
      expect(STOP_WORDS.has('on')).toBe(true);
      expect(STOP_WORDS.has('at')).toBe(true);
      expect(STOP_WORDS.has('to')).toBe(true);
      expect(STOP_WORDS.has('from')).toBe(true);
      expect(STOP_WORDS.has('with')).toBe(true);
    });

    it('contains common pronouns', () => {
      expect(STOP_WORDS.has('i')).toBe(true);
      expect(STOP_WORDS.has('you')).toBe(true);
      expect(STOP_WORDS.has('he')).toBe(true);
      expect(STOP_WORDS.has('she')).toBe(true);
      expect(STOP_WORDS.has('it')).toBe(true);
      expect(STOP_WORDS.has('they')).toBe(true);
      expect(STOP_WORDS.has('this')).toBe(true);
      expect(STOP_WORDS.has('that')).toBe(true);
    });

    it('contains auxiliary verbs', () => {
      expect(STOP_WORDS.has('is')).toBe(true);
      expect(STOP_WORDS.has('are')).toBe(true);
      expect(STOP_WORDS.has('was')).toBe(true);
      expect(STOP_WORDS.has('were')).toBe(true);
      expect(STOP_WORDS.has('have')).toBe(true);
      expect(STOP_WORDS.has('has')).toBe(true);
      expect(STOP_WORDS.has('will')).toBe(true);
      expect(STOP_WORDS.has('can')).toBe(true);
    });

    it('contains web-specific noise words', () => {
      expect(STOP_WORDS.has('home')).toBe(true);
      expect(STOP_WORDS.has('page')).toBe(true);
      expect(STOP_WORDS.has('site')).toBe(true);
      expect(STOP_WORDS.has('click')).toBe(true);
      expect(STOP_WORDS.has('login')).toBe(true);
    });

    it('does not contain meaningful content words', () => {
      expect(STOP_WORDS.has('javascript')).toBe(false);
      expect(STOP_WORDS.has('programming')).toBe(false);
      expect(STOP_WORDS.has('tutorial')).toBe(false);
      expect(STOP_WORDS.has('news')).toBe(false);
      expect(STOP_WORDS.has('technology')).toBe(false);
    });

    it('is case-sensitive (all lowercase)', () => {
      expect(STOP_WORDS.has('The')).toBe(false);
      expect(STOP_WORDS.has('THE')).toBe(false);
      expect(STOP_WORDS.has('the')).toBe(true);
    });

    it('has reasonable size', () => {
      // Should have at least 50 stop words
      expect(STOP_WORDS.size).toBeGreaterThan(50);
      // But not too many (keep it reasonable)
      expect(STOP_WORDS.size).toBeLessThan(200);
    });
  });
});
