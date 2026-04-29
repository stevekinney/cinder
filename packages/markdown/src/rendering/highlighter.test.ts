/**
 * Unit tests for the syntax highlighter module.
 *
 * DEP-79: Add syntax highlighting to code blocks across the application.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import {
  BUNDLED_LANGUAGES,
  CSS_VARIABLE_THEME,
  getHighlighter,
  getHighlighterSync,
  initializeHighlighter,
  isBundledLanguage,
  isLanguageSupported,
  PLAINTEXT_LANGUAGE,
  resetHighlighter,
  SUPPORTED_LANGUAGES,
} from './highlighter.js';

describe('highlighter', () => {
  describe('initialization', () => {
    // Reset before each test in this block to test fresh state
    beforeEach(() => {
      resetHighlighter();
    });
    it('returns null from getHighlighterSync before initialization', () => {
      expect(getHighlighterSync()).toBeNull();
    });

    it('returns highlighter after initialization', async () => {
      await initializeHighlighter();
      const highlighter = getHighlighterSync();
      expect(highlighter).not.toBeNull();
      expect(highlighter).toHaveProperty('codeToHtml');
    });

    it('getHighlighter initializes and returns highlighter', async () => {
      const highlighter = await getHighlighter();
      expect(highlighter).not.toBeNull();
      expect(highlighter).toHaveProperty('codeToHtml');
    });

    it('returns same instance on multiple calls', async () => {
      const h1 = await getHighlighter();
      const h2 = await getHighlighter();
      expect(h1).toBe(h2);
    });

    it('resetHighlighter clears the instance', async () => {
      // Use a fresh instance for this test (reset any state from other tests)
      resetHighlighter();
      await initializeHighlighter();
      expect(getHighlighterSync()).not.toBeNull();
      resetHighlighter();
      expect(getHighlighterSync()).toBeNull();
    });
  });

  describe('language support', () => {
    it('BUNDLED_LANGUAGES contains expected languages', () => {
      expect(BUNDLED_LANGUAGES).toContain('typescript');
      expect(BUNDLED_LANGUAGES).toContain('javascript');
      expect(BUNDLED_LANGUAGES).toContain('python');
      expect(BUNDLED_LANGUAGES).toContain('sql');
      expect(BUNDLED_LANGUAGES).toContain('bash');
      expect(BUNDLED_LANGUAGES).toContain('json');
      expect(BUNDLED_LANGUAGES).toContain('yaml');
      expect(BUNDLED_LANGUAGES).toContain('svelte');
      expect(BUNDLED_LANGUAGES).toContain('css');
      expect(BUNDLED_LANGUAGES).toContain('html');
      expect(BUNDLED_LANGUAGES).toContain('diff');
      expect(BUNDLED_LANGUAGES).toContain('markdown');
    });

    it('SUPPORTED_LANGUAGES includes BUNDLED_LANGUAGES plus plaintext', () => {
      for (const lang of BUNDLED_LANGUAGES) {
        expect(SUPPORTED_LANGUAGES).toContain(lang);
      }
      expect(SUPPORTED_LANGUAGES).toContain(PLAINTEXT_LANGUAGE);
    });

    it('PLAINTEXT_LANGUAGE is "plaintext"', () => {
      expect(PLAINTEXT_LANGUAGE).toBe('plaintext');
    });

    it('isBundledLanguage returns true for bundled languages', () => {
      expect(isBundledLanguage('typescript')).toBe(true);
      expect(isBundledLanguage('javascript')).toBe(true);
      expect(isBundledLanguage('python')).toBe(true);
    });

    it('isBundledLanguage returns false for plaintext', () => {
      expect(isBundledLanguage('plaintext')).toBe(false);
    });

    it('isBundledLanguage returns false for unknown languages', () => {
      expect(isBundledLanguage('unknownlang')).toBe(false);
      expect(isBundledLanguage('made-up')).toBe(false);
    });

    it('isLanguageSupported returns true for bundled languages', () => {
      expect(isLanguageSupported('typescript')).toBe(true);
      expect(isLanguageSupported('python')).toBe(true);
    });

    it('isLanguageSupported returns true for plaintext', () => {
      expect(isLanguageSupported('plaintext')).toBe(true);
    });

    it('isLanguageSupported returns false for unknown languages', () => {
      expect(isLanguageSupported('unknownlang')).toBe(false);
    });
  });

  describe('CSS_VARIABLE_THEME', () => {
    it('has name "depict"', () => {
      expect(CSS_VARIABLE_THEME.name).toBe('depict');
    });

    it('has editor colors defined', () => {
      // The theme has colors defined; Shiki may transform them internally
      expect(CSS_VARIABLE_THEME.colors).toBeDefined();
      expect(CSS_VARIABLE_THEME.colors?.['editor.background']).toBeDefined();
      expect(CSS_VARIABLE_THEME.colors?.['editor.foreground']).toBeDefined();
    });

    it('has tokenColors for common scopes', () => {
      const tokenColors = CSS_VARIABLE_THEME.tokenColors ?? [];
      const scopes = tokenColors.flatMap((tc) => (Array.isArray(tc.scope) ? tc.scope : [tc.scope]));

      // Check that major token types are covered
      expect(scopes).toContain('comment');
      expect(scopes).toContain('string');
      expect(scopes).toContain('keyword');
      expect(scopes.some((s) => s?.includes('function'))).toBe(true);
      expect(scopes.some((s) => s?.includes('variable'))).toBe(true);
      expect(scopes.some((s) => s?.includes('type'))).toBe(true);
      expect(scopes.some((s) => s?.includes('constant'))).toBe(true);
    });

    it('uses CSS variables for token colors', () => {
      const tokenColors = CSS_VARIABLE_THEME.tokenColors ?? [];
      for (const tc of tokenColors) {
        const fg = tc.settings?.foreground;
        if (fg) {
          expect(fg).toMatch(/^var\(--/);
        }
      }
    });
  });

  describe('highlighting', () => {
    beforeAll(async () => {
      await initializeHighlighter();
    });

    it('highlights TypeScript code', () => {
      const highlighter = getHighlighterSync()!;
      const html = highlighter.codeToHtml('const x: number = 42;', {
        lang: 'typescript',
        theme: 'depict',
      });

      expect(html).toContain('const');
      expect(html).toContain('42');
      expect(html).toContain('style=');
      expect(html).toContain('var(--syntax-');
    });

    it('highlights JavaScript code', () => {
      const highlighter = getHighlighterSync()!;
      const html = highlighter.codeToHtml('function hello() { return "world"; }', {
        lang: 'javascript',
        theme: 'depict',
      });

      expect(html).toContain('function');
      expect(html).toContain('hello');
      expect(html).toContain('world');
    });

    it('highlights Python code', () => {
      const highlighter = getHighlighterSync()!;
      const html = highlighter.codeToHtml('def greet(name):\n    print(f"Hello, {name}!")', {
        lang: 'python',
        theme: 'depict',
      });

      expect(html).toContain('def');
      expect(html).toContain('greet');
      expect(html).toContain('print');
    });

    it('includes Shiki classes on pre element', () => {
      const highlighter = getHighlighterSync()!;
      const html = highlighter.codeToHtml('let x = 1;', {
        lang: 'javascript',
        theme: 'depict',
      });

      expect(html).toContain('class="shiki depict"');
    });
  });
});
