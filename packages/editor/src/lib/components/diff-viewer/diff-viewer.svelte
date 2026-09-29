<script lang="ts" module>
  /**
   * @cinder
   * @category domain
   * @status domain-suite
   * @purpose Side-by-side or unified Markdown diff surface with hunk grouping, word-level inline changes, and size-based debounce gating.
   * @tag diff
   * @tag markdown
   * @tag domain-suite
   * @useWhen Comparing two Markdown documents and wanting the bundled toolbar, view-mode toggle, front-matter handling, and large-payload safeguards.
   * @useWhen Building a review workflow that needs hunked, line-anchored Markdown diffs out of the box as a heavyweight suite.
   * @avoidWhen Showing only a counts summary — use diff-statistics on its own for a lightweight presentation.
   * @avoidWhen Diffing non-Markdown source code where syntax-aware highlighting matters more than prose-aware rendering.
   * @related diff-statistics, code-block
   */
  export type {
    DiffToolbarContext,
    DiffViewerAnnotationCoordinateSpace,
    DiffViewerAnnotationRejection,
    DiffViewerAnnotationRejectionReason,
    DiffViewerAnnotationResult,
    DiffViewerAnnotationSelection,
    DiffViewerAnnotationSide,
    DiffViewerFocusResult,
    DiffViewerFrontMatterAnnotationContext,
    DiffViewerLineAnnotationContext,
    DiffViewerMode,
    DiffViewerProps,
    DiffViewerRawMapping,
    DiffViewerRef,
  } from './diff-viewer.types.ts';
</script>

<script lang="ts">
  /**
   * Diff viewer component for comparing two Markdown documents.
   *
   * Uses line-based diffing for reliable rendering:
   * - Lines are natural structural boundaries in Markdown
   * - Each line is rendered independently (no cross-line position tracking)
   * - Modified lines show word-level inline changes
   *
   * Size-based gating (DEP-47):
   * - <20KB: Real-time diff computation
   * - 20-100KB: Debounced (500ms) with warning badge
   * - >100KB: Manual trigger only, shows stale diff with "Outdated" badge
   */

  import { computeLineDiff, getDiffStats, groupIntoHunks } from '@lostgradient/markdown';
  import type { DiffHunk, LineDiff } from '@lostgradient/markdown';

  import { classNames } from '../../utilities/class-names.ts';
  import { Button, RotateCcw, Surface } from '@lostgradient/cinder';
  import {
    composeDisplayedDocument,
    formatComputedUnifiedDiff,
  } from '../../export/unified-diff-format.ts';
  import { generateUnifiedDiff } from '../../export/unified-diff-generation.ts';
  import { flushSync, onDestroy } from 'svelte';

  import {
    buildDiffViewerLineSelection,
    extendDiffViewerSelection,
    isSideCommentable,
    numberDiffViewerRows,
    type DiffViewerAnnotationContext,
    type DiffViewerAnnotationPoint,
  } from './diff-viewer.annotation.ts';
  import { createDiffController } from './diff-controller.svelte';
  import DiffFrontMatter from './diff-front-matter.svelte';
  import DiffLine from './diff-line.svelte';
  import type { DiffLineAnnotationTarget } from './diff-line.svelte';
  import DiffToolbar from './diff-toolbar.svelte';
  import type {
    DiffToolbarContext,
    DiffViewerAnnotationSelection,
    DiffViewerAnnotationSide,
    DiffViewerFocusResult,
    DiffViewerMode,
    DiffViewerProps,
    DiffViewerRef,
  } from './diff-viewer.types.ts';

  type LocalFrontMatterBlock = {
    hasFrontMatter: boolean;
    hasTerminatingNewline: boolean;
    raw: string | null;
    body: string;
    text: string;
  };

  function normalizeForDiff(markdown: string): string {
    if (!markdown.trim()) return '\n';

    return markdown
      .replace(/\r\n?/g, '\n')
      .replace(/^(\s*)[*+] /gm, '$1- ')
      .replace(/^([-*+] .*)$\n\n(?=[-*+] )/gm, '$1\n')
      .replace(/^(\d+\. .*)$\n\n(?=\d+\. )/gm, '$1\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\n+/, '')
      .replace(/\n+$/, '\n');
  }

  function getFrontMatterBlock(markdown: string): LocalFrontMatterBlock {
    const normalized = markdown.replace(/\r\n?/g, '\n');
    const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(normalized);

    if (!match) {
      return {
        hasFrontMatter: false,
        hasTerminatingNewline: false,
        raw: null,
        body: markdown,
        text: '',
      };
    }

    return {
      hasFrontMatter: true,
      hasTerminatingNewline: match[0].endsWith('\n'),
      raw: match[1] ?? '',
      body: normalized.slice(match[0].length),
      text: `---\n${match[1] ?? ''}\n---`,
    };
  }

  const instanceId = $props.id();

  let {
    original,
    current,
    normalizeInputs = true,
    onRevertAll,
    onRevertHunk,
    readonly = false,
    hunks: bindableHunks = $bindable<DiffHunk[]>([]),
    viewMode = $bindable<DiffViewerMode>('unified'),
    toolbarActions,
    toolbar,
    fileAnnotation,
    lineAnnotation,
    annotationSelection,
    onAnnotationSelectionChange,
    ref = $bindable<DiffViewerRef | undefined>(),
    class: className,
  }: DiffViewerProps = $props();

  // ─────────────────────────────────────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────────────────────────────────────

  // viewMode is now a $bindable prop (see props destructuring above)
  // User's explicit selection (null means "use default")
  let userSelectedIndex = $state<number | null>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // Annotation selection state (COR-514 / DR-4)
  // ─────────────────────────────────────────────────────────────────────────────

  const annotationEnabled = $derived(Boolean(onAnnotationSelectionChange));

  let annotationOrigin: DiffViewerAnnotationPoint | null = $state(null);
  let annotationPendingEnd: DiffViewerAnnotationPoint | null = $state(null);
  let annotationRejectionMessage: string | null = $state(null);
  // Compared by VALUE, not by reference -- see SourceDiffViewer's identical
  // `lastEmittedSelection` for why: a host storing the emitted selection in
  // `$state` gets back a new reactive proxy wrapping the same values.
  let lastEmittedSelection: DiffViewerAnnotationSelection | null = null;

  // ─────────────────────────────────────────────────────────────────────────────
  // Front Matter State (DEP-61)
  // ─────────────────────────────────────────────────────────────────────────────

  let frontMatterExpanded = $state(true);

  // ─────────────────────────────────────────────────────────────────────────────
  // Derived values
  // ─────────────────────────────────────────────────────────────────────────────

  // Parse front matter from both documents
  const originalParsed = $derived(getFrontMatterBlock(original));
  const currentParsed = $derived(getFrontMatterBlock(current));

  // Check if either document has front matter
  const hasFrontMatter = $derived(originalParsed.hasFrontMatter || currentParsed.hasFrontMatter);

  // Get front matter text for diffing (with delimiters for context)
  const originalFrontMatterText = $derived(originalParsed.text);
  const currentFrontMatterText = $derived(currentParsed.text);

  // Normalize body content only
  const normalizedOriginalBody = $derived(
    normalizeInputs ? normalizeForDiff(originalParsed.body) : originalParsed.body,
  );
  const normalizedCurrentBody = $derived(
    normalizeInputs ? normalizeForDiff(currentParsed.body) : currentParsed.body,
  );

  // Compute front matter diffs (always real-time since front matter is small)
  const frontMatterDiffs = $derived(
    hasFrontMatter ? computeLineDiff(originalFrontMatterText, currentFrontMatterText) : [],
  );
  const hasFrontMatterChanges = $derived(frontMatterDiffs.some((d) => d.type !== 'same'));

  // ─────────────────────────────────────────────────────────────────────────────
  // Diff Controller with size-based gating (DEP-47)
  // ─────────────────────────────────────────────────────────────────────────────

  const diffController = createDiffController();

  // Feed normalized content to the controller.
  // Combined into single effect to ensure both values are set atomically
  // before the controller's internal effect processes them.
  $effect(() => {
    diffController.setOriginal(normalizedOriginalBody);
    diffController.setCurrent(normalizedCurrentBody);
  });

  // Expose controller state
  const diffState = $derived(diffController.state);
  const lineDiffs = $derived(diffState.diffs);

  // ─────────────────────────────────────────────────────────────────────────────
  // Annotation row numbering (COR-514 / DR-4)
  // ─────────────────────────────────────────────────────────────────────────────

  // Front matter's own line count offsets the body's direct line numbers, per
  // side independently -- the two sides' front matter can differ in length.
  // CRLF is one line separator, matching the contract's counting rule.
  const frontMatterLineCounts = $derived({
    old: originalParsed.hasFrontMatter ? originalFrontMatterText.split(/\r\n|\r|\n/).length : 0,
    new: currentParsed.hasFrontMatter ? currentFrontMatterText.split(/\r\n|\r|\n/).length : 0,
  });
  const numberedRows = $derived(numberDiffViewerRows(lineDiffs, frontMatterLineCounts));
  const annotationContext = $derived<DiffViewerAnnotationContext>({
    lineDiffs,
    numbered: numberedRows,
    normalizeInputs,
  });

  // Filter to only navigable lines based on view mode (single-pass for performance)
  // In 'final' mode, removed lines are hidden; in 'original' mode, added lines are hidden
  const changedLineIndices = $derived.by(() => {
    const result: number[] = [];
    for (let i = 0; i < lineDiffs.length; i++) {
      const diff = lineDiffs[i];
      if (!diff) continue;
      if (diff.type === 'same') continue;
      if (viewMode === 'final' && diff.type === 'removed') continue;
      if (viewMode === 'original' && diff.type === 'added') continue;
      result.push(i);
    }
    return result;
  });

  // Declarative selection: use user's choice, or default to first change
  const selectedLineIndex = $derived(
    userSelectedIndex !== null && changedLineIndices.includes(userSelectedIndex)
      ? userSelectedIndex
      : changedLineIndices.length > 0
        ? (changedLineIndices[0] ?? null)
        : null,
  );

  const changeCount = $derived(changedLineIndices.length);
  const currentChangeIndex = $derived(
    selectedLineIndex !== null ? changedLineIndices.indexOf(selectedLineIndex) : -1,
  );

  // Combine stats from front matter and body diffs
  const bodyStats = $derived(getDiffStats(lineDiffs));
  const frontMatterStats = $derived(getDiffStats(frontMatterDiffs));
  const diffStats = $derived({
    added: bodyStats.added + frontMatterStats.added,
    removed: bodyStats.removed + frontMatterStats.removed,
    modified: bodyStats.modified + frontMatterStats.modified,
  });

  // Whether there are any changes at all (body or front matter)
  const hasAnyChanges = $derived(changeCount > 0 || hasFrontMatterChanges);

  // ─────────────────────────────────────────────────────────────────────────────
  // Hunks for revert functionality
  // ─────────────────────────────────────────────────────────────────────────────

  const computedHunks = $derived(groupIntoHunks(lineDiffs));
  const unifiedDiffHunks = $derived(groupIntoHunks([...frontMatterDiffs, ...lineDiffs]));
  const displayedOriginal = $derived(
    composeDisplayedDocument(
      originalFrontMatterText,
      normalizedOriginalBody,
      originalParsed.hasTerminatingNewline,
    ),
  );
  const displayedCurrent = $derived(
    composeDisplayedDocument(
      currentFrontMatterText,
      normalizedCurrentBody,
      currentParsed.hasTerminatingNewline,
    ),
  );

  // Sync computed hunks to bindable prop for reactive parent access
  $effect(() => {
    bindableHunks = computedHunks;
  });

  /**
   * Map of line index → hunk that contains changes starting at that line.
   * We show hunk header at the first changed line (not context lines).
   * Using regular Map since it's created fresh in $derived.by and never mutated.
   */
  const hunkStartMap = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- Map is created fresh, never mutated
    const map = new Map<number, DiffHunk>();

    // Find all changed line indices
    const changedIndices: number[] = [];
    for (let i = 0; i < lineDiffs.length; i++) {
      if (lineDiffs[i]?.type !== 'same') {
        changedIndices.push(i);
      }
    }

    // For each hunk, find its first change
    let changeIndex = 0;
    for (const hunk of computedHunks) {
      // Count changes in this hunk
      const hunkChangeCount = hunk.lines.filter((l) => l.type !== 'same').length;

      if (hunkChangeCount > 0 && changeIndex < changedIndices.length) {
        // The first change of this hunk
        const changedIndex = changedIndices[changeIndex];
        if (changedIndex !== undefined) {
          map.set(changedIndex, hunk);
        }
        changeIndex += hunkChangeCount;
      }
    }

    return map;
  });

  /**
   * Public method to get hunks for programmatic access.
   * Useful for imperative access patterns.
   * For reactive access, use `bind:hunks` instead.
   */
  export function getHunks() {
    return bindableHunks;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Toolbar context for snippets
  // ─────────────────────────────────────────────────────────────────────────────

  const toolbarContext: DiffToolbarContext = $derived({
    hunks: computedHunks,
    stats: diffStats,
    hasChanges: hasAnyChanges,
    viewMode,
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Annotation selection (COR-514 / DR-4)
  // ─────────────────────────────────────────────────────────────────────────────

  // Resync the controlled `annotationSelection` prop whenever the host sets a
  // genuinely new value (not our own echoed emission) -- mirrors
  // SourceDiffViewer's identical effect. See its comments for why structural
  // equality (not `===`) is required here.
  $effect(() => {
    if (
      annotationSelection === undefined ||
      selectionsEqual(annotationSelection, lastEmittedSelection)
    )
      return;

    if (annotationSelection === null) {
      annotationOrigin = null;
      annotationPendingEnd = null;
      annotationRejectionMessage = null;
      return;
    }

    annotationOrigin = { side: annotationSelection.side, line: annotationSelection.startLine };
    annotationPendingEnd = null;
    annotationRejectionMessage = null;
    lastEmittedSelection = annotationSelection;
  });

  function contextLinesEqual(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((value, index) => value === b[index]);
  }

  function selectionsEqual(
    a: DiffViewerAnnotationSelection | null | undefined,
    b: DiffViewerAnnotationSelection | null | undefined,
  ): boolean {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return (
      a.fileOccurrence === b.fileOccurrence &&
      a.hunkOccurrence === b.hunkOccurrence &&
      a.side === b.side &&
      a.startLine === b.startLine &&
      a.endLine === b.endLine &&
      a.coordinateSpace === b.coordinateSpace &&
      a.rawMapping.status === b.rawMapping.status &&
      a.selectedText === b.selectedText &&
      contextLinesEqual(a.contextBefore, b.contextBefore) &&
      contextLinesEqual(a.contextAfter, b.contextAfter)
    );
  }

  function controlId(point: DiffViewerAnnotationPoint): string {
    return `${instanceId}-annotation-${point.side}-${point.line}`;
  }

  function focusControl(point: DiffViewerAnnotationPoint): void {
    getElementByAnnotationId(controlId(point))?.focus();
  }

  /**
   * `Surface` (the root element) has no bindable DOM-element ref, but every
   * annotation control's id is generated from `$props.id()`, which is
   * globally unique per instance -- so `document.getElementById` is exactly
   * as instance-scoped as a `rootElement.querySelector` would be, without
   * requiring `Surface` to expose one.
   */
  function getElementByAnnotationId(id: string): HTMLElement | null {
    return typeof document === 'undefined' ? null : document.getElementById(id);
  }

  function emitSelection(selection: DiffViewerAnnotationSelection): void {
    lastEmittedSelection = selection;
    onAnnotationSelectionChange?.(selection);
  }

  function commitSelection(
    origin: DiffViewerAnnotationPoint,
    target: DiffViewerAnnotationPoint,
  ): void {
    const result = extendDiffViewerSelection(annotationContext, origin, target);
    if (!result.ok) {
      annotationRejectionMessage = result.message;
      return;
    }
    annotationRejectionMessage = null;
    emitSelection(result.selection);
  }

  function handleAnnotationClick(point: DiffViewerAnnotationPoint, event: MouseEvent): void {
    if (diffState.isStale) return;
    if (event.shiftKey && annotationOrigin) {
      commitSelection(annotationOrigin, point);
      annotationPendingEnd = null;
      return;
    }

    const selection = buildDiffViewerLineSelection(annotationContext, point);
    if (!selection) return;
    annotationOrigin = point;
    annotationPendingEnd = null;
    annotationRejectionMessage = null;
    emitSelection(selection);
  }

  function handleAnnotationKeydown(point: DiffViewerAnnotationPoint, event: KeyboardEvent): void {
    if (diffState.isStale) return;

    if (event.key === 'Enter') {
      event.preventDefault();
      if (annotationOrigin && annotationPendingEnd) {
        commitSelection(annotationOrigin, annotationPendingEnd);
        annotationPendingEnd = null;
        return;
      }
      annotationOrigin = point;
      annotationPendingEnd = point;
      annotationRejectionMessage = null;
      return;
    }

    if (event.key === 'Escape' && annotationPendingEnd && annotationOrigin) {
      event.preventDefault();
      annotationPendingEnd = null;
      annotationRejectionMessage = null;
      focusControl(annotationOrigin);
      return;
    }

    if (
      event.shiftKey &&
      annotationOrigin &&
      annotationPendingEnd &&
      (event.key === 'ArrowDown' || event.key === 'ArrowUp')
    ) {
      event.preventDefault();
      const candidate: DiffViewerAnnotationPoint = {
        ...annotationPendingEnd,
        line: annotationPendingEnd.line + (event.key === 'ArrowDown' ? 1 : -1),
      };
      const result = extendDiffViewerSelection(annotationContext, annotationOrigin, candidate);
      if (!result.ok) {
        annotationRejectionMessage = result.message;
        return;
      }
      annotationRejectionMessage = null;
      annotationPendingEnd = candidate;
      focusControl(candidate);
    }
  }

  function annotationControlLabel(side: DiffViewerAnnotationSide, line: number): string {
    return `Add comment on ${side === 'old' ? 'removed or unchanged' : 'added or unchanged'} line ${line}`;
  }

  const staleAnnotationExplanation =
    'The diff is outdated. Recompute it to add a new comment; existing comments remain available.';

  /**
   * Builds this row's annotation target(s) (0, 1, or 2 -- a `modified` row's
   * old/new sides are independent targets). Returns `undefined` when
   * annotation is disabled so `DiffLine` renders no controls at all,
   * preserving default behavior exactly.
   */
  function annotationTargetsForRow(
    diff: LineDiff,
    index: number,
  ): DiffLineAnnotationTarget[] | undefined {
    if (!annotationEnabled) return undefined;
    const numbered = numberedRows[index];
    if (!numbered) return undefined;

    const targets: DiffLineAnnotationTarget[] = [];
    for (const side of ['old', 'new'] as const) {
      if (!isSideCommentable(diff, side)) continue;
      const line = side === 'old' ? numbered.oldLine : numbered.newLine;
      if (line === null) continue;
      const point: DiffViewerAnnotationPoint = { side, line };
      targets.push({
        side,
        line,
        id: controlId(point),
        label: annotationControlLabel(side, line),
        disabled: diffState.isStale,
        disabledReason: diffState.isStale ? staleAnnotationExplanation : undefined,
        onactivate: (event) => handleAnnotationClick(point, event),
        onkeydown: (event) => handleAnnotationKeydown(point, event),
      });
    }
    return targets;
  }

  /**
   * Forces any pending reactive update (e.g. a `viewMode` switch made by
   * `focusAnchor` itself, in the same call) to apply before querying the DOM.
   * Mirrors SourceDiffViewer's identical helper.
   */
  function flushPendingUpdates(): void {
    try {
      flushSync();
    } catch {
      // Already inside a synchronous flush (e.g. called from an `$effect`).
    }
  }

  function focusAnchor(
    anchor: Pick<DiffViewerAnnotationSelection, 'side' | 'startLine'>,
  ): DiffViewerFocusResult {
    // A `final`-mode viewer hides the old side of removed/modified rows; an
    // `original`-mode viewer hides the new side of added/modified rows.
    // `unified` always shows both, so it's the universal safe target.
    if (
      (anchor.side === 'old' && viewMode === 'final') ||
      (anchor.side === 'new' && viewMode === 'original')
    ) {
      viewMode = 'unified';
    }
    flushPendingUpdates();
    const control = getElementByAnnotationId(
      controlId({ side: anchor.side, line: anchor.startLine }),
    );
    if (!control) return { status: 'unavailable' };
    control.focus();
    return { status: 'focused' };
  }

  const viewerRef: DiffViewerRef = { focusAnchor };

  $effect(() => {
    ref = viewerRef;
    return () => {
      ref = undefined;
    };
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────────────────────────────────────────

  function jumpToNext() {
    if (changedLineIndices.length === 0) return;
    const currentIdx = currentChangeIndex;
    const nextIdx = currentIdx < changedLineIndices.length - 1 ? currentIdx + 1 : 0;
    userSelectedIndex = changedLineIndices[nextIdx] ?? null;
  }

  function jumpToPrevious() {
    if (changedLineIndices.length === 0) return;
    const currentIdx = currentChangeIndex;
    const prevIdx = currentIdx > 0 ? currentIdx - 1 : changedLineIndices.length - 1;
    userSelectedIndex = changedLineIndices[prevIdx] ?? null;
  }

  function selectLine(index: number) {
    userSelectedIndex = index;
  }

  function handleRevertHunk(hunk: DiffHunk) {
    onRevertHunk?.(hunk.index, hunk);
  }

  let copyStatus = $state<'idle' | 'copied' | 'failed'>('idle');
  let copyStatusResetTimer: number | undefined;
  // Decision (CIN-134): copy is deliberately always a full-document unified
  // diff of `displayedOriginal` vs `displayedCurrent`, independent of the
  // toolbar's current `viewMode`. Switching to "Final" or "Original" only
  // changes which lines the viewer renders — it does not scope what gets
  // copied. Do not add a `viewMode` branch here without re-litigating this
  // decision with the team; the source issue's own lean was "unified is
  // probably right."
  async function copyUnifiedDiff(): Promise<void> {
    if (diffState.tier === 'manual' && (diffState.isStale || diffState.isComputing)) {
      copyStatus = 'failed';
      return;
    }
    const diff =
      diffState.tier === 'manual'
        ? formatComputedUnifiedDiff(unifiedDiffHunks, {
            original: displayedOriginal,
            current: displayedCurrent,
          })
        : generateUnifiedDiff(
            {
              schemaVersion: 1,
              content: displayedCurrent,
              original: displayedOriginal,
              threads: [],
              updatedAt: '',
            },
            { normalizeInputs: false },
          ).diff;
    if (!diff || typeof navigator === 'undefined' || !navigator.clipboard) {
      copyStatus = 'failed';
      return;
    }
    try {
      await navigator.clipboard.writeText(diff);
    } catch {
      copyStatus = 'failed';
      return;
    }
    copyStatus = 'copied';
    if (copyStatusResetTimer !== undefined) window.clearTimeout(copyStatusResetTimer);
    copyStatusResetTimer = window.setTimeout(() => {
      copyStatus = 'idle';
      copyStatusResetTimer = undefined;
    }, 1200);
  }

  onDestroy(() => {
    if (copyStatusResetTimer !== undefined) window.clearTimeout(copyStatusResetTimer);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Keyboard shortcuts
  // ─────────────────────────────────────────────────────────────────────────────

  const VIEW_MODES: DiffViewerMode[] = ['unified', 'final', 'original'];

  // Instance-owned, not window-owned (cinder#1310). This used to be a bare
  // `<svelte:window onkeydown>` with only an input/textarea/contenteditable
  // guard, so with more than one `DiffViewer` on a page every instance's
  // listener fired on the same keystroke regardless of which one (if any)
  // had focus. Binding the handler on this instance's own root element
  // instead relies on ordinary DOM event bubbling: a `keydown` only reaches
  // an element listener if the event's target — which for a global key
  // shortcut is always the currently focused element, or `<body>` when
  // nothing in particular is focused — is that element or one of its
  // descendants. Because focus is exclusive to a single element in the
  // whole document, at most one `DiffViewer` instance can ever have the
  // focused element inside its own subtree at a time, so at most one
  // instance's handler can ever fire for a given keystroke. This is a
  // deliberate behavior change, not just a bug fix: a keystroke with focus
  // on `<body>` (or anywhere outside this instance's own DOM) no longer
  // triggers navigation, even with a single `DiffViewer` on the page —
  // previously it did, because the listener was global. A user who wants
  // to use `]` / `[` / `Ctrl+Shift+D` now needs focus somewhere inside the
  // viewer first (e.g. a toolbar button), which is what makes the shortcuts
  // belong to the instance that has them rather than to the page.
  function handleKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (target.matches('input, textarea, [contenteditable]')) return;

    if (event.key === ']') {
      event.preventDefault();
      jumpToNext();
    } else if (event.key === '[') {
      event.preventDefault();
      jumpToPrevious();
    } else if (event.ctrlKey && event.shiftKey && event.key === 'D') {
      event.preventDefault();
      const currentIndex = VIEW_MODES.indexOf(viewMode);
      viewMode = VIEW_MODES[(currentIndex + 1) % VIEW_MODES.length] ?? 'unified';
    }
  }
</script>

<!-- Expose data-ready for E2E test synchronization (DEP-138) -->
<Surface
  class={classNames('diff-viewer', className)}
  data-ready={!diffState.isComputing && !diffState.isStale ? true : undefined}
  onkeydown={handleKeydown}
>
  <!-- Toolbar: Full override or default -->
  {#if toolbar}
    {@render toolbar(toolbarContext)}
  {:else}
    <DiffToolbar
      id={`${instanceId}-view-mode`}
      bind:viewMode
      stats={diffStats}
      {changeCount}
      {currentChangeIndex}
      hasChanges={hasAnyChanges}
      {readonly}
      {diffState}
      onjumpnext={jumpToNext}
      onjumpprevious={jumpToPrevious}
      {onRevertAll}
      ontriggercompute={() => diffController.triggerCompute()}
      oncopydiff={copyUnifiedDiff}
    >
      {#snippet actions()}
        {#if toolbarActions}
          {@render toolbarActions(toolbarContext)}
        {/if}
      {/snippet}
    </DiffToolbar>
  {/if}
  {#if copyStatus === 'copied'}
    <div class="cinder-sr-only" role="status">Unified diff copied.</div>
  {:else if copyStatus === 'failed'}
    <div class="diff-copy-error" role="status">Unable to copy unified diff.</div>
  {/if}

  <!-- Annotation status (COR-514 / DR-4): rejection explanations and the
       stale-diff creation-disabled explanation. -->
  {#if annotationEnabled}
    <div class="diff-annotation-status" role="status">
      {annotationRejectionMessage ?? (diffState.isStale ? staleAnnotationExplanation : '')}
    </div>
  {/if}

  <!-- Size warning banner (DEP-47) -->
  {#if diffState.warning}
    <div class="diff-warning" role="status">
      {diffState.warning}
      {#if diffState.lastComputeTime !== null}
        <span class="compute-time">(Last: {diffState.lastComputeTime.toFixed(0)}ms)</span>
      {/if}
    </div>
  {/if}

  <!-- Content -->
  <div class="diff-content">
    <!-- Front Matter Section (DEP-61) -->
    {#if hasFrontMatter}
      <DiffFrontMatter
        id={`${instanceId}-front-matter`}
        diffs={frontMatterDiffs}
        {viewMode}
        bind:expanded={frontMatterExpanded}
        badgeLabel={hasFrontMatterChanges ? 'Changed' : null}
        badgeVariant="warning"
        {fileAnnotation}
      />
    {/if}

    <!-- Body Content Section -->
    {#each lineDiffs as lineDiff, idx (idx)}
      {@const isSelected = selectedLineIndex === idx}
      {@const hunkAtLine = hunkStartMap.get(idx)}
      {@const rowAnnotationTargets = annotationTargetsForRow(lineDiff, idx)}

      <!-- Hunk header with revert button (shown at first change of each hunk) -->
      {#if hunkAtLine && !readonly && onRevertHunk}
        <div class="hunk-header">
          <span class="hunk-range">
            @@ -{hunkAtLine.originalStart},{hunkAtLine.originalCount} +{hunkAtLine.currentStart},{hunkAtLine.currentCount}
            @@
          </span>
          <Button
            variant="ghost"
            size="xs"
            class="hunk-revert-button"
            onclick={() => handleRevertHunk(hunkAtLine)}
            aria-label="Revert this change"
          >
            <RotateCcw class="cinder-icon-xs" />
            Revert
          </Button>
        </div>
      {/if}

      <DiffLine
        diff={lineDiff}
        {viewMode}
        selected={isSelected}
        onselect={() => selectLine(idx)}
        annotationTargets={rowAnnotationTargets}
        {lineAnnotation}
      />
    {/each}
  </div>
</Surface>

<style>
  :global(.diff-viewer) {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .diff-content {
    flex: 1;
    overflow: auto;
    padding: 0;
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-sm);
    line-height: 1.5;
  }

  /* ─────────────────────────────────────────────────────────────────────────────
   * Size Warning Banner (DEP-47)
   * ───────────────────────────────────────────────────────────────────────────── */

  .diff-warning {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2);
    padding: var(--cinder-space-2) var(--cinder-space-3);
    font-size: var(--cinder-text-xs);
    color: var(--cinder-status-warning-text);
    background: var(--cinder-status-warning-background);
    border-bottom: 1px solid var(--cinder-status-warning-border);
  }

  .compute-time {
    color: var(--cinder-text-muted);
    font-family: var(--cinder-font-mono);
  }

  /* ─────────────────────────────────────────────────────────────────────────────
   * Annotation status (COR-514 / DR-4)
   * ───────────────────────────────────────────────────────────────────────────── */

  .diff-annotation-status:not(:empty) {
    padding: var(--cinder-space-1) var(--cinder-space-3);
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-muted);
  }

  /* ─────────────────────────────────────────────────────────────────────────────
   * Hunk Headers with Revert Buttons
   * ───────────────────────────────────────────────────────────────────────────── */

  .hunk-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--cinder-space-2);
    padding: var(--cinder-space-1) var(--cinder-space-3);
    background: var(--cinder-surface-inset);
    border-bottom: 1px solid var(--cinder-border);
    margin-top: var(--cinder-space-2);
  }

  .hunk-range {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-muted);
  }

  :global(.hunk-revert-button) {
    opacity: 0;
    transition: opacity var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  .hunk-header:hover :global(.hunk-revert-button),
  .hunk-header:focus-within :global(.hunk-revert-button) {
    opacity: 1;
  }

  /* Always show on touch devices (no hover capability) */
  @media (hover: none) {
    :global(.hunk-revert-button) {
      opacity: 1;
    }
  }
</style>
