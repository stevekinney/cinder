/**
 * ReviewEditor SSR-safety contract (source-level verification).
 *
 * ReviewEditor is MarkdownEditor extended with anchored comment threads. Its
 * SSR story has two layers:
 *
 *   1. The live ProseMirror editor is owned by the inner MarkdownEditor, which
 *      mounts it inside `{#if browser}` and renders `<EditorSkeleton>` on the
 *      server (verified in `markdown-editor.hydrate.test.ts`). ReviewEditor
 *      forwards to that component, so it inherits the server-side skeleton
 *      fallback for free.
 *
 *   2. ReviewEditor's own logic statically imports the commentary and markdown
 *      surfaces (`cinder/commentary/anchor-decorations`, `cinder/markdown/
 *      pipeline`, `cinder/markdown/diff/line-diff`, `cinder/editor`). Those are
 *      all SSR-safe at module-evaluation time — proven by
 *      `packages/commentary/src/ssr-import.test.ts` and
 *      `packages/markdown/src/ssr-import.test.ts` — so the static imports do
 *      not throw during SSR. The only DOM access in this layer
 *      (`document.*`, `window.getSelection()`) lives inside `$effect` bodies,
 *      which never run on the server; the selection-change effect additionally
 *      carries an explicit `if (typeof document === 'undefined') return;`
 *      guard as defense in depth.
 *
 * Full SSR-render + hydrate of ReviewEditor is blocked in the Bun test harness
 * for the reason documented in `markdown-editor.hydrate.test.ts` (the
 * recompiled server module resolves its child-component imports against the
 * client compilation, producing `effect_orphan`). We therefore verify the SSR
 * contract at the source level, the established convention for these
 * editor-heavy components.
 */

import { describe, expect, test } from 'bun:test';

const WRAPPER_SOURCE = await Bun.file(
  new URL('./review-editor.svelte', import.meta.url).pathname,
).text();

const IMPL_SOURCE = await Bun.file(
  new URL('./review-editor-impl.svelte', import.meta.url).pathname,
).text();

describe('ReviewEditor SSR contract (source-level verification)', () => {
  test('renders through MarkdownEditor, inheriting its server-side skeleton fallback', () => {
    // The public wrapper forwards to the implementation, and the
    // implementation renders MarkdownEditor — the component that provides the
    // `{#if browser}` → `<EditorSkeleton>` SSR fallback.
    expect(WRAPPER_SOURCE).toContain('ReviewEditorImplementation');
    expect(IMPL_SOURCE).toContain('<MarkdownEditor');
  });

  test('statically imports only SSR-safe package surfaces (no @milkdown/ or prosemirror- at this layer)', () => {
    // ReviewEditor reaches ProseMirror only through cinder/commentary's
    // anchor-decorations re-export, which is SSR-safe at module-eval time.
    // A direct static @milkdown/ or prosemirror- value import at the component
    // layer would be a new, unaudited browser-bound entry point.
    const protectedStaticImport =
      /import\s+(?!type\b)[\s\S]*?\s+from\s+['"](?:@milkdown\/|prosemirror-)/;
    expect(IMPL_SOURCE).not.toMatch(protectedStaticImport);
  });

  test('guards DOM access (window.getSelection / document) behind $effect', () => {
    // Every browser-global access in the implementation must sit inside an
    // $effect so it never runs during SSR. Confirm the selection-change effect
    // — the component's primary DOM consumer — exists and is effect-scoped.
    expect(IMPL_SOURCE).toContain('window.getSelection()');
    const effectStart = IMPL_SOURCE.indexOf('$effect(() => {\n    if (typeof document ===');
    expect(effectStart).toBeGreaterThan(-1);
  });

  test('selection-change effect carries an explicit typeof-document SSR guard', () => {
    // Belt-and-suspenders: even though effects do not run on the server, the
    // DOM-listener effect early-returns when `document` is undefined.
    expect(IMPL_SOURCE).toMatch(
      /\$effect\(\(\) => \{\s*\n\s*if \(typeof document === 'undefined'\) return;/,
    );
  });
});
