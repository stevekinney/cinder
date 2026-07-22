/**
 * @lostgradient/markdown SSR import safety.
 *
 * Mirrors `packages/commentary/src/editor/ssr-import.test.ts` (formerly `packages/editor/src/ssr-import.test.ts`). The contract this guards:
 * importing any entry point of `@lostgradient/markdown` in a server (no-DOM)
 * context must NOT touch a browser-only global at module-evaluation time.
 *
 * Why this matters: ReviewEditor and Chat statically import markdown
 * utilities (`@lostgradient/markdown/pipeline`, `@lostgradient/markdown/diff`,
 * `@lostgradient/markdown/rendering`). Those static imports execute during SSR, so
 * any module-eval-time `document`/`window`/`getSelection` access would throw
 * on the server before a fallback could render.
 *
 * Unlike @cinder/editor, this package depends on NONE of the browser-bound
 * packages (@milkdown/, prosemirror-). Its parsing stack is remark/unified,
 * which is SSR-safe, and its rendering stack (shiki/rehype/katex) defers all
 * DOM and Web Worker work behind runtime guards (see
 * `rendering/render-async.ts`, which only constructs a `Worker` inside
 * `getProxy()` after a `typeof Worker === 'undefined' || typeof window ===
 * 'undefined'` check). So the only invariant to enforce here is the
 * module-eval one.
 *
 * Approach (matching @cinder/editor): the DOM-only globals are *deleted*
 * before each dynamic import — not replaced with throwing stubs — so the test
 * models a genuine Node SSR environment where `document`/`window` simply do
 * not exist and `typeof` checks resolve to `'undefined'`. `navigator` is left
 * in place because Node and Bun both define it and SSR-safe libraries read it
 * defensively behind `typeof navigator !== 'undefined'`; deleting it would
 * model an environment that does not occur in practice.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

// Browser-only globals that are genuinely absent in a Node SSR context.
const SSR_ABSENT_GLOBALS = ['document', 'window', 'getSelection'] as const;

const savedDescriptors: { name: string; descriptor: PropertyDescriptor | undefined }[] = [];

function removeBrowserGlobals(): void {
  savedDescriptors.length = 0;
  for (const name of SSR_ABSENT_GLOBALS) {
    savedDescriptors.push({ name, descriptor: Object.getOwnPropertyDescriptor(globalThis, name) });
    Reflect.deleteProperty(globalThis, name);
  }
}

function restoreBrowserGlobals(): void {
  for (const { name, descriptor } of savedDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  }
  savedDescriptors.length = 0;
}

beforeEach(removeBrowserGlobals);
afterEach(restoreBrowserGlobals);

describe('@lostgradient/markdown SSR import safety', () => {
  it('imports the package barrel without needing browser globals', async () => {
    const markdownModule = await import('./index.js');
    expect(typeof markdownModule.diff).toBe('object');
    expect(typeof markdownModule.pipeline).toBe('object');
  });

  it('imports the pipeline subpath without needing browser globals', async () => {
    const pipelineModule = await import('./pipeline/index.js');
    expect(typeof pipelineModule.normalize).toBe('function');
    expect(typeof pipelineModule.contentEquals).toBe('function');
  });

  it('imports the diff subpath without needing browser globals', async () => {
    const diffModule = await import('./diff/index.js');
    expect(typeof diffModule.computeLineDiff).toBe('function');
  });

  it('imports the rendering subpath without needing browser globals', async () => {
    const renderingModule = await import('./rendering/index.js');
    expect(typeof renderingModule.renderMarkdown).toBe('function');
    expect('renderMarkdownAsync' in renderingModule).toBe(false);
  });

  it('imports the async rendering subpath without needing browser globals', async () => {
    const asyncRenderingModule = await import('./rendering/async.js');
    expect(typeof asyncRenderingModule.renderMarkdownAsync).toBe('function');
  });

  it('imports the templates/sanitize-html subpath without needing browser globals', async () => {
    const sanitizeHtmlModule = await import('./templates/sanitize-html.js');
    expect(typeof sanitizeHtmlModule.sanitizeHtml).toBe('function');
  });

  it('imports the templates/template-placeholders subpath without needing browser globals', async () => {
    const templatePlaceholdersModule = await import('./templates/template-placeholders.js');
    expect(typeof templatePlaceholdersModule.resolveTemplatePlaceholders).toBe('function');
  });

  it('imports the templates/template-render subpath without needing browser globals', async () => {
    const templateRenderModule = await import('./templates/template-render.js');
    expect(typeof templateRenderModule.renderTemplate).toBe('function');
  });
});
