/**
 * First-party Shiki adapter for `<CodeBlock>`.
 *
 * `<CodeBlock>` already auto-loads this adapter with default options when a
 * `language` is set — you only need it directly to customize the theme or
 * preload grammars, which you then pass via the `highlighter` prop:
 *
 * ```svelte
 * <script lang="ts">
 *   import { CodeBlock } from '@lostgradient/cinder';
 *   import { shikiHighlighter } from '@lostgradient/cinder/highlighters/shiki';
 *
 *   const highlighter = shikiHighlighter({ theme: 'github-light' });
 * </script>
 *
 * <CodeBlock {code} language="ts" {highlighter} />
 * ```
 *
 * The factory is synchronous. Shiki itself is imported lazily on the first
 * highlight call inside the returned function — consumers that never invoke
 * the highlighter (or that never import this module) ship zero Shiki bytes
 * in their entry chunk. Subsequent calls reuse the singleton `codeToHtml`
 * import.
 *
 * Behavior contract (matches the {@link Highlighter} type in
 * `@lostgradient/cinder/utilities/highlighter`):
 *
 *   - Returns a complete `<pre><code>...</code></pre>` block as a trusted
 *     HTML string. `<CodeBlock>` injects this via `{@html}` and replaces its
 *     entire highlighted region.
 *   - Empty or missing `lang` → escaped plaintext wrapped in
 *     `<pre><code>` (no highlight). Never throws.
 *   - Unknown / unsupported `lang` → same escaped plaintext fallback, logged
 *     once per language at `console.warn` level. Never throws.
 *   - Aliases that Shiki recognizes natively (e.g. `ts` → `typescript`)
 *     resolve through Shiki's own bundle. We do not invent additional
 *     aliases.
 *   - Internal Shiki failure (grammar load error, theme resolution failure)
 *     → caught, logged, returns escaped plaintext. The `<CodeBlock>` try/
 *     catch around `highlighter()` is the secondary net — the adapter does
 *     not rely on it.
 *
 * HTML safety: Shiki's `codeToHtml` escapes its input; the plaintext
 * fallback path here HTML-escapes the code (`&`, `<`, `>`, `"`, `'`) so
 * `{@html}` injection is safe for both branches.
 */

import type { Highlighter } from '../../utilities/highlighter.ts';
import { createRetryingLoaderCache } from '../../utilities/retrying-loader-cache.ts';

/**
 * Re-exported for backwards compatibility on the public
 * `@lostgradient/cinder/highlighters/shiki` surface. The canonical implementation lives in
 * `utilities/retrying-loader-cache.ts` so `<CodeBlock>`'s default-highlighter
 * seam can reuse it without a static import edge to this adapter module.
 */
export { createRetryingLoaderCache };

/** Options accepted by {@link shikiHighlighter}. */
export type ShikiHighlighterOptions = {
  /**
   * Shiki theme to apply.
   *
   * - A string selects a single theme (e.g. `'github-light'`).
   * - An object `{ light, dark }` enables Shiki's dual-theme mode, which
   *   emits CSS variables that switch based on the consumer's `color-scheme`.
   *   Recommended for apps that use cinder's `light-dark()`-driven theming.
   *
   * Defaults to `{ light: 'github-light', dark: 'github-dark' }`.
   */
  theme?: string | { light: string; dark: string };
  /**
   * Languages to preload at first highlight. When omitted, Shiki's bundled
   * languages resolve lazily on demand — fine for most apps, but preloading
   * is useful when you know up front which grammars will appear (avoids the
   * first-render flash for those languages).
   */
  langs?: ReadonlyArray<string>;
};

const DEFAULT_THEME: { light: string; dark: string } = {
  light: 'github-light',
  dark: 'github-dark',
};

/**
 * HTML-escape a value for safe injection into a `<pre><code>` block.
 *
 * Coerces non-string input to an empty string rather than throwing —
 * the documented contract is "never throws," and untyped JS callers can
 * bypass the `code: string` parameter type the same way they bypass
 * `lang: string`. Coercing to `''` keeps the plaintext fallback rendering
 * (an empty `<pre><code></code></pre>`) without surprising a consumer that
 * passes `null` or `undefined` while building up state.
 */
function escapeHtml(value: string): string {
  const safe = typeof value === 'string' ? value : '';
  return safe
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Render the escaped-plaintext fallback as a full `<pre><code>` block. */
function plaintextBlock(code: string): string {
  return `<pre class="shiki shiki-plaintext"><code>${escapeHtml(code)}</code></pre>`;
}

type CodeToHtmlFunction = typeof import('shiki').codeToHtml;
type BundledLanguages = typeof import('shiki').bundledLanguages;

type ShikiModule = {
  codeToHtml: CodeToHtmlFunction;
  bundledLanguages: BundledLanguages;
};

/**
 * Create a Shiki-backed {@link Highlighter} suitable for
 * `<CodeBlock highlighter={...} />`. See module-level JSDoc for the
 * full behavior contract.
 */
export function shikiHighlighter(options: ShikiHighlighterOptions = {}): Highlighter {
  const { theme = DEFAULT_THEME, langs } = options;
  const warnedLanguages = new Set<string>();

  // Resolve Shiki lazily on the first highlight call. The cache wrapper
  // de-duplicates concurrent loads and evicts rejected promises so a
  // transient import failure does not lock the adapter into the plaintext
  // fallback for the lifetime of this `shikiHighlighter()` instance.
  const loadShiki = createRetryingLoaderCache(async (): Promise<ShikiModule> => {
    const module_ = await import('shiki');
    // Optional preload — if the consumer named specific languages,
    // force them through `codeToHtml` once so Shiki resolves and
    // caches them before the first real call. Failures here are
    // non-fatal; per-call language lookup will still try (and fall
    // back to plaintext on its own miss).
    if (langs !== undefined) {
      for (const lang of langs) {
        try {
          await module_.codeToHtml('', { lang, ...buildThemeOption(theme) });
        } catch {
          // Swallow — the per-call path below logs and falls back.
        }
      }
    }
    return {
      codeToHtml: module_.codeToHtml,
      bundledLanguages: module_.bundledLanguages,
    };
  });

  return async function highlight(code: string, lang: string): Promise<string> {
    // Normalize defensively: the documented contract is "empty or missing
    // lang → escaped plaintext, never throws," but a JavaScript caller can
    // pass `null`/`undefined`/non-string values past the type system. Guard
    // before calling string methods so the contract holds for vanilla-JS
    // consumers too. Markdown fences in the wild also ship things like
    // `'ts '` (trailing whitespace) or `'typescript title="foo"'` (metadata
    // attributes); trim and take the first whitespace-delimited token so
    // the Shiki lookup matches.
    const normalizedLang = typeof lang === 'string' ? (lang.trim().split(/\s+/, 1)[0] ?? '') : '';
    if (normalizedLang === '') {
      return plaintextBlock(code);
    }

    let shiki: ShikiModule;
    try {
      shiki = await loadShiki();
    } catch (error) {
      console.warn('[cinder/highlighters/shiki] failed to load shiki:', error);
      return plaintextBlock(code);
    }

    // Shiki's `bundledLanguages` table already exposes both canonical names
    // and aliases as top-level keys (`typescript` AND `ts`, `javascript` AND
    // `js`, etc.), so a single hasOwn check accepts whatever Shiki accepts
    // natively without us inventing additional aliases.
    if (!Object.hasOwn(shiki.bundledLanguages, normalizedLang)) {
      if (!warnedLanguages.has(normalizedLang)) {
        warnedLanguages.add(normalizedLang);
        console.warn(
          `[cinder/highlighters/shiki] language "${normalizedLang}" is not in Shiki's bundle; rendering as plaintext.`,
        );
      }
      return plaintextBlock(code);
    }

    try {
      return await shiki.codeToHtml(code, {
        lang: normalizedLang,
        ...buildThemeOption(theme),
      });
    } catch (error) {
      // Grammar load failure, theme miss, etc. — log once per language and
      // fall back to plaintext.
      if (!warnedLanguages.has(normalizedLang)) {
        warnedLanguages.add(normalizedLang);
        console.warn(`[cinder/highlighters/shiki] failed to highlight "${normalizedLang}":`, error);
      }
      return plaintextBlock(code);
    }
  };
}

/**
 * Translate the cinder-shaped `theme` option into the Shiki
 * `codeToHtml`-shape options. The single-string form maps to `theme`; the
 * dual-theme object maps to `themes` (Shiki's CSS-variable-driven mode).
 */
function buildThemeOption(
  theme: string | { light: string; dark: string },
): { theme: string } | { themes: { light: string; dark: string } } {
  if (typeof theme === 'string') return { theme };
  return { themes: theme };
}
