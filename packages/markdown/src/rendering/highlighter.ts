/**
 * Syntax highlighting configuration for the markdown rendering pipeline.
 *
 * DEP-79: Add syntax highlighting to code blocks across the application.
 *
 * This module provides a Shiki highlighter configured with:
 * - CSS variable theme that maps to design system tokens
 * - Common languages for software development content
 * - Singleton pattern to avoid repeated initialization
 *
 * The CSS variable approach enables instant light/dark theme switching
 * without re-highlighting, since colors are resolved at render time.
 *
 * @module
 */

import type { BundledLanguage, Highlighter, ThemeRegistration } from 'shiki';
import { createHighlighter } from 'shiki';

/**
 * Special language value for plain text (no highlighting).
 * This is handled separately from BundledLanguage since Shiki
 * doesn't have a built-in 'plaintext' language.
 */
export const PLAINTEXT_LANGUAGE = 'plaintext' as const;
export type PlaintextLanguage = typeof PLAINTEXT_LANGUAGE;
export type SupportedLanguage = BundledLanguage | PlaintextLanguage;

/**
 * Bundled languages loaded into the highlighter.
 * These are actual Shiki languages that will be highlighted.
 */
export const BUNDLED_LANGUAGES: BundledLanguage[] = [
  'typescript',
  'javascript',
  'python',
  'sql',
  'bash',
  'json',
  'yaml',
  'markdown',
  'svelte',
  'css',
  'html',
  'diff',
];

/**
 * All supported languages including plaintext.
 *
 * This list covers the most common languages in software documentation
 * and chat contexts. Additional languages can be loaded dynamically via
 * `highlighter.loadLanguage()` if needed.
 */
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [...BUNDLED_LANGUAGES, PLAINTEXT_LANGUAGE];

/**
 * CSS variable theme for syntax highlighting.
 *
 * Maps TextMate scopes to CSS custom properties defined in tokens.css.
 * Using CSS variables enables instant theme switching without re-highlighting,
 * since the browser resolves `var()` references at render time based on
 * the current `color-scheme` or `data-theme` attribute.
 *
 * The theme type is set to 'dark' but this is arbitrary since actual colors
 * come from CSS variables that adapt to light/dark mode automatically.
 */
export const CSS_VARIABLE_THEME: ThemeRegistration = {
  name: 'depict',
  type: 'dark',
  colors: {
    'editor.background': 'var(--surface-inset)',
    'editor.foreground': 'var(--text)',
  },
  tokenColors: [
    // Comments - muted, recedes visually
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: { foreground: 'var(--syntax-comment)' },
    },
    // Strings - all string types
    {
      scope: ['string', 'string.quoted', 'string.template'],
      settings: { foreground: 'var(--syntax-string)' },
    },
    // Keywords and storage
    {
      scope: ['keyword', 'storage', 'storage.type', 'storage.modifier'],
      settings: { foreground: 'var(--syntax-keyword)' },
    },
    // Functions
    {
      scope: ['entity.name.function', 'support.function'],
      settings: { foreground: 'var(--syntax-function)' },
    },
    // Variables and parameters
    {
      scope: ['variable', 'variable.other', 'variable.parameter'],
      settings: { foreground: 'var(--syntax-variable)' },
    },
    // Types and classes
    {
      scope: ['entity.name.type', 'entity.name.class', 'support.type'],
      settings: { foreground: 'var(--syntax-type)' },
    },
    // Numbers
    {
      scope: ['constant.numeric'],
      settings: { foreground: 'var(--syntax-number)' },
    },
    // Operators and punctuation
    {
      scope: ['keyword.operator', 'punctuation'],
      settings: { foreground: 'var(--syntax-operator)' },
    },
    // Constants (boolean, null, etc.)
    {
      scope: ['constant', 'constant.language'],
      settings: { foreground: 'var(--syntax-constant)' },
    },
    // Properties and object keys
    {
      scope: ['variable.other.property', 'meta.object-literal.key'],
      settings: { foreground: 'var(--syntax-property)' },
    },
    // HTML/JSX tags
    {
      scope: ['entity.name.tag'],
      settings: { foreground: 'var(--syntax-tag)' },
    },
    // Attribute names
    {
      scope: ['entity.other.attribute-name'],
      settings: { foreground: 'var(--syntax-attribute)' },
    },
    // Regex patterns
    {
      scope: ['string.regexp'],
      settings: { foreground: 'var(--syntax-regex)' },
    },
    // Diff - inserted lines
    {
      scope: ['markup.inserted', 'meta.diff.header.to-file'],
      settings: { foreground: 'var(--syntax-inserted)' },
    },
    // Diff - deleted lines
    {
      scope: ['markup.deleted', 'meta.diff.header.from-file'],
      settings: { foreground: 'var(--syntax-deleted)' },
    },
  ],
};

/**
 * Singleton highlighter instance.
 *
 * Initialized via top-level await to ensure the highlighter is ready
 * before any code tries to use it. This enables synchronous usage in
 * the render pipeline while keeping the async initialization transparent.
 */
let highlighterInstance: Highlighter | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;

/**
 * Get the shared Shiki highlighter instance (async).
 *
 * Creates the highlighter on first call and returns the cached instance
 * for subsequent calls. The highlighter is configured with our CSS variable
 * theme and supported languages.
 *
 * @returns Promise resolving to the configured Shiki highlighter
 *
 * @example
 * ```ts
 * import { getHighlighter } from '$lib/document/rendering/highlighter';
 *
 * const highlighter = await getHighlighter();
 * const html = highlighter.codeToHtml('const x = 1;', {
 *   lang: 'typescript',
 *   theme: 'depict',
 * });
 * ```
 */
export async function getHighlighter(): Promise<Highlighter> {
  if (highlighterInstance) {
    return highlighterInstance;
  }
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [CSS_VARIABLE_THEME],
      langs: BUNDLED_LANGUAGES,
    }).then((highlighter) => {
      highlighterInstance = highlighter;
      return highlighter;
    });
  }
  return highlighterPromise;
}

/**
 * Get the highlighter instance synchronously.
 *
 * Returns the cached highlighter if it has been initialized, or null if not.
 * Use this when you need synchronous access and can handle the case where
 * the highlighter isn't ready yet.
 *
 * @returns The highlighter instance, or null if not yet initialized
 */
export function getHighlighterSync(): Highlighter | null {
  return highlighterInstance;
}

/**
 * Initialize the highlighter and return it.
 *
 * This is a convenience function that ensures the highlighter is ready.
 * Call this at application startup to ensure synchronous access is available.
 *
 * @returns Promise resolving to the configured Shiki highlighter
 */
export async function initializeHighlighter(): Promise<Highlighter> {
  return getHighlighter();
}

/**
 * Check if a language is a bundled Shiki language (not plaintext).
 *
 * @param language - Language identifier to check
 * @returns True if the language is a bundled Shiki language
 */
export function isBundledLanguage(language: string): language is BundledLanguage {
  return BUNDLED_LANGUAGES.includes(language as BundledLanguage);
}

/**
 * Check if a language is supported (bundled or plaintext).
 *
 * @param language - Language identifier to check
 * @returns True if the language is in the supported list
 */
export function isLanguageSupported(language: string): language is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(language as SupportedLanguage);
}

/**
 * Reset the highlighter instance.
 *
 * Primarily useful for testing. Clears the singleton so the next
 * `getHighlighter()` call creates a fresh instance.
 */
export function resetHighlighter(): void {
  highlighterInstance = null;
  highlighterPromise = null;
}
