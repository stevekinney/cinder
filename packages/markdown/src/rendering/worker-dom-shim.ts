/**
 * Minimal DOM shim for Web Worker context.
 *
 * DEP-687: KaTeX references `document.createElement` and
 * `document.createDocumentFragment` at module load time. Workers lack
 * the `document` global, causing a ReferenceError that crashes the worker
 * before it can handle any messages.
 *
 * This shim provides a bare-minimum `document` object so KaTeX's module
 * initialization succeeds. The actual rendering path uses
 * `katex.renderToString()` (via rehype-katex), which produces HTML strings
 * without touching the DOM, so these stub nodes are never used at runtime.
 *
 * Must be imported before any module that transitively imports KaTeX.
 *
 * @module
 */

const shimElement = {
  appendChild() {
    return shimElement;
  },
  setAttribute() {},
  // KaTeX checks .nodeName in some paths
  nodeName: '',
  textContent: '',
  innerHTML: '',
  children: [],
  childNodes: [],
  style: {},
};

const shimDocument = {
  // KaTeX checks `document.compatMode !== 'CSS1Compat'` and warns in quirks mode.
  // Standards mode is the expected/correct value.
  compatMode: 'CSS1Compat',
  createElement() {
    return { ...shimElement };
  },
  createDocumentFragment() {
    return { ...shimElement };
  },
  createTextNode(text: string) {
    return { ...shimElement, textContent: text };
  },
};

// Only install the shim if `document` is not already defined (i.e. Worker context).
// The typeof guard is safe even without DOM lib types — it evaluates at runtime.
if (typeof (globalThis as Record<string, unknown>)['document'] === 'undefined') {
  (globalThis as Record<string, unknown>)['document'] = shimDocument;
}
