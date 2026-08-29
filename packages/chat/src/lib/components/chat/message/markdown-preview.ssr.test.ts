/// <reference lib="dom" />

/**
 * Chat markdown-preview SSR-safety contract.
 *
 * The chat surface renders message bodies through `markdown-preview.svelte`,
 * which is where `@lostgradient/markdown`'s rendering pipeline (shiki/rehype/katex)
 * enters the component tree. That pipeline is SSR-safe at module-evaluation
 * time (see `packages/markdown/src/ssr-import.test.ts`), so the only remaining
 * SSR concern is that the *runtime* render — which calls
 * `renderMarkdownWithMath` and touches the DOM via `{@html}` — must not run on
 * the server.
 *
 * markdown-preview.svelte satisfies this by:
 *   - requesting the cached rendering-pipeline import inside a `$effect`, never
 *     at module evaluation — `$effect` bodies never run during SSR, so the import
 *     is never evaluated on the server, and the heavy rendering graph stays out
 *     of the SSR path; and
 *   - rendering a raw-text fallback (`<p>{content}</p>`) in the `{:else}`
 *     branch, so the server emits the message text without throwing and the
 *     client swaps in formatted HTML after hydration.
 *
 * Unlike `@lostgradient/editor`'s `markdown-editor.svelte` — whose live-editor
 * branch pulls in ProseMirror runtime and so cannot be exercised by
 * `renderThenHydrate` (the recompiled SSR module resolves that import
 * against a missing "node"-conditional dist, producing `effect_orphan`) —
 * markdown-preview has no child components and no static markdown/editor import.
 * Its only heavy dependency is reached through the cached loader inside an
 * `$effect`, which never runs during SSR. We therefore verify the SSR contract by
 * actually rendering on the server via `renderThenHydrate` and asserting on the
 * produced markup, the same pattern `portal.test.ts` uses for its SSR-omission
 * contract.
 */

import { describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';

import { renderThenHydrate } from '../../../test/hydrate.ts';

type TestMarkdownSegment =
  | { kind: 'html'; html: string }
  | { kind: 'node'; node: unknown }
  | { kind: 'element'; tag: string; children: TestMarkdownSegment[] };

const markdownPreviewModule = (await import('./markdown-preview.svelte')) as unknown as {
  default: typeof import('./markdown-preview.svelte').default;
  segmentRenderedMarkdown: (html: string, ownerDocument: Document) => TestMarkdownSegment[];
};
const { default: MarkdownPreview, segmentRenderedMarkdown } = markdownPreviewModule;

const sourcePath = new URL('./markdown-preview.svelte', import.meta.url).pathname;

describe('Chat markdown-preview SSR contract', () => {
  test('preserves ancestors while extracting nested override placeholders', () => {
    const window = new Window();
    const segments = segmentRenderedMarkdown(
      '<blockquote><p>Before</p><cinder-markdown-node data-cinder-markdown-kind="table" data-cinder-markdown-index="4"><table><tbody><tr><td>Cell</td></tr></tbody></table></cinder-markdown-node></blockquote>',
      window.document as unknown as Document,
    );

    expect(segments).toHaveLength(1);
    expect(segments[0]?.kind).toBe('element');
    if (segments[0]?.kind !== 'element') throw new Error('Expected a preserved blockquote');
    expect(segments[0].tag).toBe('blockquote');
    expect(segments[0].children.some((child) => child.kind === 'node')).toBe(true);
    expect(JSON.stringify(segments)).not.toContain('<cinder-markdown-node');
  });

  test('server-renders the raw-text fallback for the message content', async () => {
    // The `$effect` that populates `renderedHtml` never runs on the server, so
    // `renderedHtml` stays '' and the `{:else}` branch emits the raw content as
    // a paragraph — without throwing and without importing the rendering graph.
    const result = await renderThenHydrate(MarkdownPreview, sourcePath, {
      content: 'hello world',
    });

    try {
      expect(result.ssrHtml).toContain(
        '<div class="cinder-markdown-content message-content-preview">',
      );
      expect(result.ssrHtml).toContain('<p>hello world</p>');
    } finally {
      result.cleanup();
    }
  });

  test('does not emit rendered {@html} markdown output on the server', async () => {
    // `**bold**` would become `<strong>bold</strong>` once the client pipeline
    // runs. On the server the `{#if renderedHtml}` branch is never taken, so the
    // markdown source is emitted verbatim inside the `<p>` fallback and the
    // rendered `<strong>` markup is absent.
    const result = await renderThenHydrate(MarkdownPreview, sourcePath, {
      content: '**bold**',
    });

    try {
      expect(result.ssrHtml).toContain('<p>**bold**</p>');
      expect(result.ssrHtml).not.toContain('<strong>');
    } finally {
      result.cleanup();
    }
  });

  test('escapes HTML-special characters in the server-rendered fallback', async () => {
    // The fallback is a plain `{content}` text interpolation, so Svelte escapes
    // the opening `<` to `&lt;`. This proves the server path emits *text*,
    // never an unescaped `{@html}` injection of the raw message body — the
    // `<img>` tag is neutralized and cannot execute its `onError` handler.
    const result = await renderThenHydrate(MarkdownPreview, sourcePath, {
      content: '<img src=x onError=alert(1)>',
    });

    try {
      expect(result.ssrHtml).toContain('&lt;img src=x onError=alert(1)>');
      expect(result.ssrHtml).not.toContain('<img src=x onError=alert(1)>');
    } finally {
      result.cleanup();
    }
  });

  test('hydrates the server markup without warnings', async () => {
    // A clean hydrate (no mismatch warnings) confirms the SSR output and the
    // client's first render agree: both produce the raw-text fallback, and the
    // dynamic-import effect only swaps in formatted HTML on a later frame.
    const result = await renderThenHydrate(MarkdownPreview, sourcePath, {
      content: 'hello world',
    });

    try {
      expect(result.warnings).toEqual([]);
    } finally {
      result.cleanup();
    }
  });
});
