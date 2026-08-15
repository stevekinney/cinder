/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { anchorPluginKey, createAnchorPlugin } from './anchor-decorations.js';
import type { Thread } from './comments/types.js';
import { createEditor } from './editor/editor.js';
import type { EditorState } from './editor/types.js';
import type { FakeClock } from './test/fake-clock.js';
import { installFakeClock } from './test/fake-clock.js';
import { setupHappyDom } from './test/happy-dom.js';

setupHappyDom();

/**
 * cinder#1304 — `.comment-anchor` decorations carried only `class` and
 * `data-thread-id`, both invisible to assistive tech: no `role`, no
 * `tabindex`, no `aria-*`. This boots a REAL editor with the REAL anchor
 * plugin (unlike anchor-decorations.test.ts, which drives the plugin's pure
 * state logic without ever rendering a decoration into the DOM) and reads
 * the actual rendered `<span>`, so the fix under test is the same
 * `computeDecorations` code path a consumer's browser executes.
 *
 * happy-dom can confirm the ATTRIBUTES are present — it cannot compute a real
 * accessibility tree, so it cannot confirm what a screen reader actually
 * announces from `role="mark"` + `aria-description`, or that Tab genuinely
 * cannot reach the span (WCAG-adjacent claims that depend on real ARIA
 * mapping and real focus traversal). That half is verified separately in
 * Chromium via Playwright (packages/testing) against the accessibility tree
 * and real keyboard input, per this package's harness-skeptic guidance: a
 * DOM assertion here is not evidence of what assistive tech hears.
 */

let editorState: EditorState | undefined;
let clock: FakeClock | undefined;

/**
 * `@milkdown/plugin-listener`'s `markdownUpdated` dispatch is internally
 * debounced 200ms (lodash-es), independent of and invisible to `editor.ts`'s
 * own `changeDebounceMs`. Any dispatched transaction — including the
 * `setMeta` below, not just a text edit — arms it. Without advancing a fake
 * clock past it before destroying the editor, that debounce fires later
 * against a torn-down context ("Context editorView not found"), and in a
 * shared bun test process that usually lands during a LATER file's own
 * async editor mount rather than here. See
 * editor/editor.tab-escape-keymap.test.ts's afterEach for the same fix with
 * the fuller explanation, including why the clock is restored BEFORE
 * `destroy()` runs rather than after (destroy's own teardown can schedule
 * real timers, which a still-installed fake clock would swallow).
 */
afterEach(async () => {
  clock?.advance(200);
  clock?.restore();
  clock = undefined;
  if (editorState) {
    editorState.markDestroyed();
    await editorState.editor.destroy();
    editorState = undefined;
  }
});

function makeThread(): Thread {
  return {
    id: 'thread-a11y',
    createdAt: new Date().toISOString(),
    anchor: {
      from: 1,
      to: 10,
      quote: 'Commented',
      prefix: '',
      suffix: ' text follows',
      status: 'anchored',
      originalQuote: 'Commented',
      lastKnownOffset: 0,
    },
    comments: [
      {
        id: 'comment-a11y',
        threadId: 'thread-a11y',
        authorId: 'reviewer',
        body: 'A note on this text.',
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

describe('comment-anchor decoration accessibility attrs (cinder#1304)', () => {
  test('the rendered span carries role="mark" and an aria-description, not just class/data-thread-id', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const anchorPlugin = createAnchorPlugin();

    editorState = await createEditor(container, {
      initialContent: 'Commented text follows in this paragraph.',
      plugins: [anchorPlugin],
    });
    clock = installFakeClock();
    const { view } = editorState;
    if (!view) throw new Error('view not ready');

    view.dispatch(
      view.state.tr.setMeta(anchorPluginKey, {
        type: 'sync',
        threads: [makeThread()],
        source: 'external',
      }),
    );

    const span = container.querySelector('[data-thread-id="thread-a11y"]');
    expect(span).not.toBeNull();
    expect(span?.getAttribute('role')).toBe('mark');
    expect(span?.getAttribute('aria-description')).toBeTruthy();
    // The highlighted text itself must still be readable content, not
    // replaced or hidden — role="mark" must not turn into an empty node.
    expect(span?.textContent).toBe('Commented');
    // Guard against solving this with tabindex instead, which the issue
    // itself flags as the fragile, likely-wrong fix for an inline
    // decoration inside a contenteditable surface.
    expect(span?.hasAttribute('tabindex')).toBe(false);
  });
});
