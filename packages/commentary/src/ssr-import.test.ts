/**
 * @cinder/commentary SSR import safety.
 *
 * Mirrors `packages/editor/src/ssr-import.test.ts`. The contract this guards:
 * importing any entry point of `@cinder/commentary` in a server (no-DOM)
 * context must NOT touch a browser-only global at module-evaluation time.
 *
 * Why this matters: ReviewEditor statically imports the commentary anchoring
 * and decoration surfaces (`@cinder/commentary/anchor-decorations`,
 * `@cinder/commentary/anchoring`, `@cinder/commentary/comments`). Those static
 * imports execute during SSR, so any module-eval-time `document`/`window`/
 * `getSelection` access would throw on the server before a fallback skeleton
 * could render.
 *
 * BROWSER-BOUND DEPENDENCY — the deliberate, SSR-safe exception:
 * `anchor-decorations.ts` is the ProseMirror plugin layer for comment anchors.
 * It statically value-imports `@milkdown/kit/prose/state` and
 * `@milkdown/kit/prose/view` (which re-export prosemirror-state and
 * prosemirror-view). That is the SAME legitimate pattern as @cinder/editor:
 * this module IS the browser-side editor layer, and a *static* import is
 * correct because prosemirror itself is SSR-safe at module-evaluation time —
 * `prosemirror-view` reads `document`/`navigator` only behind
 * `typeof X !== 'undefined'` guards, so when those globals are absent it
 * falls back to null/"" rather than throwing. There is therefore nothing to
 * defer behind a runtime browser guard at this layer; the SSR boundary lives
 * in the consuming Svelte component (MarkdownEditor mounts the live editor
 * inside `{#if browser}`).
 *
 * Approach (matching @cinder/editor): the DOM-only globals are *deleted*
 * before each dynamic import so the test models a genuine Node SSR
 * environment where `document`/`window` do not exist and prosemirror's
 * `typeof`-guarded reads resolve to the safe branch. `navigator` is left in
 * place because Node and Bun both define it and prosemirror reads it
 * defensively; deleting it would model an environment that does not occur in
 * practice. NOTE: this package preloads happy-dom (see bunfig.toml), so these
 * globals are present unless explicitly removed here — deletion is what makes
 * the assertion meaningful.
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

describe('@cinder/commentary SSR import safety', () => {
  it('imports the package barrel without needing browser globals', async () => {
    // The barrel re-exports `anchor-decorations`, which transitively pulls in
    // prosemirror-view. This assertion therefore also proves that the
    // prosemirror dependency is SSR-safe at module-evaluation time.
    const commentaryModule = await import('./index.js');
    expect(typeof commentaryModule.generateBlockId).toBe('function');
    expect(typeof commentaryModule.createAnchorPlugin).toBe('function');
  });

  it('imports the anchor-decorations subpath (prosemirror layer) without needing browser globals', async () => {
    const anchorDecorationsModule = await import('./anchor-decorations.js');
    expect(typeof anchorDecorationsModule.createAnchorPlugin).toBe('function');
  });

  it('imports the anchoring subpath without needing browser globals', async () => {
    const anchoringModule = await import('./anchoring.js');
    expect(typeof anchoringModule.generateBlockId).toBe('function');
  });

  it('imports the comments subpath without needing browser globals', async () => {
    const commentsModule = await import('./comments/index.js');
    expect(typeof commentsModule.extractMentions).toBe('function');
  });

  it('imports the session subpath without needing browser globals', async () => {
    const sessionModule = await import('./session/index.js');
    expect(typeof sessionModule.createSession).toBe('function');
  });

  it('imports the export subpath without needing browser globals', async () => {
    const exportModule = await import('./export/index.js');
    expect(typeof exportModule.generateMarkdownSummary).toBe('function');
  });
});
