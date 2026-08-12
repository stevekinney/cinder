/**
 * Regressions found by driving ReviewEditor as a real consumer would — seeding
 * `threads` from persisted state and rendering the component in an app.
 *
 * Where a check reads source rather than behavior it is because the condition
 * lives in wiring this package cannot mount in the Bun harness (there is no
 * DOM, and the live editor only exists behind MarkdownEditor's `{#if browser}`
 * guard). Those checks pin the wiring that was missing; they do not claim to
 * prove the runtime behavior. `anchorMatchesDocument`'s contract is exercised
 * directly against real ProseMirror documents below.
 *
 * @module
 */
import { describe, expect, test } from 'bun:test';

const here = (file: string) => new URL(`./${file}`, import.meta.url).pathname;

const implementationSource = await Bun.file(here('review-editor-impl.svelte')).text();
const wrapperSource = await Bun.file(here('review-editor.svelte')).text();
const controlsSource = await Bun.file(here('review-editor-controls.svelte')).text();
const liveRegionSource = await Bun.file(here('live-region.svelte')).text();
const anchorDecorationsSource = await Bun.file(
  new URL('../../anchor-decorations.ts', import.meta.url).pathname,
).text();

describe('seeded threads no longer highlight the whole document', () => {
  /**
   * The bug: Milkdown sets the initial document with a single step spanning the
   * entire old doc. Anchors present at that moment were mapped through it —
   * `map(from, -1)` collapses to 0 and `map(to, 1)` expands to the doc end — so
   * every seeded thread decorated the full document. Worse, the mapping's
   * "follow the edit" branch then rewrote `quote` to the whole document text
   * and did NOT set `needsReanchor`, so re-anchoring never repaired it and the
   * only data that could have recovered the anchor was destroyed.
   *
   * Observed as: one thread anchored to a 12-character heading rendering six
   * `.comment-anchor` spans, one per block, across the entire document.
   */
  test('a wholesale document replacement defers to re-anchoring instead of mapping positions', () => {
    expect(anchorDecorationsSource).toContain('function isFullDocumentReplacement');
    // The guard must run BEFORE the per-anchor mapping loop, and must return
    // the anchors untouched so their quote survives for re-anchoring.
    const guardIndex = anchorDecorationsSource.indexOf('isFullDocumentReplacement(tr,');
    const mappingIndex = anchorDecorationsSource.indexOf('tr.mapping.map(anchor.from');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(mappingIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(mappingIndex);
  });

  test('syncing anchors verifies them against the document rather than trusting from/to', () => {
    // Consumer-supplied `from`/`to` are ProseMirror positions, a fact no prop
    // documentation states — so they are frequently raw-markdown or textBetween
    // offsets instead. Verify and re-anchor rather than decorating whatever
    // happens to sit at the given range.
    expect(anchorDecorationsSource).toContain('function anchorMatchesDocument');
    expect(anchorDecorationsSource).toMatch(/case 'sync':[\s\S]*?anchorMatchesDocument/);
    expect(anchorDecorationsSource).toMatch(/case 'add':[\s\S]*?anchorMatchesDocument/);
  });

  test('deferred re-anchoring reads the stored range safely', () => {
    // After a wholesale replacement the stored positions can point past the end
    // of the new document, and `textBetween` throws a RangeError on
    // out-of-range input. The bounds check lives in anchorMatchesDocument.
    expect(anchorDecorationsSource).toMatch(
      /anchor\.from < 0 \|\| anchor\.to > docSize \|\| anchor\.from >= anchor\.to/,
    );
    expect(anchorDecorationsSource).toMatch(
      /if \(anchorMatchesDocument\(doc, anchor\)\) \{[\s\S]*?newAnchors\.set\(threadId, anchor\)/,
    );
  });
});

describe('documented thread auto-delete is actually wired', () => {
  /**
   * `comments/types.ts` states that threads have no "orphaned" status because
   * "When anchor text is deleted, threads are automatically removed." The
   * plugin detects the condition and calls `onAnchorDeleted` — but ReviewEditor
   * constructed the plugin without that handler, so the removal never happened.
   * The thread stayed in the bindable `threads` array pointing at text that no
   * longer existed, and `onthreaddelete` never fired.
   */
  test('the anchor plugin receives an onAnchorDeleted handler', () => {
    expect(implementationSource).toMatch(
      /createAnchorPlugin\(\{[\s\S]*?onAnchorDeleted:\s*handleAnchorDeleted[\s\S]*?\}\)/,
    );
  });

  test('the handler drops the thread and notifies the consumer', () => {
    const handler = implementationSource.slice(
      implementationSource.indexOf('function handleAnchorDeleted'),
    );
    expect(handler).toContain('threads = threads.filter');
    expect(handler).toContain('onthreaddelete?.({ threadId })');
  });
});

describe('the imperative surface reaches the published entry point', () => {
  /**
   * `review-editor-impl.svelte` exports ~22 instance methods, but the public
   * wrapper rendered the implementation without `bind:this` and re-exported
   * nothing — so `bind:this` on <ReviewEditor> yielded a component with no
   * methods, and the entire persistence round-trip (getState/setState) was
   * unreachable from '@lostgradient/editor/review-editor'.
   */
  test('the wrapper binds the implementation instance', () => {
    expect(wrapperSource).toMatch(/bind:this=\{implementation\}/);
  });

  test.each([
    'getState',
    'setState',
    'getFormData',
    'getMarkdown',
    'setMarkdown',
    'scrollToThread',
    'createThread',
    'createDocumentThread',
    'createBlockThread',
    'deleteThread',
    'clearAllThreads',
    'createComment',
    'updateComment',
    'deleteComment',
    'exportUnifiedDiff',
    'exportMarkdownSummary',
    'reset',
    'focus',
  ])('the wrapper forwards %s', (method) => {
    expect(wrapperSource).toMatch(new RegExp(`export function ${method}\\b`));
    expect(implementationSource).toMatch(new RegExp(`export function ${method}\\b`));
  });
});

describe('screen-reader-only regions are actually hidden', () => {
  /**
   * LiveRegion hid itself with `class="sr-only"`. Cinder's base stylesheet
   * ships `.cinder-sr-only`; a bare `.sr-only` is defined nowhere, and the
   * component has no <style> block of its own — so every announcement rendered
   * as visible page text.
   */
  test('LiveRegion uses the utility Cinder actually ships', () => {
    expect(liveRegionSource).toContain('cinder-sr-only');
    expect(liveRegionSource).not.toMatch(/classNames\(\s*'sr-only'/);
  });
});

describe('the comments toggle points at the sidebar that exists', () => {
  /**
   * The toggle derived the sidebar's id from its OWN id. The controls bar is
   * instantiated as `{id}-controls`, so the toggle advertised
   * `{id}-controls-sidebar` while the sidebar is `{id}-sidebar` — an
   * `aria-controls` target that never resolves in any state.
   */
  test('the sidebar id is passed in rather than derived from the toolbar id', () => {
    // Required, with no `id`-derived fallback: a default would silently
    // reintroduce the dangling `{id}-controls-sidebar` target the moment a
    // caller forgot the prop.
    expect(controlsSource).toMatch(/sidebarId: string;/);
    expect(controlsSource).toMatch(/aria-controls=\{sidebarId\}/);
    expect(controlsSource).not.toMatch(/sidebarId \?\?/);
    expect(implementationSource).toMatch(/sidebarId="\{id\}-sidebar"/);
  });
});

describe('the editor view renders one control row, not two', () => {
  /**
   * The diff view passed DiffViewer an empty toolbar snippet ("controls are in
   * the unified bar above") and the summary view passed `showToolbar={false}`,
   * but the editor view passed neither — so it stacked MarkdownEditor's own
   * formatting toolbar under the unified bar. Two full-height bars cost ~90px
   * of chrome before any document content.
   */
  test('the inner editor does not render its own toolbar', () => {
    const editorView = implementationSource.slice(
      implementationSource.indexOf('<MarkdownEditor'),
      implementationSource.indexOf('{:else if activeView === '),
    );
    expect(editorView).toContain('showToolbar={false}');
    expect(editorView).toContain('ontoolbarcontextchange');
  });

  test('the formatting controls are hosted inside the unified bar', () => {
    expect(implementationSource).toMatch(/\{#snippet formattingSnippet\(\)\}/);
    expect(implementationSource).toContain('<EditorToolbar');
    expect(implementationSource).toMatch(/formatting=\{activeView === 'editor' && !isReadonly/);
    expect(controlsSource).toMatch(/\{@render formatting\(\)\}/);
  });

  test('the unified bar is a group, so its tablist and toolbar children are valid', () => {
    // `toolbar` may not contain `tablist`, and may not contain another
    // `toolbar`. This bar holds both, so it is a labelled group.
    expect(controlsSource).toMatch(/role="group"/);
    expect(controlsSource).not.toMatch(/role="toolbar"/);
  });
});
