/**
 * Web Worker entry point for off-main-thread markdown rendering.
 *
 * DEP-687: Move rendering pipeline to a Web Worker to free the main thread
 * during streaming. Exposes the same `renderMarkdown` function via Comlink.
 *
 * The worker initializes its own Shiki highlighter instance independently
 * from the main thread.
 *
 * @module
 */

// Minimal DOM shim for dependencies that reference `document` at module load
// time (KaTeX creates DOM nodes via `document.createElement` / `createDocumentFragment`
// at import time). Workers have no `document` global — this shim provides just enough
// surface for the module to load. rehype-katex uses `katex.renderToString()` which
// bypasses real DOM entirely, so these shim nodes are never used at render time.
import './worker-dom-shim.js';

import * as Comlink from 'comlink';
import { initializeHighlighter } from './highlighter.js';
import { renderMarkdownWithMath } from './render.js';
import type { RenderOptions, RenderResult } from './types.js';

const workerApi = {
  // Use the math-aware async entry. The sync `renderMarkdown` deliberately
  // drops math support after the lazy-load refactor — wiring the worker to
  // it would silently regress math rendering for any caller using the
  // worker path. `renderMarkdownWithMath` pre-checks for math markers and
  // only loads remark-math/rehype-katex when needed.
  renderMarkdown(markdown: string, options: RenderOptions = {}): Promise<RenderResult> {
    return renderMarkdownWithMath(markdown, options);
  },
  async initializeHighlighter(): Promise<void> {
    await initializeHighlighter();
  },
};

export type MarkdownWorkerApi = typeof workerApi;
Comlink.expose(workerApi);
