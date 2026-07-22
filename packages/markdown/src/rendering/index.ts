/**
 * Markdown Rendering Pipeline - Public API
 *
 * DEP-49: Chat markdown rendering pipeline + sanitization.
 *
 * This module provides a lightweight, SSR-safe markdown-to-HTML rendering
 * pipeline for chat messages. It reuses the existing CommonMark + GFM
 * parsing from the document pipeline while adding sanitization and code
 * block metadata extraction.
 *
 * @example
 * ```ts
 * import { renderMarkdown } from '$lib/document/rendering';
 *
 * const result = renderMarkdown('# Hello\n\n```typescript\nconst x = 1;\n```');
 *
 * // Sanitized HTML for rendering
 * console.log(result.html);
 *
 * // Code blocks for copy hooks
 * console.log(result.codeBlocks[0].language); // 'typescript'
 * console.log(result.codeBlocks[0].value);    // 'const x = 1;'
 *
 * // Original markdown for copy/export
 * console.log(result.rawMarkdown);
 *
 * // Safety flag
 * console.log(result.hadUnsafeContent); // false
 * ```
 *
 * @module
 */

// Core rendering function
export {
  clearRenderCache,
  probablyHasMath,
  renderMarkdown,
  renderMarkdownWithMath,
} from './render.js';

// Types
export type { CodeBlockInfo, RenderOptions, RenderResult } from './types.js';

// Streaming rendering utilities
export { findSafeRenderBoundary, splitStreamingContent } from './render-streaming.js';

// Low-level utilities (for advanced use cases)
export { extractCodeBlocks } from './extract-code-blocks.js';
export { createSanitizeSchema, sanitizeSchema } from './sanitize-schema.js';
export { transformUrls, type TransformUrlsResult } from './transform-urls.js';

// Syntax highlighting
export {
  BUNDLED_LANGUAGES,
  PLAINTEXT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  getHighlighter,
  getHighlighterSync,
  initializeHighlighter,
  isBundledLanguage,
  isLanguageSupported,
  type SupportedLanguage,
} from './highlighter.js';

// Mermaid SVG cache (DEP-95)
export {
  clearMermaidCache,
  getCacheKey as getMermaidCacheKey,
  getMermaidCacheSize,
  getCachedSvg as getMermaidCachedSvg,
  setCachedSvg as setMermaidCachedSvg,
} from './mermaid-cache.js';
