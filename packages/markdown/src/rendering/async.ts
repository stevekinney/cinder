/**
 * Async markdown rendering via Web Worker.
 *
 * Import this subpath only when the Worker-based API is needed. Keeping it
 * separate from the synchronous rendering barrel lets bundlers omit the
 * Worker entry and its dependencies from sync-only consumers.
 */

export {
  initializeWorkerHighlighter,
  renderMarkdownAsync,
  terminateMarkdownWorker,
} from './render-async.js';

export type { RenderOptions, RenderResult } from './types.js';
