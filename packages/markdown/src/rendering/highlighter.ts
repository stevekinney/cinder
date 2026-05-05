/**
 * Syntax highlighting configuration for the markdown rendering pipeline.
 *
 * This module provides a Shiki highlighter configured with:
 * - CSS variable theme that maps to design system tokens
 * - Common languages for software development content
 * - Singleton pattern to avoid repeated initialization
 *
 * The CSS variable approach enables instant light/dark theme switching
 * without re-highlighting, since colors are resolved at render time.
 *
 * Why this file uses `shiki/core` + per-language dynamic imports rather
 * than `import { createHighlighter } from 'shiki'`: the default `shiki`
 * entry resolves to `bundle-full.mjs`, which statically references all
 * 253 bundled grammars. Even with `langs: BUNDLED_LANGUAGES` (12 langs)
 * passed at runtime, the bundler can't see the runtime filter and ships
 * every grammar (~10 MB). Switching to `shiki/core` and importing each
 * grammar individually as a dynamic import keeps the bundle to only the
 * languages we actually use.
 *
 * @module
 */

import { createOnigurumaEngine } from '@shikijs/engine-oniguruma';
import type {
  DynamicImportLanguageRegistration,
  HighlighterCore,
  ThemeRegistration,
} from '@shikijs/types';
import { createHighlighterCore } from 'shiki/core';

/**
 * Special language value for plain text (no highlighting).
 * Shiki doesn't have a built-in 'plaintext' language, so we handle it
 * separately from the bundled languages.
 */
export const PLAINTEXT_LANGUAGE = 'plaintext' as const;
export type PlaintextLanguage = typeof PLAINTEXT_LANGUAGE;

/**
 * Bundled languages loaded into the highlighter.
 *
 * These are real Shiki grammars and will be highlighted at render time.
 * To add a language: add it to this array AND add a corresponding loader
 * to `LANGUAGE_LOADERS` below. The exhaustive `Record` type forces both
 * to stay in sync — the file won't compile if a language is missing a
 * loader.
 */
export const BUNDLED_LANGUAGES = [
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
] as const;

export type BundledLanguage = (typeof BUNDLED_LANGUAGES)[number];

/** Re-export under the original name for backward compat with existing call sites. */
export type SupportedLanguage = BundledLanguage | PlaintextLanguage;

/**
 * All supported languages including plaintext.
 *
 * This list covers the most common languages in software documentation
 * and chat contexts. Additional languages can be loaded dynamically via
 * `highlighter.loadLanguage()` if needed.
 */
export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  ...BUNDLED_LANGUAGES,
  PLAINTEXT_LANGUAGE,
];

type LanguageLoader = DynamicImportLanguageRegistration;

/**
 * Per-language dynamic import map. Each value is a function returning a
 * Promise so the bundler emits one async chunk per language and only the
 * languages listed here are fetched.
 *
 * The `Record<BundledLanguage, …>` shape is exhaustive: TypeScript fails
 * to compile if `BUNDLED_LANGUAGES` adds a value with no matching loader.
 * If a `@shikijs/langs/<name>` subpath does not exist in the installed
 * shiki version, the dynamic import fails at module evaluation with a
 * clear "Cannot find module" error — which is the desired loud failure.
 */
const LANGUAGE_LOADERS: Record<BundledLanguage, LanguageLoader> = {
  typescript: () => import('@shikijs/langs/typescript'),
  javascript: () => import('@shikijs/langs/javascript'),
  python: () => import('@shikijs/langs/python'),
  sql: () => import('@shikijs/langs/sql'),
  bash: () => import('@shikijs/langs/bash'),
  json: () => import('@shikijs/langs/json'),
  yaml: () => import('@shikijs/langs/yaml'),
  markdown: () => import('@shikijs/langs/markdown'),
  svelte: () => import('@shikijs/langs/svelte'),
  css: () => import('@shikijs/langs/css'),
  html: () => import('@shikijs/langs/html'),
  diff: () => import('@shikijs/langs/diff'),
};

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
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: { foreground: 'var(--syntax-comment)' },
    },
    {
      scope: ['string', 'string.quoted', 'string.template'],
      settings: { foreground: 'var(--syntax-string)' },
    },
    {
      scope: ['keyword', 'storage', 'storage.type', 'storage.modifier'],
      settings: { foreground: 'var(--syntax-keyword)' },
    },
    {
      scope: ['entity.name.function', 'support.function'],
      settings: { foreground: 'var(--syntax-function)' },
    },
    {
      scope: ['variable', 'variable.other', 'variable.parameter'],
      settings: { foreground: 'var(--syntax-variable)' },
    },
    {
      scope: ['entity.name.type', 'entity.name.class', 'support.type'],
      settings: { foreground: 'var(--syntax-type)' },
    },
    {
      scope: ['constant.numeric'],
      settings: { foreground: 'var(--syntax-number)' },
    },
    {
      scope: ['keyword.operator', 'punctuation'],
      settings: { foreground: 'var(--syntax-operator)' },
    },
    {
      scope: ['constant', 'constant.language'],
      settings: { foreground: 'var(--syntax-constant)' },
    },
    {
      scope: ['variable.other.property', 'meta.object-literal.key'],
      settings: { foreground: 'var(--syntax-property)' },
    },
    {
      scope: ['entity.name.tag'],
      settings: { foreground: 'var(--syntax-tag)' },
    },
    {
      scope: ['entity.other.attribute-name'],
      settings: { foreground: 'var(--syntax-attribute)' },
    },
    {
      scope: ['string.regexp'],
      settings: { foreground: 'var(--syntax-regex)' },
    },
    {
      scope: ['markup.inserted', 'meta.diff.header.to-file'],
      settings: { foreground: 'var(--syntax-inserted)' },
    },
    {
      scope: ['markup.deleted', 'meta.diff.header.from-file'],
      settings: { foreground: 'var(--syntax-deleted)' },
    },
  ],
};

/**
 * Singleton highlighter instance.
 *
 * `highlighterInstance` is the resolved highlighter; `highlighterPromise`
 * is the in-flight initialization. Concurrent callers share the same
 * Promise so initialization runs at most once. The Promise resolves only
 * after every language loader has resolved, so `getHighlighterSync()`
 * cannot observe a half-initialized state.
 */
let highlighterInstance: HighlighterCore | null = null;
let highlighterPromise: Promise<HighlighterCore> | null = null;

/**
 * Get the shared Shiki highlighter instance (async).
 *
 * Creates the highlighter on first call and returns the cached instance
 * for subsequent calls. The highlighter is configured with our CSS variable
 * theme and supported languages.
 *
 * @returns Promise resolving to the configured Shiki highlighter
 */
export async function getHighlighter(): Promise<HighlighterCore> {
  if (highlighterInstance) {
    return highlighterInstance;
  }
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [CSS_VARIABLE_THEME],
      langs: BUNDLED_LANGUAGES.map((lang) => LANGUAGE_LOADERS[lang]()),
      engine: createOnigurumaEngine(import('shiki/wasm')),
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
export function getHighlighterSync(): HighlighterCore | null {
  return highlighterInstance;
}

/**
 * Initialize the highlighter and return it.
 *
 * Convenience wrapper around `getHighlighter()`. Call at app startup to
 * ensure synchronous access is available.
 *
 * @returns Promise resolving to the configured Shiki highlighter
 */
export async function initializeHighlighter(): Promise<HighlighterCore> {
  return getHighlighter();
}

/**
 * Check if a language is a bundled Shiki language (not plaintext).
 */
export function isBundledLanguage(language: string): language is BundledLanguage {
  return (BUNDLED_LANGUAGES as readonly string[]).includes(language);
}

/**
 * Check if a language is supported (bundled or plaintext).
 */
export function isLanguageSupported(language: string): language is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(language);
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

/** Re-exported for tests and consumers of the public type. */
export type { HighlighterCore as Highlighter, ThemeRegistration } from '@shikijs/types';
