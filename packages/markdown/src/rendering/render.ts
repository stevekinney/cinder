/**
 * Markdown to HTML rendering pipeline.
 *
 * DEP-49: Chat markdown rendering pipeline + sanitization.
 *
 * This module provides a lightweight, SSR-safe rendering pipeline that:
 * - Parses CommonMark + GFM using the existing document pipeline
 * - Sanitizes HTML output via rehype-sanitize (no DOMParser dependency)
 * - Sanitizes URLs during mdast traversal
 * - Extracts code block metadata for copy hooks
 * - Preserves raw Markdown for copy/export
 *
 * @example
 * ```ts
 * import { renderMarkdown } from '$lib/document/rendering';
 *
 * const result = renderMarkdown('# Hello\n\n```js\nconsole.log("hi");\n```');
 * console.log(result.html);           // '<h1>Hello</h1>...'
 * console.log(result.codeBlocks[0]);  // { language: 'js', value: '...', ... }
 * console.log(result.rawMarkdown);    // Original input preserved
 * ```
 *
 * @module
 */

import type { Root as HastRoot } from 'hast';
import type {
  Definition,
  Html,
  ImageReference,
  LinkReference,
  Root as MdastRoot,
  Parent,
} from 'mdast';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import type { Plugin, Processor } from 'unified';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

// rehype-katex and remark-math are loaded lazily via mathPluginLoader
// below — they only enter the graph when probablyHasMath() returns true
// for a given input. Static imports here would defeat the lazy split.

// NOTE: KaTeX requires its CSS to be loaded by the consuming application for
// correct visual rendering. Import the stylesheet in your app entry point:
//   import 'katex/dist/katex.min.css';
// In SvelteKit this typically goes in src/app.css or a layout component.
import { extractCodeBlocks } from './extract-code-blocks.js';
import { getHighlighterSync } from './highlighter.js';
import { rehypeShikiSync } from './rehype-shiki-sync.js';
import { createSanitizeSchema } from './sanitize-schema.js';
import { transformUrls } from './transform-urls.js';
import type { RenderOptions, RenderResult } from './types.js';

/**
 * Math-free rendering parser. Constructed lazily so that the unified
 * pipeline machinery only initializes when something actually renders.
 *
 * Stored as `unknown` because unified's `.use()` return type is a
 * narrowly-parameterised `Processor<P1, P2, ...>` that doesn't extend
 * the zero-arg `Processor` interface. The single cast in `getBaseProcessor`
 * documents the constraint; all consumers get a typed reference.
 */
let baseProcessor: unknown = null;
function getBaseProcessor(): Processor {
  if (!baseProcessor) baseProcessor = unified().use(remarkParse).use(remarkGfm);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- see comment above
  return baseProcessor as Processor;
}

/**
 * Lazy math-plugin loader and the cached math-aware processor.
 *
 * These exist so that markdown without `$` or `$$` never imports
 * `remark-math` or `rehype-katex` — both are >100 KB once their
 * dependencies are resolved. The loader is module-scoped so the chunk
 * is fetched at most once per page-lifetime; subsequent math renders
 * reuse the cached processor.
 *
 * For test injection, see `__setMathPluginLoaderForTests` below.
 */
// rehype-katex's plugin shape isn't statically known after dynamic
// import, so we treat it opaquely. We use `object` rather than `unknown`
// so that `RehypeKatexPlugin | null` doesn't collapse to `unknown` —
// the null disambiguation matters at call sites (no-math path).
type RehypeKatexPlugin = object;
type MathPluginLoader = () => Promise<{
  remarkMath: Plugin;
  rehypeKatex: RehypeKatexPlugin;
}>;
/** Resolved return type of MathPluginLoader, for the cached-promise annotation. */
type MathPlugins = Awaited<ReturnType<MathPluginLoader>>;
let mathPluginLoader: MathPluginLoader = async () => {
  const [remarkMathModule, rehypeKatexModule] = await Promise.all([
    import('remark-math'),
    import('rehype-katex'),
  ]);
  return {
    remarkMath: remarkMathModule.default as Plugin,
    rehypeKatex: rehypeKatexModule.default,
  };
};
let mathPluginsPromise: Promise<MathPlugins> | null = null;
let mathProcessor: unknown = null;

async function ensureMathPipeline(): Promise<{
  processor: Processor;
  rehypeKatex: RehypeKatexPlugin;
}> {
  // Guard against caching a rejected promise. Without this, a transient
  // network error on the first dynamic import would permanently prevent
  // math rendering for the page lifetime, because a rejected Promise is
  // not null and ??= would never attempt a retry.
  if (!mathPluginsPromise) {
    mathPluginsPromise = mathPluginLoader().catch((error) => {
      mathPluginsPromise = null; // allow retry on next render
      throw error;
    });
  }
  const { remarkMath, rehypeKatex } = await mathPluginsPromise;
  if (!mathProcessor) {
    mathProcessor = unified().use(remarkParse).use(remarkGfm).use(remarkMath);
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- see baseProcessor note above
  return { processor: mathProcessor as Processor, rehypeKatex };
}

/**
 * Test-only override of the math-plugin loader.
 *
 * Replaces `mathPluginLoader` AND clears the dependent singleton state
 * (`mathPluginsPromise`, `mathProcessor`). Without
 * the singleton reset, a stub installed after a real load would never
 * be called because the cached promise would already be resolved.
 *
 * Returns a cleanup function that restores the previous loader and
 * clears the singleton state again, so subsequent tests start fresh.
 *
 * Not re-exported from packages/markdown/src/rendering/index.ts. Test
 * code imports it via the deep specifier `./render.js` from inside the
 * markdown package's tests.
 */
export function __setMathPluginLoaderForTests(loader: MathPluginLoader): () => void {
  const previous = mathPluginLoader;
  mathPluginLoader = loader;
  mathPluginsPromise = null;
  mathProcessor = null;
  return () => {
    mathPluginLoader = previous;
    mathPluginsPromise = null;
    mathProcessor = null;
  };
}

/**
 * Cheap pre-check: does this markdown probably contain math?
 *
 * Strips fenced and inline code first (where `$` is not math), then
 * looks for a `$$` display block or a `$…$` inline-math pair. The
 * inline regex requires the body to start AND end with non-whitespace
 * — that lets us reject prose like "$5 today" while still accepting
 * single-character bodies like `$x$`.
 *
 * False positives (extra chunk load) are tolerable; false negatives
 * silently break math rendering, so the regex errs toward `true` when
 * in doubt.
 */
export function probablyHasMath(markdown: string): boolean {
  if (!markdown.includes('$')) return false;
  const codeStripped = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/~~~[\s\S]*?~~~/g, '')
    .replace(/`[^`\n]*`/g, '');
  if (codeStripped.includes('$$')) return true;
  // Neutralise escaped backslashes (\\) before testing for an escaped dollar
  // (\$). Without this, `\\$x$` — a literal backslash followed by inline
  // math — is incorrectly rejected: the lookbehind sees the second `\` of
  // `\\` and treats the `$` as escaped, producing a false negative.
  const escaped = codeStripped.replace(/\\\\/g, '');
  return /(?<!\\)\$\S(?:[^$\n]*?\S)?\$/.test(escaped);
}

/**
 * LRU cache for rendered results.
 *
 * Caches rendering results to avoid redundant processing for the same input.
 * Uses a simple Map with manual eviction when size exceeds limit.
 */
const CACHE_SIZE = 50;
const cache = new Map<string, RenderResult>();

/**
 * Deterministically stringify render options for cache keys.
 *
 * Ensures that semantically equivalent option objects with different
 * property insertion orders produce the same string representation.
 */
function stableStringifyOptions(options: RenderOptions): string {
  const entries = Object.entries(options).toSorted(([a], [b]) => a.localeCompare(b));

  return entries.map(([key, value]) => `${key}:${JSON.stringify(value)}`).join('|');
}

/**
 * Generate a cache key from markdown, options, and highlighter state.
 *
 * Includes highlighter availability to prevent caching unhighlighted results
 * during the brief window before the highlighter is initialized.
 */
function getCacheKey(markdown: string, options: RenderOptions, hasHighlighter: boolean): string {
  return `${markdown}::${stableStringifyOptions(options)}::hl:${hasHighlighter}`;
}

/**
 * Clone a RenderResult to prevent cache corruption from caller mutations.
 *
 * Returns a shallow clone with a new codeBlocks array. The CodeBlockInfo
 * objects themselves are not cloned since they are value objects that
 * callers have no reason to mutate.
 */
function cloneResult(result: RenderResult): RenderResult {
  return {
    rawMarkdown: result.rawMarkdown,
    html: result.html,
    codeBlocks: [...result.codeBlocks],
    hadUnsafeContent: result.hadUnsafeContent,
  };
}

/**
 * Remove raw HTML nodes from mdast.
 *
 * Raw HTML in markdown (e.g., `<script>alert(1)</script>`) is represented
 * as `html` type nodes. We remove these entirely to prevent injection.
 *
 * Uses a Set for O(1) lookup when filtering children arrays.
 *
 * @returns Whether any HTML nodes were removed
 */
function removeRawHtmlNodes(root: MdastRoot): boolean {
  // Collect nodes to remove using Set for O(1) lookup (can't remove during visit)
  const nodesToRemove = new Set<Html>();

  visit(root, 'html', (node: Html) => {
    nodesToRemove.add(node);
  });

  // Remove collected nodes by filtering children
  if (nodesToRemove.size > 0) {
    visit(root, (node) => {
      if ('children' in node && Array.isArray(node.children)) {
        node.children = node.children.filter((child) => !nodesToRemove.has(child as Html));
      }
    });
  }

  return nodesToRemove.size > 0;
}

/**
 * Strip link nodes from mdast, replacing them with their children (link text).
 *
 * This prevents nested anchor tags when rendering markdown inside anchor elements.
 * The link text is preserved, but the wrapping `<a>` tag is removed.
 *
 * Handles both:
 * - Inline links: `[text](url)`
 * - Reference-style links: `[text][ref]` with `[ref]: url` definitions
 *
 * Note: Only removes definitions that are used by linkReference nodes, not those
 * used by imageReference nodes, to preserve reference-style images.
 *
 * @param root - The mdast root node to transform
 */
function stripLinkNodes(root: MdastRoot): void {
  // Collect identifiers used by linkReference nodes (to remove their definitions)
  const linkRefIdentifiers = new Set<string>();
  visit(root, 'linkReference', (node: LinkReference) => {
    linkRefIdentifiers.add(node.identifier);
  });

  // Also collect identifiers used by imageReference nodes (to preserve their definitions)
  const imageRefIdentifiers = new Set<string>();
  visit(root, 'imageReference', (node: ImageReference) => {
    imageRefIdentifiers.add(node.identifier);
  });

  // Remove definitions that are ONLY used by linkReference nodes, not imageReference.
  // If a definition is shared by both a link and an image, keep it for the image.
  if (linkRefIdentifiers.size > 0) {
    const definitionsToRemove = new Set<Definition>();

    visit(root, 'definition', (node: Definition) => {
      // Only remove if used by a link reference AND NOT by an image reference
      if (linkRefIdentifiers.has(node.identifier) && !imageRefIdentifiers.has(node.identifier)) {
        definitionsToRemove.add(node);
      }
    });

    if (definitionsToRemove.size > 0) {
      visit(root, (node) => {
        if ('children' in node && Array.isArray(node.children)) {
          node.children = node.children.filter(
            (child) => !definitionsToRemove.has(child as Definition),
          );
        }
      });
    }
  }

  // Then handle link and linkReference nodes
  visit(root, (node, index, parent) => {
    if (parent && typeof index === 'number') {
      if (node.type === 'link') {
        const linkNode = node;
        const parentNode = parent as Parent;
        // Replace link node with its children (the link text)
        parentNode.children.splice(index, 1, ...linkNode.children);
        // Return index to revisit the same position since we replaced nodes
        return index;
      }

      if (node.type === 'linkReference') {
        const linkRefNode = node;
        const parentNode = parent as Parent;
        // Replace linkReference node with its children (the link text)
        parentNode.children.splice(index, 1, ...linkRefNode.children);
        return index;
      }
    }

    return undefined;
  });
}

/**
 * Internal core that does the rendering work, given a parsed mdast and an
 * already-loaded rehype-katex (or null for the no-math path). Shared by
 * the sync `renderMarkdown` and async `renderMarkdownWithMath` entry points
 * so the pipeline only lives in one place.
 */
function renderFromMdast(
  markdown: string,
  options: RenderOptions,
  mdast: MdastRoot,
  rehypeKatex: RehypeKatexPlugin | null,
): RenderResult {
  // Remove raw HTML nodes
  const hadHtmlNodes = removeRawHtmlNodes(mdast);

  // Sanitize URLs
  const { hadUnsafeUrls } = transformUrls(mdast, {
    allowDataImages: options.allowDataImages ?? false,
  });

  // Strip links if requested (to prevent nested anchors)
  if (options.stripLinks) {
    stripLinkNodes(mdast);
  }

  // Extract code block metadata before conversion
  const codeBlocks = extractCodeBlocks(mdast);

  // Create sanitization schema
  const schema = createSanitizeSchema({
    allowDataImages: options.allowDataImages ?? false,
  });

  // Convert mdast to hast
  const hast = unified().use(remarkRehype, { allowDangerousHtml: false }).runSync(mdast);

  // Render math nodes (inlineMath / math) to KaTeX HTML, only if the math
  // pipeline has been loaded. rehype-katex defaults: throwOnError=false
  // (invalid LaTeX becomes error markup).
  const mathRenderedHast =
    rehypeKatex === null
      ? hast
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any -- plugin shape is opaque after dynamic import
        unified()
          .use(rehypeKatex as any)
          .runSync(hast);

  // Apply syntax highlighting to code blocks. If the highlighter isn't
  // initialized yet, code blocks are left unhighlighted — the highlighter
  // initializes lazily on first getHighlighter() call.
  const highlightedHast = unified()
    .use(rehypeShikiSync, { theme: 'depict', defaultLanguage: 'plaintext' })
    .runSync(mathRenderedHast as HastRoot);

  // Sanitize the hast - MUST use runSync() to execute the transform
  // Note: stringify() only runs the compiler, not transforms, so we need
  // to run sanitization explicitly before stringifying
  const sanitizedHast = unified()
    .use(rehypeSanitize, schema)
    .runSync(highlightedHast as HastRoot);

  // Stringify the sanitized hast to HTML
  const html = unified().use(rehypeStringify).stringify(sanitizedHast);

  return {
    rawMarkdown: markdown,
    html: String(html),
    codeBlocks,
    hadUnsafeContent: hadHtmlNodes || hadUnsafeUrls,
  };
}

/**
 * Render markdown to sanitized HTML — synchronous, no math.
 *
 * Math syntax (`$…$`, `$$…$$`) passes through as raw text. Callers that
 * need math support must use `renderMarkdownWithMath` instead, which gates
 * the math plugins behind a dynamic import.
 *
 * This is an intentional internal behavior change: before code splitting,
 * sync `renderMarkdown` rendered math eagerly because remark-math and
 * rehype-katex were statically imported. Switching to async shaves ~200 KB
 * off the chat entry chunk for math-free messages, which is the common case.
 *
 * Pipeline:
 * 1. Parse markdown to mdast using CommonMark + GFM (no math)
 * 2. Remove raw HTML nodes (injection prevention)
 * 3. Sanitize URLs in link/image nodes
 * 4. Extract code block metadata
 * 5. Convert mdast to hast via remark-rehype
 * 6. Apply Shiki syntax highlighting (if highlighter is initialized)
 * 7. Sanitize hast via rehype-sanitize
 * 8. Stringify hast to HTML
 *
 * @param markdown - Raw markdown string
 * @param options - Rendering options
 * @returns Render result with HTML, code blocks, and safety flags
 */
export function renderMarkdown(markdown: string, options: RenderOptions = {}): RenderResult {
  // Handle empty/null input
  if (!markdown || typeof markdown !== 'string') {
    return {
      rawMarkdown: markdown ?? '',
      html: '',
      codeBlocks: [],
      hadUnsafeContent: false,
    };
  }

  // Check cache (include highlighter state to prevent caching unhighlighted results)
  const hasHighlighter = getHighlighterSync() !== null;
  const cacheKey = getCacheKey(markdown, options, hasHighlighter);
  const cached = cache.get(cacheKey);
  if (cached) {
    // Move to end (LRU behavior)
    cache.delete(cacheKey);
    cache.set(cacheKey, cached);
    // Return a clone to prevent caller mutations from corrupting the cache
    return cloneResult(cached);
  }

  // Parse markdown to mdast (no math).
  const mdast = getBaseProcessor().parse(markdown) as MdastRoot;
  const result = renderFromMdast(markdown, options, mdast, null);

  // Add to cache (with LRU eviction)
  if (cache.size >= CACHE_SIZE) {
    // Delete oldest entry (first key in Map iteration order)
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) {
      cache.delete(firstKey);
    }
  }
  cache.set(cacheKey, result);

  // Return a clone to prevent caller mutations from corrupting the cache
  // (same protection as cache-hit path)
  return cloneResult(result);
}

/**
 * Render markdown to sanitized HTML — async, with math support.
 *
 * Behaves identically to `renderMarkdown` for math-free input. When the
 * input contains `$…$` or `$$…$$`, dynamically imports `remark-math` and
 * `rehype-katex` (one-time, cached for the page lifetime), parses with
 * the math-aware processor, and renders math nodes via KaTeX.
 *
 * This is the entry point chat / preview surfaces should call when math
 * may be in the content. The dynamic import is what keeps the math
 * pipeline out of the initial bundle.
 *
 * @param markdown - Raw markdown string
 * @param options - Rendering options
 * @returns Promise resolving to a render result
 */
export async function renderMarkdownWithMath(
  markdown: string,
  options: RenderOptions = {},
): Promise<RenderResult> {
  if (!markdown || typeof markdown !== 'string') {
    return {
      rawMarkdown: markdown ?? '',
      html: '',
      codeBlocks: [],
      hadUnsafeContent: false,
    };
  }

  // Fast path: no math → use the sync, no-math pipeline. The caller still
  // pays the await/microtask cost but no math chunk loads.
  if (!probablyHasMath(markdown)) {
    return renderMarkdown(markdown, options);
  }

  // Cache check (math-aware key — math output differs from the no-math one).
  const hasHighlighter = getHighlighterSync() !== null;
  const cacheKey = `math::${getCacheKey(markdown, options, hasHighlighter)}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    cache.delete(cacheKey);
    cache.set(cacheKey, cached);
    return cloneResult(cached);
  }

  const { processor, rehypeKatex } = await ensureMathPipeline();
  const mdast = processor.parse(markdown) as MdastRoot;
  const result = renderFromMdast(markdown, options, mdast, rehypeKatex);

  if (cache.size >= CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(cacheKey, result);
  return cloneResult(result);
}

/**
 * Clear the render cache.
 *
 * Useful for testing or memory management.
 */
export function clearRenderCache(): void {
  cache.clear();
}
