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
 * in their entry chunk. Subsequent calls reuse the singleton highlighter
 * instance.
 *
 * Why this builds on `shiki/core` + `@shikijs/engine-oniguruma` rather than
 * `import { createHighlighter } from 'shiki'` (see
 * `packages/markdown/src/rendering/highlighter.ts` for the sibling adapter
 * that established this pattern, and `docs/decisions/package-boundaries.md`
 * for the ~10 MB measurement this converges on): the default `shiki` entry
 * resolves to `bundle-full.mjs`, which statically references every bundled
 * grammar and theme in one module. For a build that bundles that module with
 * `splitting: false` — which is exactly how `scripts/build.ts` builds this
 * adapter — every grammar and theme gets inlined into a single output file,
 * regardless of which language is ever highlighted. `shiki` was already kept
 * external in that build (so this specific file never actually shipped that
 * weight), but the risk was one dependency-externals edit away from landing
 * back in cinder's own published dist. `shiki/langs` and `shiki/themes`
 * expose the same per-language and per-theme lookup tables `shiki`
 * re-exports, but as standalone modules (metadata plus a lazy
 * `() => import('@shikijs/langs/…')` per entry) that pull in no theme, wasm,
 * or highlighter-construction code — so `scripts/build.ts` only needs to
 * externalize `shiki/*` and `@shikijs/engine-oniguruma` (see its
 * `runtimeDependencyExternals`) to keep every one of those per-language/
 * per-theme dynamic imports lazy, exactly like the sibling markdown adapter.
 * Downstream, a consumer's own bundler resolves and splits those imports the
 * same way it already did for the old `shiki`-based version — this change
 * does not reduce what a consumer app ships; it converges the pattern with
 * `packages/markdown` and closes the build-time regression risk above.
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

import type {
  DynamicImportLanguageRegistration,
  DynamicImportThemeRegistration,
  HighlighterCore,
} from '@shikijs/types';

import type { Highlighter } from '../../utilities/highlighter.ts';
import { createRetryingLoaderCache } from '../../utilities/retrying-loader-cache.ts';
import { stripRootPreTabIndex } from './strip-root-pre-tab-index.ts';

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

/**
 * Widened to a plain string index (rather than `typeof import('shiki/langs')
 * .bundledLanguages`, whose keys are a closed literal union) because lookups
 * here are keyed by a `lang`/theme name string that is only known to be a
 * member of that union after a runtime `Object.hasOwn` check.
 */
type BundledLanguages = Record<string, DynamicImportLanguageRegistration>;
type BundledThemes = Record<string, DynamicImportThemeRegistration>;

type ShikiModule = {
  highlighter: HighlighterCore;
  bundledLanguages: BundledLanguages;
  bundledThemes: BundledThemes;
};

type ShikiModuleLoader = () => Promise<ShikiModule>;

/**
 * Load (if not already loaded) the grammar registered under `lang` — a
 * canonical Shiki language id or one of its native aliases, both of which
 * are keys of `bundledLanguages`. `HighlighterCore.loadLanguage` is safe to
 * call repeatedly for a language it already holds — the dynamic `import()`
 * resolves from the module cache and re-registering is a cheap map write —
 * so callers don't need to track what has already been loaded.
 */
async function ensureLanguageLoaded(shiki: ShikiModule, lang: string): Promise<void> {
  const load = shiki.bundledLanguages[lang];
  if (!load) throw new Error(`Language "${lang}" is not bundled with Shiki.`);
  await shiki.highlighter.loadLanguage(load);
}

/** Load (if not already loaded) every theme named by `theme`. */
async function ensureThemesLoaded(
  shiki: ShikiModule,
  theme: string | { light: string; dark: string },
): Promise<void> {
  const names = typeof theme === 'string' ? [theme] : [theme.light, theme.dark];
  for (const name of names) {
    const load = shiki.bundledThemes[name];
    if (!load) throw new Error(`Theme "${name}" is not bundled with Shiki.`);
    await shiki.highlighter.loadTheme(load);
  }
}

/**
 * Create a Shiki-backed {@link Highlighter} suitable for
 * `<CodeBlock highlighter={...} />`. See module-level JSDoc for the
 * full behavior contract.
 */
export function shikiHighlighter(
  options: ShikiHighlighterOptions = {},
  moduleLoader?: ShikiModuleLoader,
): Highlighter {
  const { theme = DEFAULT_THEME, langs } = options;
  const warnedLanguages = new Set<string>();

  // Resolve Shiki lazily on the first highlight call. The cache wrapper
  // de-duplicates concurrent loads and evicts rejected promises so a
  // transient import failure does not lock the adapter into the plaintext
  // fallback for the lifetime of this `shikiHighlighter()` instance.
  const loadShiki = createRetryingLoaderCache(
    moduleLoader ??
      (async (): Promise<ShikiModule> => {
        const [{ createOnigurumaEngine }, { createHighlighterCore }, langsModule, themesModule] =
          await Promise.all([
            import('@shikijs/engine-oniguruma'),
            import('shiki/core'),
            import('shiki/langs'),
            import('shiki/themes'),
          ]);
        const highlighter = await createHighlighterCore({
          themes: [],
          langs: [],
          engine: createOnigurumaEngine(import('shiki/wasm')),
        });
        const shikiModule: ShikiModule = {
          highlighter,
          bundledLanguages: langsModule.bundledLanguages,
          bundledThemes: themesModule.bundledThemes,
        };

        // Optional preload — if the consumer named specific languages, load
        // them (and the configured theme) up front so Shiki resolves and
        // caches them before the first real call. Failures here are
        // non-fatal; per-call language lookup will still try (and fall back
        // to plaintext on its own miss).
        if (langs !== undefined) {
          for (const lang of langs) {
            try {
              await ensureThemesLoaded(shikiModule, theme);
              await ensureLanguageLoaded(shikiModule, lang);
            } catch {
              // Swallow — the per-call path below logs and falls back.
            }
          }
        }
        return shikiModule;
      }),
  );

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
      await ensureLanguageLoaded(shiki, normalizedLang);
      await ensureThemesLoaded(shiki, theme);
      const html = shiki.highlighter.codeToHtml(code, {
        lang: normalizedLang,
        ...buildThemeOption(theme),
      });
      return stripRootPreTabIndex(html);
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
