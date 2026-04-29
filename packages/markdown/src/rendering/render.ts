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
import rehypeKatex from 'rehype-katex';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

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
 * Rendering-specific markdown parser with GFM and math support.
 *
 * This processor is separate from the shared document pipeline parser so that
 * math syntax ($...$ and $$...$$) is recognized only in the rendering path.
 * The document editing pipeline intentionally does not parse math, preserving
 * raw LaTeX in the AST for copy/export operations.
 */
const renderingParser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);

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
 * Render markdown to sanitized HTML.
 *
 * Pipeline:
 * 1. Parse markdown to mdast using existing CommonMark + GFM parser
 * 2. Remove raw HTML nodes (injection prevention)
 * 3. Sanitize URLs in link/image nodes
 * 4. Extract code block metadata
 * 5. Convert mdast to hast via remark-rehype
 * 6. Sanitize hast via rehype-sanitize
 * 7. Stringify hast to HTML
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

  // Parse markdown to mdast using the rendering-specific parser (includes math)
  const mdast = renderingParser.parse(markdown);

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

  // Render math nodes (inlineMath / math) to KaTeX HTML.
  // rehype-katex defaults: throwOnError=false (invalid LaTeX becomes error markup)
  const mathRenderedHast = unified().use(rehypeKatex).runSync(hast);

  // Apply syntax highlighting to code blocks
  // Note: If the highlighter isn't initialized yet, code blocks are left unhighlighted
  // The highlighter is initialized at app startup via hooks.server.ts
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

  const result: RenderResult = {
    rawMarkdown: markdown,
    html: String(html),
    codeBlocks,
    hadUnsafeContent: hadHtmlNodes || hadUnsafeUrls,
  };

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
  // (same protection as cache-hit path at line 151)
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
