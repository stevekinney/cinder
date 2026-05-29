/**
 * The lazy default-highlighter seam for `<CodeBlock>`.
 *
 * `<CodeBlock>` highlights automatically when a `language` is set and no
 * explicit `highlighter` prop is passed. Rather than statically importing the
 * Shiki adapter (which would pull Shiki into every consumer's entry chunk and
 * break SSR-bundle safety), CodeBlock calls {@link loadDefaultHighlighter}
 * from inside a client-only `$effect`. That defers BOTH the Shiki module
 * import AND this module's `shikiHighlighter()` factory call until a block
 * actually needs highlighting.
 *
 * This is also the single mock seam for CodeBlock's unit tests: tests
 * `mock.module()` THIS exact module specifier, never the public
 * `cinder/highlighters/shiki` subpath (which CodeBlock does not import
 * directly). Mocking here is what makes the "default import is NOT invoked
 * when an explicit `highlighter` is provided" assertion real instead of
 * false-confidence.
 *
 * Lifecycle:
 *
 *   - The Shiki adapter import is wrapped in `createRetryingLoaderCache`, so
 *     it loads at most once, concurrent callers share one in-flight promise,
 *     and a REJECTED load is evicted so a later highlight retries (a transient
 *     chunk-load failure does not poison the cache forever).
 *   - The `shikiHighlighter()` instance is memoized on first successful load.
 *     The instance itself lazy-imports `shiki` on its first highlight call and
 *     applies the adapter's default dual-theme (`github-light` / `github-dark`),
 *     so the default path re-themes with cinder's light/dark switch.
 */

import type { Highlighter } from '../../utilities/highlighter.ts';
import { createRetryingLoaderCache } from '../../utilities/retrying-loader-cache.ts';

type ShikiAdapterModule = typeof import('../../highlighters/shiki/index.ts');

/**
 * Dynamically import the Shiki adapter module. Kept as a dedicated arrow so
 * the retrying cache wraps a single specifier, and so the dynamic `import()`
 * is the ONLY reference to the adapter from CodeBlock's import graph — there
 * is no static edge (asserted by `code-block.bundle-boundary.test.ts`).
 */
const loadShikiAdapterModule = createRetryingLoaderCache<ShikiAdapterModule>(
  () => import('../../highlighters/shiki/index.ts'),
);

/** Memoized default highlighter instance, created once on first success. */
let defaultHighlighter: Highlighter | undefined;

/**
 * Resolve the bundled default highlighter, loading the Shiki adapter lazily
 * on the first call and memoizing the resulting {@link Highlighter} instance.
 *
 * Returns the same instance on every subsequent call. The instance applies
 * the Shiki adapter's default options, whose output escapes the code text
 * (the only safety claim cinder makes for the `{@html}` boundary — see the
 * `@security` note on {@link Highlighter}).
 */
export async function loadDefaultHighlighter(): Promise<Highlighter> {
  if (defaultHighlighter !== undefined) return defaultHighlighter;
  const module_ = await loadShikiAdapterModule();
  defaultHighlighter ??= module_.shikiHighlighter();
  return defaultHighlighter;
}
