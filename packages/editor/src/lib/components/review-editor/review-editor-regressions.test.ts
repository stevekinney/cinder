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
import { proseMirrorPositionToTextOffset } from '../../editor/index.ts';
import { createDocFromMarkdown } from '../../editor/test-utilities.ts';
import { parseReviewEditorFrontMatter } from './review-editor-front-matter.ts';

const here = (file: string) => new URL(`./${file}`, import.meta.url).pathname;

const implementationSource = await Bun.file(here('review-editor-impl.svelte')).text();
const wrapperSource = await Bun.file(here('review-editor.svelte')).text();
const controlsSource = await Bun.file(here('review-editor-controls.svelte')).text();
const commentSidebarSource = await Bun.file(here('comment-sidebar.svelte')).text();
const liveRegionSource = await Bun.file(here('live-region.svelte')).text();
const anchorDecorationsSource = await Bun.file(
  new URL('../../anchor-decorations.ts', import.meta.url).pathname,
).text();
const anchorTypesSource = await Bun.file(
  new URL('../../shared/anchor-types.ts', import.meta.url).pathname,
).text();
const exampleSet = (await Bun.file(here('review-editor.examples.json')).json()) as {
  examples: { id: string; code: string }[];
};

describe('seeded threads no longer highlight the whole document', () => {
  test('closes the actions menu when all visible threads disappear', () => {
    expect(commentSidebarSource).toContain('{#key visibleThreads.length > 0}');
    expect(commentSidebarSource).toContain('{/key}');
    expect(commentSidebarSource).toContain('<Dropdown id="{id}-actions">');
  });
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

  test('a collapsed range paints nothing, so the 0/0 sentinel is invisible', () => {
    // `toRuntimeThreads` seeds restored threads with `from: 0, to: 0` and lets
    // re-anchoring place them. That is only safe because a collapsed range is
    // skipped when decorations are computed — otherwise every restored thread
    // would flash a highlight over the top of the document.
    const computeDecorationsBody = anchorDecorationsSource.slice(
      anchorDecorationsSource.indexOf('function computeDecorations'),
      anchorDecorationsSource.indexOf('Decoration.inline('),
    );
    expect(computeDecorationsBody).toMatch(/if \(from >= to\) continue;/);
  });

  test('an unverified anchor may not adopt the text at its own bad range', () => {
    // cinder#1275. An anchor seeded in the wrong coordinate space is flagged for
    // the deferred re-anchoring pass, but that pass is debounced 300ms — and
    // Milkdown's `syncHeadingIdPlugin` stamps `id` attributes onto headings
    // inside that window. That transaction's step map spans the whole heading,
    // so `didTransactionAffectAnchorRange` was true and the "follow the edit"
    // branch overwrote the anchor's `quote` with whatever text sat at the bad
    // range. `anchorMatchesDocument` then reported it healthy and the deferred
    // pass skipped it forever: `{from: 2, to: 14}` for "Release Plan" rendered
    // "elease Plan" permanently, while the identical mistake in a paragraph
    // (untouched by that transaction) repaired correctly.
    //
    // The gate is `anchorMatchesDocument(tr.before, anchor)` — did this anchor
    // describe its own text BEFORE this transaction. `tr.before` is the correct
    // document to pair with the pre-map `anchor.from`/`anchor.to`.
    expect(anchorDecorationsSource).toMatch(
      /didTransactionAffectAnchorRange\(tr, anchor\.from, anchor\.to\) &&\s*\n?\s*anchorMatchesDocument\(tr\.before, anchor\)/,
    );
  });

  test('a mis-seeded anchor is reported in dev rather than silently relocated', () => {
    // The same issue's other half: nothing told a consumer their coordinates
    // were wrong. Scoped to threads the plugin has not tracked before, which is
    // what keeps it off ordinary editing drift — the plugin maps its own copy
    // without writing back, so a consumer's `threads` legitimately goes stale,
    // but those threads are already tracked and never reach the warning.
    expect(anchorDecorationsSource).toContain('function warnOnMisSeededAnchor');
    expect(anchorDecorationsSource).toMatch(/if \(alreadyTracked \|\| !anchor\.quote/);
    expect(anchorDecorationsSource).toMatch(/case 'sync':[\s\S]*?warnOnMisSeededAnchor/);
    expect(anchorDecorationsSource).toMatch(/case 'add':[\s\S]*?warnOnMisSeededAnchor/);
  });

  test('the documented unplaced sentinel re-anchors without a warning', () => {
    // `toRuntimeThreads` intentionally restores every text anchor at 0/0 so
    // the plugin can place it by quote against the live document. That
    // persistence path is valid and must not be diagnosed as hand-computed
    // coordinates.
    const warningBody = anchorDecorationsSource.slice(
      anchorDecorationsSource.indexOf('function warnOnMisSeededAnchor'),
      anchorDecorationsSource.indexOf('/**\n * Handle meta-transactions'),
    );
    expect(warningBody).toMatch(/anchor\.from === 0 && anchor\.to === 0/);
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

describe('a vanished anchor orphans its thread rather than deleting it', () => {
  /**
   * This block previously asserted the opposite, and both versions were right
   * at the time.
   *
   * `comments/types.ts` used to justify having no "orphaned" status by saying
   * threads are deleted when their anchor text goes. The plugin detected the
   * condition and called `onAnchorDeleted`, but ReviewEditor never passed that
   * handler, so nothing happened — the thread sat in `threads` pointing at text
   * that no longer existed. cinder#1266 wired it, honouring the documented
   * contract.
   *
   * Wiring it turned a silent inconsistency into silent DATA LOSS. Deletion and
   * cut-and-paste are indistinguishable at the moment the text disappears, and
   * re-anchoring is debounced 300ms — quicker than a person cutting a paragraph
   * and pasting it back. Cut, pause, paste: the comment was gone, with no undo
   * (cinder#1284).
   *
   * So the contract changed instead: `AnchorStatus` gained `orphaned`, the
   * thread is kept and retried on every later pass, and removing it is the
   * consumer's decision.
   */
  test('the plugin no longer asks the component to delete a thread', () => {
    expect(implementationSource).not.toMatch(/onAnchorDeleted:/);
    expect(anchorDecorationsSource).not.toMatch(/options\.onAnchorDeleted\?\.\(/);
  });

  test('a not-found quote marks the anchor orphaned and keeps it tracked', () => {
    const deferred = anchorDecorationsSource.slice(
      anchorDecorationsSource.indexOf('function performDeferredReanchoring'),
    );
    expect(deferred).toMatch(/if \(!result\.found\)/);
    expect(deferred).toMatch(/status: 'orphaned'/);
    // Kept, not dropped: the anchor goes back into the map on the not-found path.
    expect(deferred).toMatch(/if \(!result\.found\)[\s\S]*?newAnchors\.set\(threadId, orphaned\)/);
  });

  test('an orphaned anchor renders no decoration', () => {
    expect(anchorDecorationsSource).toMatch(/status === 'orphaned'\) continue/);
  });

  test('the status reaches the consumer through the bindable threads', () => {
    expect(implementationSource).toMatch(/status: update\.status/);
    expect(implementationSource).toContain('function announceOrphanedThreads');
  });

  test('orphaned status is a real member of the union, not a comment', () => {
    expect(anchorTypesSource).toMatch(/AnchorStatus = 'anchored' \| 'orphaned'/);
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

describe('the shipped examples seed anchors in the documented coordinate space', () => {
  /**
   * The `with-comments` example seeded `from: 3, to: 21` — indices into the
   * front-matter-stripped Markdown string, not ProseMirror positions. Post-
   * #1266 the component verifies seeded positions and re-anchors by quote, so
   * the example still rendered correctly and the wrong numbers were discarded
   * silently. Consumers copy examples, so the mistake propagated into every app
   * that seeded persisted threads.
   *
   * This reads the generated examples artifact, which `components:check` keeps
   * in sync with the playground source, and re-derives the arithmetic against a
   * real ProseMirror document.
   */
  const readStringLiteral = (block: string, field: string): string => {
    const match = block.match(new RegExp(`\\b${field}: '([^']*)'`));
    expect(match).not.toBeNull();
    // Source escapes (\n) are JSON escapes too, and no literal here uses ".
    return JSON.parse(`"${match![1]}"`) as string;
  };

  const readNumber = (block: string, field: string): number => {
    const match = block.match(new RegExp(`\\b${field}: (\\d+)`));
    expect(match).not.toBeNull();
    return Number(match![1]);
  };

  for (const example of exampleSet.examples) {
    const anchorBlocks = [...example.code.matchAll(/anchor: \{([\s\S]*?)\n {6}\},/g)].map(
      (match) => match[1]!,
    );
    const textAnchors = anchorBlocks.filter((block) => !block.includes("type: 'document'"));
    if (textAnchors.length === 0) continue;

    test(`${example.id} anchors resolve to their quotes`, async () => {
      const valueMatch = example.code.match(/let value = \$state\(`([\s\S]*?)`\)/);
      expect(valueMatch).not.toBeNull();
      const { body, bodyOffset } = parseReviewEditorFrontMatter(valueMatch![1]!);
      const { doc, destroy } = await createDocFromMarkdown(body);

      try {
        for (const block of textAnchors) {
          const from = readNumber(block, 'from') - bodyOffset;
          const to = readNumber(block, 'to') - bodyOffset;
          const quote = readStringLiteral(block, 'quote');

          // from/to are ProseMirror positions, so the document text between
          // them is exactly the quote.
          expect(doc.textBetween(from, to, '\n')).toBe(quote);

          // lastKnownOffset is a textBetween() offset, a different space.
          expect(readNumber(block, 'lastKnownOffset') - bodyOffset).toBe(
            proseMirrorPositionToTextOffset(doc, from),
          );

          // prefix/suffix are text context too - never Markdown markup, and
          // blocks are joined by a single newline.
          const docSize = doc.content.size;
          expect(readStringLiteral(block, 'prefix')).toBe(
            doc.textBetween(Math.max(0, from - 50), from, '\n'),
          );
          expect(readStringLiteral(block, 'suffix')).toBe(
            doc.textBetween(to, Math.min(docSize, to + 50), '\n'),
          );
        }
      } finally {
        destroy();
      }
    });
  }
});

describe('comment sidebar clear-all focus', () => {
  test('falls back to the enabled add-comment control when clear-all disables actions', () => {
    expect(commentSidebarSource).toContain(
      'const documentCommentTriggerId = $derived(`${id}-add-comment`)',
    );
    expect(commentSidebarSource).toMatch(
      /if \(actionsTrigger && !actionsTrigger\.disabled\)[\s\S]*?actionsTrigger\.focus\(\);[\s\S]*?document\.getElementById\(documentCommentTriggerId\)\?\.focus\(\);/,
    );
    expect(commentSidebarSource).toContain('id={documentCommentTriggerId}');
  });
});
