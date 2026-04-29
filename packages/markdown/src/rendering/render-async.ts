/**
 * Async markdown rendering via Web Worker.
 *
 * DEP-687: Move rendering pipeline to a Web Worker to free the main thread
 * during streaming at 30+ tokens/second.
 *
 * Lazily creates a Worker + Comlink proxy on first call. Falls back to
 * synchronous rendering for SSR, worker creation failure, and individual
 * render failure.
 *
 * @module
 */

import type { Remote } from 'comlink';
import * as Comlink from 'comlink';
import type { MarkdownWorkerApi } from './render-worker.js';
import { renderMarkdown } from './render.js';
import type { RenderOptions, RenderResult } from './types.js';

// Minimal Worker declarations for this module. The package tsconfig uses
// Node types only (no DOM lib), but this code runs in the browser where
// Worker is available. The `typeof` runtime guard prevents SSR usage.
// The event listener methods are required for Comlink.Endpoint compatibility.
declare class Worker {
  constructor(url: URL | string, options?: { type?: string });
  terminate(): void;
  postMessage(message: unknown): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

// Minimal EventListener types to satisfy the Worker declaration above.
// These are structural — Comlink only needs the shape, not DOM lib globals.
declare interface EventListenerOrEventListenerObject {
  handleEvent?: (event: object) => void;
  (event: object): void;
}

let worker: Worker | null = null;
let proxy: Remote<MarkdownWorkerApi> | null = null;
let workerFailed = false;
let highlighterInitialized = false;

function getProxy(): Remote<MarkdownWorkerApi> | null {
  if (workerFailed) return null;
  if (proxy) return proxy;

  if (typeof Worker === 'undefined' || typeof window === 'undefined') {
    workerFailed = true;
    return null;
  }

  try {
    worker = new Worker(new URL('./render-worker.js', import.meta.url), { type: 'module' });
    // The Worker declaration above satisfies Comlink.Endpoint structurally
    // (postMessage + addEventListener/removeEventListener), so the cast is safe.
    proxy = Comlink.wrap<MarkdownWorkerApi>(worker as Comlink.Endpoint);
    return proxy;
  } catch {
    workerFailed = true;
    return null;
  }
}

/**
 * Render markdown asynchronously via Web Worker.
 *
 * Falls back to synchronous `renderMarkdown()` when:
 * - Running in SSR (no Worker global)
 * - Worker creation failed
 * - Individual render call fails
 */
export async function renderMarkdownAsync(
  markdown: string,
  options: RenderOptions = {},
): Promise<RenderResult> {
  const p = getProxy();
  if (!p) return renderMarkdown(markdown, options);

  try {
    return await p.renderMarkdown(markdown, options);
  } catch {
    // The worker channel is broken (crash, Comlink failure, etc.). Mark it as
    // failed and terminate so future calls don't keep hitting a dead proxy.
    // Reset highlighterInitialized so initializeWorkerHighlighter() reaches
    // getProxy() on re-mount and returns false instead of short-circuiting.
    worker?.terminate();
    worker = null;
    proxy = null;
    workerFailed = true;
    highlighterInitialized = false;
    return renderMarkdown(markdown, options);
  }
}

/**
 * Initialize the Shiki highlighter inside the Web Worker.
 *
 * The worker maintains its own highlighter instance, separate from
 * the main thread. Call this after the main-thread highlighter is ready.
 *
 * Returns `true` when the worker highlighter initialized successfully, `false`
 * when the worker is unavailable or Shiki initialization failed. Callers must
 * check the return value before treating the worker as highlighted — setting
 * `workerHighlighterReady` unconditionally would cause unhighlighted worker
 * output to become sticky when initialization silently failed.
 */
export async function initializeWorkerHighlighter(): Promise<boolean> {
  if (highlighterInitialized) return true;

  const p = getProxy();
  if (!p) return false;

  try {
    await p.initializeHighlighter();
    highlighterInitialized = true;
    return true;
  } catch {
    /* renders proceed without highlighting */
    return false;
  }
}

/**
 * Terminate the markdown rendering Worker.
 *
 * Cleans up the Worker thread and resets state so a fresh Worker
 * will be created on the next render call. Useful for cleanup
 * in tests or when the component tree unmounts.
 */
export function terminateMarkdownWorker(): void {
  worker?.terminate();
  worker = null;
  proxy = null;
  workerFailed = false;
  highlighterInitialized = false;
}
