<script lang="ts" module>
  import type { EditorSelection } from '../../editor/index.ts';
  import type {
    Thread,
    PersistedThread,
    ThreadCreateEvent,
    ReviewState,
  } from '../../comments/index.ts';
  import type { ReviewEditorProps, ReviewFormData } from './review-editor.types.ts';

  export type { ReviewMode, ReviewEditorProps, ReviewFormData } from './review-editor.types.ts';

  /** Type alias for thread ID to improve readability in state declarations */
  type ThreadId = string;
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import { classNames } from '../../utilities/class-names.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import { truncate } from '../../utilities/truncate.ts';
  import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';
  import { createFocusRegionNavigator, type FocusRegion } from './focus-navigation.ts';
  import { createChangeTracker } from '../../utilities/change-tracker.svelte.ts';
  import MarkdownEditor from '../markdown-editor/markdown-editor.svelte';
  import { computeReviewEditorDiffStats } from './review-editor-diff-stats.ts';
  import { selectAnchorRange, resolveAnchorSelectionRange } from '../../anchor-decorations.ts';
  import { nextCommentThread, orderedTextThreads } from './comment-navigation.ts';
  import {
    generateId,
    extractMentions,
    createDocumentAnchor,
    getVisibleComments,
    toPersistedThreads,
  } from '../../comments/index.ts';
  import type { AnchorUpdate } from '../../comments/index.ts';
  import { createAnchorManager } from './review-editor-anchors.svelte.ts';
  import { buildAnchorFromSelection } from '../../anchoring.ts';
  import ThreadPopover from './thread-popover.svelte';
  import LiveRegion from './live-region.svelte';
  import ExportActions from './export-actions.svelte';
  import CommentSidebar from './comment-sidebar.svelte';
  import FrontMatterFields from './front-matter-fields.svelte';
  import ReviewEditorControls from './review-editor-controls.svelte';
  import { EditorToolbar } from '../markdown-editor/editor-toolbar/index.ts';
  import type { ToolbarContext } from '../markdown-editor/markdown-editor.types.ts';
  import {
    bodyAnchorToDocumentAnchor,
    combineFrontMatterAndBody,
    documentPositionToBodyPosition,
    parseReviewEditorFrontMatter,
    replaceFrontMatterData,
    remapDocumentAnchorBodyOffset,
    reviewStateToMarkdown,
  } from './review-editor-front-matter.ts';
  import type {
    ReviewEditorDiffViewMode as DiffViewMode,
    ReviewEditorViewType as ViewType,
  } from './review-editor.types.ts';
  import {
    getSelectionAnchorPosition,
    type SelectionAnchorPosition,
  } from './review-editor-selection-geometry.ts';
  import DiffViewer from '../diff-viewer/diff-viewer.svelte';
  import type {
    DiffViewerAnnotationSelection,
    DiffViewerRef,
  } from '../diff-viewer/diff-viewer.types.ts';
  import { Button, Callout, SelectionPopover } from '@lostgradient/cinder';
  import { createReviewEditorExportActions } from './review-editor-exports.ts';
  import {
    exportDiffReviewJson,
    exportDiffReviewMarkdown,
    type DiffReviewExportOptions,
    type MarkdownSummaryOptions,
    type MarkdownSummaryResult,
    type UnifiedDiffOptions,
    type UnifiedDiffResult,
  } from '../../export/index.ts';
  import type {
    DiffReviewAction,
    DiffReviewAnchor,
    DiffReviewComment,
    DiffReviewDraft,
    DiffReviewError,
    DiffReviewResult,
    DiffReviewState,
  } from '../../diff-review-state/index.ts';
  import { restoreDiffReviewState } from '../../diff-review-state/index.ts';
  import { dispatchDiffReviewAction } from '../../utilities/diff-review-dispatch.ts';
  import { formatDiffReviewCommentLocation } from '../diff-review-comments/diff-review-comment-location.ts';
  import DiffReviewDraftsInventory from '../diff-review/diff-review-drafts-inventory.svelte';
  import {
    buildReviewEditorDiffReviewTarget,
    diffReviewStatesEqual,
    projectReviewEditorDocumentThreads,
  } from './review-editor-diff-review.ts';

  // Shared reduced-motion preference (OVERLAY-POLICY: use the shared hook, not inline matchMedia).
  const reducedMotion = useReducedMotion();
  const frontMatterParseWarning = 'Front matter could not be parsed; showing as plain text.';

  let {
    id,
    original = $bindable(''),
    value = $bindable(''),
    threads = $bindable<Thread[]>([]),
    mode = 'edit',
    currentUserId,
    placeholder = 'Start writing...',
    name,
    class: className,
    onValueChange,
    onThreadCreate,
    onThreadDelete,
    onCommentCreate,
    onCommentUpdate,
    onCommentDelete,
    snapshotMode = false,
    diffReviewState,
    onDiffReviewStateChange,
  }: ReviewEditorProps = $props();

  // Blur any focused element inside this component on mount when snapshotMode
  // is active. This prevents the initial screenshot from capturing a focused
  // ring or blinking caret. We track the container element via bind:this.
  let containerElement = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (!snapshotMode) return;
    if (!containerElement) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && containerElement.contains(active)) {
      active.blur();
    }
  });

  // Formatting-toolbar context, published by the inner MarkdownEditor so this
  // component can host the formatting controls inside its own unified bar
  // instead of letting the editor stack a second toolbar underneath it.
  let editorToolbarContext = $state<ToolbarContext | null>(null);

  // Reference to the underlying MarkdownEditor. Using the imported component
  // as a type is the Svelte ambient pattern — `*.svelte` declares the import
  // as a constructable type with the component's `export function` methods.
  let editorRef: MarkdownEditor | undefined = $state();

  // Reference to LiveRegion for screen reader announcements (DEP-47)
  let liveRegionRef: LiveRegion | undefined = $state();
  let malformedFrontMatterDismissed = $state(false);
  let lastMalformedFrontMatterId = $state('');
  let lastMalformedFrontMatterAnnouncementKey = $state('');

  // Track when editor view is ready (for effects that need to wait for async editor creation)
  let editorViewReady = $state(false);

  // `editorViewReady` is a latch set true by `handleSelectionChange`/the
  // `MarkdownEditor` `onReady` callback below, but nothing symmetrically
  // cleared it when the editor view unmounted (cinder#1301): switching to the
  // Diff or Summary tab destroys the `MarkdownEditor` instance behind the
  // `{#if activeView === 'editor'}` branch, `editorRef` unbinds back to
  // `undefined` (Svelte's own `bind:this` contract on block teardown), but the
  // latch stayed `true` — so `data-ready` kept reporting an editor that no
  // longer existed. Deriving the reset from `editorRef` itself, rather than
  // from `activeView`, covers every teardown path (view switch, and any other
  // reason the inner editor unmounts) without duplicating that branching logic
  // here.
  $effect(() => {
    if (!editorRef) {
      editorViewReady = false;
    }
  });

  // Track current selection for thread creation
  let currentSelection = $state<EditorSelection | null>(null);

  // =========================================================================
  // Thread Popover State
  // =========================================================================

  // Thread popover state
  let popoverThreadId = $state<ThreadId | null>(null);
  let popoverPosition = $state<{ x: number; y: number } | null>(null);

  // Timer handle for panel selection scroll-then-position delay.
  // Stored at component level so we can cancel it when switching threads.
  let selectTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Cleanup: cancel pending panel selection timeout on component unmount.
  // This prevents the callback from executing on a destroyed component.
  $effect(() => {
    return () => {
      if (selectTimeoutId !== null) {
        clearTimeout(selectTimeoutId);
        selectTimeoutId = null;
      }
    };
  });

  // Internal active thread tracking (not exposed as bindable prop)
  let activeThreadId = $state<string | null>(null);

  // Selecting a successor after deletion must update the sidebar's active row
  // without scheduling a popover, and that intent has to survive controlled
  // thread-array refreshes that retrigger the deep-linking effect below. This is
  // intentionally non-reactive: activeThreadId/threads changes already rerun the
  // effect, and explicit open/navigation handlers clear this marker before they
  // schedule a popover.
  let threadSelectedWithoutPopoverId: ThreadId | null = null;

  // Comment sidebar toggle state
  let sidebarOpen = $state(false);

  const currentDocument = $derived(parseReviewEditorFrontMatter(value));
  const editorValue = $derived(currentDocument.body);
  const hasMalformedFrontMatter = $derived(
    currentDocument.fencePresent && !currentDocument.hasFrontMatter,
  );
  const viewPanelIds = $derived({
    editor: `${id}-editor-panel`,
    diff: `${id}-diff-panel`,
    summary: `${id}-summary-panel`,
  });
  const sidebarRemoveControlRefs = $derived(
    threads.map(
      (thread) => () => document.getElementById(`${id}-sidebar-thread-remove-${thread.id}`),
    ),
  );

  // =========================================================================
  // View Switching State (DEP-47)
  // =========================================================================

  /** Active view: editor for editing, diff for comparing, summary for review */
  let activeView = $state<ViewType>('editor');

  /** Diff view mode: unified shows all changes, final shows current state, original shows baseline */
  let diffViewMode = $state<DiffViewMode>('unified');

  // =========================================================================
  // Diff Statistics (DEP-47)
  // =========================================================================

  /**
   * Compute diff statistics from original vs current content.
   * Uses the same front-matter-aware normalization as generateUnifiedDiff and
   * the diff panel (cinder#1307) — see computeReviewEditorDiffStats.
   */
  const diffStats = $derived.by(() => computeReviewEditorDiffStats(original, value));

  /** Whether there are any content changes */
  const hasContentChanges = $derived(
    diffStats.added > 0 || diffStats.removed > 0 || diffStats.modified > 0,
  );

  /** Total comment count (excluding soft-deleted comments) */
  const commentCount = $derived(
    threads.reduce((count, thread) => {
      return count + thread.comments.filter((c) => !c.deletedAt).length;
    }, 0),
  );

  /**
   * Summary content for the Summary view (without the "# Review Summary" heading).
   * The heading is useful for clipboard exports but redundant in the UI preview
   * since the view tab already indicates this is a summary.
   */
  const reviewEditorExports = createReviewEditorExportActions({
    getState: () => getState(),
    getValue: () => value,
    getOriginal: () => original,
    getThreads: () => threads,
    getName: () => name,
  });
  const summaryContent = $derived(reviewEditorExports.getSummaryContent());
  const formData = $derived(reviewEditorExports.getFormData());

  // =========================================================================
  // Diff-review integration (COR-512 / DR-7)
  //
  // Opt-in and controlled: absent `diffReviewState` means every branch below
  // is inert and the diff tab renders exactly as it did before this feature
  // existed (regression coverage: `review-editor-diff-comments.test.ts`).
  // Enabling reconciles the host's supplied state against ReviewEditor's own
  // bound `original`/`value`, expressed as the one `markdown` target a
  // single-target host has, through `restoreDiffReviewState` -- the same
  // atomic validate-then-reconcile path a remount already uses, so an
  // invalid supplied state and a live content change share one code path
  // rather than two independently-maintained ones.
  // =========================================================================

  /** The last diff-review state that passed validation. Survives an invalid supplied update
   * (contract: "keeps the last valid state") and survives the prop going away entirely
   * (contract: "never erases the host-owned state") -- only a later, validated `diffReviewState`
   * ever replaces it. */
  let lastValidDiffReviewState = $state<DiffReviewState | undefined>(undefined);
  /** Set when the currently supplied `diffReviewState` fails validation; cleared on the next
   * validated input. Never blocks document editing -- nothing here touches `value`/`original`. */
  let diffReviewIntegrationError = $state<DiffReviewError | undefined>(undefined);
  let diffReviewAnnotationSelection = $state<DiffViewerAnnotationSelection | null>(null);
  let activeDiffDraftId = $state<string | null>(null);
  let diffViewerRef = $state<DiffViewerRef | undefined>(undefined);
  /** Set by `handleDiffDraftOpen`; the effect below focuses the composer once it is in the DOM
   * (COR-511 review follow-up, mirrors `diff-review.svelte`'s identical fix). */
  let diffComposerFocusRequested = $state(false);
  let diffComposerTextareaElement = $state<HTMLTextAreaElement | undefined>(undefined);

  const diffReviewEnabled = $derived(diffReviewState !== undefined);
  /** The state the diff tab and comment list render from. Only ever a validated value -- an
   * invalid supplied update leaves this exactly where it was. */
  const effectiveDiffReviewState = $derived(
    diffReviewEnabled ? lastValidDiffReviewState : undefined,
  );

  $effect(() => {
    if (diffReviewState === undefined) return;
    const target = buildReviewEditorDiffReviewTarget(id, original, value);
    const result = restoreDiffReviewState(diffReviewState, [target]);
    if (!result.ok) {
      diffReviewIntegrationError = result.error;
      return;
    }
    diffReviewIntegrationError = undefined;
    lastValidDiffReviewState = result.value;
    // `restoreDiffReviewState` always allocates fresh `comments`/`drafts` arrays even when
    // nothing changed (`applySetTargets` maps both unconditionally), so only a value comparison
    // -- never reference equality -- can tell "genuinely changed" from "reconciled to the same
    // thing", and only the former may notify the host (otherwise accepting the host's own
    // echoed-back state here would re-emit forever).
    if (!diffReviewStatesEqual(result.value, diffReviewState)) {
      onDiffReviewStateChange?.(result.value);
    }
  });

  /** Dispatches a mutating diff-review action against the last valid state, forwarding
   * `isReadonly` so a read-only host gets the same `readonly` rejection every other diff-review
   * control already returns for its mutating actions. */
  function dispatchDiffReviewChange(action: DiffReviewAction): DiffReviewResult<DiffReviewState> {
    if (!lastValidDiffReviewState) {
      return {
        ok: false,
        error: { code: 'invalid-record', path: '', message: 'Diff review is not enabled.' },
      };
    }
    return dispatchDiffReviewAction(
      lastValidDiffReviewState,
      action,
      (next) => {
        lastValidDiffReviewState = next;
        onDiffReviewStateChange?.(next);
      },
      { readonly: isReadonly },
    );
  }

  const activeDiffDraft = $derived(
    effectiveDiffReviewState?.drafts.find((draft) => draft.draftId === activeDiffDraftId) ?? null,
  );

  /** Mirrors `DiffReview`'s own `handleSelectionChange` (COR-509 / DR-6): a cleared selection
   * only closes the composer panel (an already-created draft stays in state, recoverable from
   * the `Unsaved drafts` inventory below -- see `handleDiffDraftOpen`), and a committed
   * selection opens a new draft at that anchor. */
  function handleDiffAnnotationSelectionChange(
    selection: DiffViewerAnnotationSelection | null,
  ): void {
    diffReviewAnnotationSelection = selection;
    if (selection === null) {
      activeDiffDraftId = null;
      return;
    }
    const anchor: DiffReviewAnchor = {
      kind: 'range',
      fileOccurrence: selection.fileOccurrence,
      hunkOccurrence: selection.hunkOccurrence,
      side: selection.side,
      startLine: selection.startLine,
      endLine: selection.endLine,
      coordinateSpace: selection.coordinateSpace,
      selectedText: selection.selectedText,
      contextBefore: selection.contextBefore,
      contextAfter: selection.contextAfter,
    };
    const draftId = crypto.randomUUID();
    const outcome = dispatchDiffReviewChange({
      type: 'create-draft',
      draftId,
      targetId: id,
      anchor,
      oldPath: null,
      newPath: null,
    });
    if (outcome.ok) activeDiffDraftId = draftId;
  }

  function updateDiffComposerBody(body: string): void {
    if (!activeDiffDraftId) return;
    dispatchDiffReviewChange({ type: 'update-draft', draftId: activeDiffDraftId, body });
  }

  function closeDiffComposer(): void {
    activeDiffDraftId = null;
    diffReviewAnnotationSelection = null;
  }

  function saveDiffComposer(): void {
    if (!activeDiffDraftId) return;
    const outcome = dispatchDiffReviewChange({ type: 'save-draft', draftId: activeDiffDraftId });
    if (outcome.ok) closeDiffComposer();
  }

  /**
   * Unsaved-drafts inventory (contract, "Drafts, modes, and ReviewEditor": "Cancel preserves an
   * existing draft; only the explicitly confirmed discard action deletes nonempty text," and
   * "All nonempty drafts ... appear in a persistent `Unsaved drafts` inventory with location,
   * Open, Save, and Discard actions"). Cancelling the inline composer (`closeDiffComposer`) never
   * deletes a nonempty draft -- without this, that draft would have no surviving UI path back
   * into view, and every export scope stays `drafts-pending`-blocked with no visible way to
   * clear it. `ReviewEditor` is a single-target, single-file host, so "Open" reduces to opening
   * the diff tab and re-selecting that draft as the active composer; there is no file/target
   * filter to clear.
   *
   * Contract: "Open clears only the necessary filters and focuses its composer" (COR-511 review
   * follow-up -- `activeView = 'diff'` above already satisfies the filter-clearing half for this
   * single-target host; this request flag drives the effect below that focuses the reopened
   * composer's `<textarea>` once it exists in the DOM, in both editable and read-only modes).
   */
  function handleDiffDraftOpen(draft: DiffReviewDraft): void {
    activeView = 'diff';
    activeDiffDraftId = draft.draftId;
    diffComposerFocusRequested = true;
  }

  // Focuses the diff composer once `handleDiffDraftOpen` has requested it and the composer
  // textarea is actually in the DOM (it renders inside `{#if activeDiffDraft}` on the diff tab,
  // so on a first open -- which also has to switch `activeView` -- the element does not exist yet
  // in the same tick).
  $effect(() => {
    if (!diffComposerFocusRequested || !diffComposerTextareaElement) return;
    diffComposerTextareaElement.focus();
    diffComposerFocusRequested = false;
  });

  function handleDiffDraftSave(draftId: string): void {
    const outcome = dispatchDiffReviewChange({ type: 'save-draft', draftId });
    if (outcome.ok && draftId === activeDiffDraftId) closeDiffComposer();
  }

  function handleDiffDraftDiscard(draftId: string): void {
    const outcome = dispatchDiffReviewChange({ type: 'discard-draft', draftId });
    if (outcome.ok && draftId === activeDiffDraftId) closeDiffComposer();
  }

  /**
   * Only ever called for a CURRENT diff comment (contract, "Viewer selection and navigation" /
   * `DiffReviewComments`' identical `onNavigate` note): opens the diff tab, then focuses the
   * anchor through `DiffViewer`'s own public `focusAnchor`, which self-adjusts the bound
   * `diffViewMode` to expose the anchor's side. A file anchor has no line to focus -- opening
   * the tab is the whole of "exposes its side" for one. An outdated/removed comment never
   * reaches here; the merged comment list focuses its own captured detail in place instead.
   */
  function navigateToDiffComment(comment: DiffReviewComment): void {
    activeView = 'diff';
    announce('Switched to diff view');
    if (comment.anchor.kind !== 'range') return;
    const anchor = comment.anchor;
    void tick().then(() => {
      diffViewerRef?.focusAnchor({ side: anchor.side, startLine: anchor.startLine });
      return undefined;
    });
  }

  function handleDiffCommentAction(action: DiffReviewAction): void {
    dispatchDiffReviewChange(action);
  }

  /**
   * The aggregate export gate (contract: "Disabled integration returns `invalid-record`").
   * Distinct from `getDiffReviewExportGate` (which only ever runs once diff review IS enabled,
   * for the drafts-pending/empty-state UI) -- this is the "not enabled at all" branch that
   * precedes it.
   */
  function requireDiffReviewStateForExport(): DiffReviewResult<DiffReviewState> {
    if (!diffReviewEnabled || !lastValidDiffReviewState) {
      return {
        ok: false,
        error: {
          code: 'invalid-record',
          path: '',
          message:
            'Diff review is not enabled, or its supplied state is invalid -- there is nothing to export.',
        },
      };
    }
    return { ok: true, value: lastValidDiffReviewState };
  }

  /**
   * Exports every saved diff comment plus every existing document thread/reply, each exactly
   * once, through DR-5's real exporters -- not a reimplementation. `threads` projects through
   * `projectReviewEditorDocumentThreads` into DR-5's existing-document (`document`/
   * `document-text`) variant; diff comments need no projection, since they are already a real
   * `DiffReviewState`. Distinct from `exportMarkdownSummary`/`exportUnifiedDiff`/`getFormData`,
   * whose scope this does not change.
   */
  export function exportAggregateReviewMarkdown(
    options: DiffReviewExportOptions = {},
  ): DiffReviewResult<string> {
    const state = requireDiffReviewStateForExport();
    if (!state.ok) return state;
    const documentThreads = projectReviewEditorDocumentThreads(id, threads);
    return exportDiffReviewMarkdown(state.value, { ...options, documentThreads });
  }

  /** JSON counterpart of {@link exportAggregateReviewMarkdown}; see its doc for scope. */
  export function exportAggregateReviewJson(
    options: DiffReviewExportOptions = {},
  ): DiffReviewResult<string> {
    const state = requireDiffReviewStateForExport();
    if (!state.ok) return state;
    const documentThreads = projectReviewEditorDocumentThreads(id, threads);
    return exportDiffReviewJson(state.value, { ...options, documentThreads });
  }

  // =========================================================================
  // Selection Popover State (DEP-47)
  // =========================================================================

  /** Position for the selection popover (viewport-relative) */
  let selectionPopoverPosition = $state<SelectionAnchorPosition | null>(null);

  /**
   * Captured selection range for thread creation.
   * We capture this when the popover appears because clicking the popover button
   * will collapse the browser selection before handleSelectionComment runs.
   */
  let capturedSelectionForPopover = $state<{ from: number; to: number } | null>(null);

  /** Whether the selection popover is in expanded form state (user clicked to add comment) */
  let selectionPopoverExpanded = $state(false);
  /**
   * The ProseMirror range whose selection popover was just dismissed, either
   * by submitting a comment or by Escape. Both paths hand focus back to the
   * editor, and ProseMirror may re-write its stored (still non-collapsed)
   * selection into the DOM on focus; the resulting `selectionchange` would
   * otherwise re-open the popover over the dismissed text. It is cleared once
   * the user has pressed a key or a pointer inside the editor AND the editor's
   * own selection has settled — see {@link consumedSelectionReleaseArm}.
   */
  let consumedSelection: { from: number; to: number } | null = null;
  let pointerGesturePending = false;

  /**
   * What the user has since done inside the editor that could start a new
   * selection, if anything. It arms the release of {@link consumedSelection}
   * without performing it: the release itself waits for the editor's
   * selection to settle.
   *
   * Both halves are load-bearing. Releasing on the input alone loses to
   * ProseMirror's deferred `selectionToDOM`, which can restore the old range
   * after a key has collapsed the DOM selection. Releasing on the settled
   * selection alone misfires during the hand-off back from the composer,
   * where ProseMirror briefly reports a caret at the top of the document
   * before restoring the range — no user input, so nothing is armed.
   *
   * Which input it was decides what "settled" has to show. A pointer press
   * always lands a caret of its own first, so anything it selects afterwards
   * is the user's, even the very same range: a double-click on the word that
   * was just commented on must offer to comment on it again. A key cannot be
   * trusted that way — the restore is indistinguishable from a keyboard
   * re-selection of the same range — so a key only releases the latch once
   * the selection has settled somewhere genuinely different.
   */
  let consumedSelectionReleaseArm: 'pointer' | 'key' | null = null;

  /** Keys that only qualify the next keystroke; see {@link consumedSelectionReleaseArm}. */
  const MODIFIER_KEYS = new Set([
    'Alt',
    'AltGraph',
    'CapsLock',
    'Control',
    'Fn',
    'Meta',
    'NumLock',
    'ScrollLock',
    'Shift',
    'Symbol',
  ]);

  /** Whether the selection popover should be visible */
  const showSelectionPopover = $derived(
    activeView === 'editor' &&
      mode === 'edit' &&
      // Must have a user ID to create comments
      currentUserId !== undefined &&
      // Position is only set when browser selection is non-collapsed
      // (checked via window.getSelection() in the debounced handler)
      // OR the popover is already expanded (user is composing a comment)
      (selectionPopoverPosition !== null || selectionPopoverExpanded) &&
      // Don't show if a thread popover is already open
      popoverThreadId === null,
  );

  /**
   * Whether the SelectionPopover component instance should stay MOUNTED
   * (CIN-376 round 20 review). SelectionPopover intentionally never
   * unmounts its own root element while closing — it keeps itself mounted
   * for the duration of its exit transition via
   * `data-cinder-visible`/`data-cinder-closing`, not an `{#if}` gate, so it
   * can actually fade out. Wrapping it directly in `{#if showSelectionPopover}`
   * destroyed the WHOLE component instance the instant `handleSelectionPopoverClose`
   * cleared `selectionPopoverPosition`/`selectionPopoverExpanded` — before
   * its own retained-exit lifecycle ever got a chance to run, so the editor
   * still snapped the popover closed instead of fading it. This mirrors
   * `showSelectionPopover` becoming true, but only clears via
   * `onExitComplete` once SelectionPopover's own exit genuinely finishes.
   */
  let selectionPopoverMounted = $state(false);
  $effect(() => {
    if (showSelectionPopover) {
      selectionPopoverMounted = true;
    }
  });

  /** Delay for scroll-then-position pattern (matches smooth scroll duration) */
  const POSITION_DELAY_MS = 350;

  /**
   * Get the preferred scroll behavior respecting prefers-reduced-motion.
   * @returns 'instant' if user prefers reduced motion, 'smooth' otherwise
   */
  function getScrollBehavior(): ScrollBehavior {
    return reducedMotion.current ? 'instant' : 'smooth';
  }

  // =========================================================================
  // Screen Reader Announcements (DEP-47)
  // =========================================================================

  /**
   * Announce a message to screen readers via the LiveRegion component.
   * Safe to call before the ref is available (no-op in that case).
   *
   * @param message - The message to announce
   * @param priority - 'polite' (default) or 'assertive'
   */
  function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    liveRegionRef?.announce(message, priority);
  }

  $effect(() => {
    if (id !== lastMalformedFrontMatterId) {
      malformedFrontMatterDismissed = false;
      lastMalformedFrontMatterAnnouncementKey = '';
      lastMalformedFrontMatterId = id;
    }
  });

  $effect(() => {
    if (!hasMalformedFrontMatter) {
      malformedFrontMatterDismissed = false;
      lastMalformedFrontMatterAnnouncementKey = '';
      return;
    }

    const announcementKey = `${id}:${value}`;
    if (announcementKey === lastMalformedFrontMatterAnnouncementKey) return;
    lastMalformedFrontMatterAnnouncementKey = announcementKey;

    void tick().then(() => {
      if (!hasMalformedFrontMatter || lastMalformedFrontMatterAnnouncementKey !== announcementKey) {
        return undefined;
      }

      announce(frontMatterParseWarning);
      return undefined;
    });
  });

  async function focusMalformedFrontMatterSource(): Promise<void> {
    await tick();
    const textarea = document.getElementById(id);
    if (!(textarea instanceof HTMLTextAreaElement)) return;

    textarea.focus();
    textarea.setSelectionRange(0, 0);
  }

  // Get the popover thread
  const popoverThread = $derived.by(() => {
    if (!popoverThreadId) return null;
    return threads.find((t) => t.id === popoverThreadId) ?? null;
  });

  // Clear popover if thread is deleted
  $effect(() => {
    if (popoverThreadId && !popoverThread) {
      popoverThreadId = null;
      popoverPosition = null;
    }
  });

  // Clear internal active thread if it no longer exists
  $effect(() => {
    if (activeThreadId && !threads.some((t) => t.id === activeThreadId)) {
      if (threadSelectedWithoutPopoverId === activeThreadId) {
        threadSelectedWithoutPopoverId = null;
      }
      activeThreadId = null;
    }
  });

  // Deep linking: open popover when activeThreadId is set externally (e.g., URL navigation).
  $effect(() => {
    let positionTimeoutId: ReturnType<typeof setTimeout> | null = null;

    if (activeThreadId && popoverThreadId !== activeThreadId) {
      if (threadSelectedWithoutPopoverId === activeThreadId) return;

      const thread = threads.find((t) => t.id === activeThreadId);
      if (thread) {
        const threadIdToOpen = activeThreadId;

        // First, scroll the anchor into view. We defer popover positioning until
        // after the scroll completes to avoid the popover appearing off-screen.
        scrollAnchorIntoView(threadIdToOpen);

        // After scrolling, calculate position and open the popover.
        // We re-fetch the thread inside the callback to avoid using stale data
        // if the threads array changes during the scroll delay.
        positionTimeoutId = setTimeout(() => {
          // Re-fetch thread to ensure we have current data (thread may have been deleted/modified)
          const currentThread = threads.find((t) => t.id === threadIdToOpen);
          if (!currentThread) return;

          const pos = calculateViewportPosition(currentThread.anchor.from);
          if (pos) {
            popoverPosition = { x: pos.left + 16, y: pos.top };
            popoverThreadId = threadIdToOpen;
          }
        }, POSITION_DELAY_MS);
      }
    }

    // Cleanup: cancel pending timeout if effect re-runs or component unmounts
    return () => {
      if (positionTimeoutId !== null) {
        clearTimeout(positionTimeoutId);
      }
    };
  });

  /**
   * Scroll the editor to bring an anchor position into view.
   * @param threadId - The thread ID to scroll to (passed explicitly to avoid stale closure)
   */
  function scrollAnchorIntoView(threadId: ThreadId): void {
    // Query using the passed threadId, not the reactive activeThreadId,
    // to avoid race conditions when called from setTimeout.
    // Scope query to editor DOM to handle multiple ReviewEditor instances on page.
    //
    // Thread.id is consumer-supplied (not necessarily generateId()'s output —
    // a consumer's own database key can contain '"' or other CSS-meaningful
    // characters), so it is escaped before being interpolated into the
    // attribute selector. An unescaped id could throw a DOM SyntaxError or
    // silently match the wrong element. Now that scrollToThread (below)
    // routes through this function too, that risk is reachable from the
    // public imperative API, not just the internal deep-linking effect.
    const editorDom = editorRef?.getView()?.dom;
    const anchorElement = editorDom?.querySelector(`[data-thread-id="${CSS.escape(threadId)}"]`);
    if (anchorElement) {
      anchorElement.scrollIntoView({ behavior: getScrollBehavior(), block: 'center' });
    }
  }

  // =========================================================================
  // Thread Popover Handlers
  // =========================================================================

  /**
   * Handle closing the thread popover.
   * Also clears activeThreadId to prevent the deep-linking effect from
   * immediately reopening the popover, and cancels any pending panel selection timeout.
   */
  function handlePopoverClose(): void {
    // Cancel any pending panel selection timeout
    if (selectTimeoutId !== null) {
      clearTimeout(selectTimeoutId);
      selectTimeoutId = null;
    }

    popoverThreadId = null;
    popoverPosition = null;
    activeThreadId = null;
  }

  /**
   * Handle thread delete from popover.
   */
  function handlePopoverDelete(threadId: string): void {
    if (currentUserId) {
      deleteThread(threadId);
      handlePopoverClose();
    }
  }

  /**
   * Handle comment update from popover.
   */
  function handlePopoverCommentUpdate(threadId: string, commentId: string, body: string): void {
    updateComment(threadId, commentId, body);
  }

  /**
   * Handle comment delete from popover.
   */
  function handlePopoverCommentDelete(threadId: string, commentId: string): void {
    deleteComment(threadId, commentId);
  }

  /**
   * Handle comment create from popover.
   */
  function handlePopoverCommentCreate(threadId: string, body: string): void {
    if (currentUserId) {
      createComment(threadId, body, currentUserId);
    }
  }

  /**
   * Calculate position for fixed-position popovers near an anchor.
   * Returns viewport-relative coordinates for use with position: fixed elements
   * (ThreadPopover).
   */
  function calculateViewportPosition(from: number): { top: number; left: number } | null {
    const view = editorRef?.getView();
    if (!view) return null;

    try {
      const coords = view.coordsAtPos(
        documentPositionToBodyPosition(from, currentDocument.bodyOffset),
      );
      if (coords) {
        // coords are already viewport-relative from ProseMirror
        return {
          top: coords.top + 24, // Below the anchor
          left: Math.max(16, coords.left), // Minimum 16px from viewport edge
        };
      }
    } catch {
      // Position may be invalid
    }
    return null;
  }

  // =========================================================================
  // Anchor Plugin Integration (DEP-39)
  // =========================================================================

  /**
   * Handle click on an anchor decoration.
   * Opens the thread popover at the click location.
   */
  function handleAnchorClick(threadId: string, event: MouseEvent): void {
    // Cancel any pending panel selection timer to prevent race conditions
    // where the timer callback would unexpectedly switch to a different thread
    if (selectTimeoutId !== null) {
      clearTimeout(selectTimeoutId);
      selectTimeoutId = null;
    }

    // Clear selection popover state when opening a thread popover
    // Otherwise stale state persists and the popover may reappear at an invalid position
    selectionPopoverPosition = null;
    capturedSelectionForPopover = null;
    selectionPopoverExpanded = false;

    // Set active thread and open popover
    threadSelectedWithoutPopoverId = null;
    activeThreadId = threadId;

    // Find the thread to show the popover
    const thread = threads.find((t) => t.id === threadId);
    if (thread) {
      // Position popover near the click location
      popoverPosition = { x: event.clientX + 16, y: event.clientY };
      popoverThreadId = threadId;
    }
  }

  function announceOrphanedThreads(updates: AnchorUpdate[]): void {
    const orphaned = updates.filter((update) => update.status === 'orphaned');
    if (orphaned.length === 0) return;
    announce(
      orphaned.length === 1
        ? 'The text a comment was anchored to is no longer in the document. The comment is kept.'
        : `The text ${orphaned.length} comments were anchored to is no longer in the document. Those comments are kept.`,
    );
  }

  const anchorManager = createAnchorManager({
    getThreads: () => threads,
    setThreads: (nextThreads) => (threads = nextThreads),
    getEditorView: () => editorRef?.getView() ?? undefined,
    getMarkdown: () => editorRef?.getMarkdown() ?? value,
    getValue: () => value,
    onAnchorClick: handleAnchorClick,
    onOrphanedThreads: announceOrphanedThreads,
  });
  const anchorPlugin = anchorManager.plugin;

  // The view is created asynchronously. Sync after readiness and whenever the
  // caller changes threads, including an empty array that clears decorations.
  $effect(() => {
    if (editorViewReady && !anchorManager.pendingState) {
      anchorManager.syncThreadsToPlugin(threads);
    }
  });

  // Determine if editor is readonly based on mode
  const isReadonly = $derived(mode === 'readonly');

  // Clear selection popover state when mode changes to readonly
  // This prevents stale popover state from persisting across mode transitions
  $effect(() => {
    if (mode === 'readonly') {
      selectionPopoverPosition = null;
      capturedSelectionForPopover = null;
      selectionPopoverExpanded = false;
    }
  });

  // =========================================================================
  // Optimized Change Detection (DEP-47)
  // =========================================================================

  /**
   * Change tracker with lazy dirty flag and debounced semantic verification.
   * Avoids per-keystroke normalize() calls which are expensive for large documents.
   */
  const changeTracker = createChangeTracker({
    debounceMs: 300,
    includeFrontMatter: true,
  });

  // Wire baseline and current values to the tracker
  $effect(() => {
    changeTracker.setBaseline(original);
  });

  $effect(() => {
    changeTracker.setCurrent(value);
  });

  /** Timeout ID for debounced selection position calculation */
  let selectionTimeoutId: ReturnType<typeof setTimeout> | null = null;

  /** Debounce delay for selection position calculation (ms) */
  const SELECTION_DEBOUNCE_MS = 20;

  // Listen to browser's native selectionchange event
  // This is more reliable than ProseMirror's selection events for detecting visual selection
  $effect(() => {
    if (typeof document === 'undefined') return;

    function handleBrowserSelectionChange() {
      // Clear any pending calculation
      if (selectionTimeoutId !== null) {
        clearTimeout(selectionTimeoutId);
        selectionTimeoutId = null;
      }

      const browserSelection = window.getSelection();

      // Only process in edit mode
      if (mode !== 'edit') {
        selectionPopoverPosition = null;
        capturedSelectionForPopover = null;
        return;
      }

      // Don't clear the popover if focus is within it (user is interacting with the form)
      const selectionPopoverElement = document.getElementById(`${id}-selection-popover`);
      if (selectionPopoverElement?.contains(document.activeElement)) {
        return;
      }

      // Don't clear the popover if it's expanded (user is composing a comment)
      // This is especially important for Safari where clicking a button doesn't focus it,
      // which would otherwise cause the popover to close unexpectedly
      if (selectionPopoverExpanded) {
        return;
      }

      // If selection is collapsed, hide popover immediately and reset all popover state
      const collapsed = !browserSelection || browserSelection.isCollapsed;
      if (collapsed) {
        selectionPopoverPosition = null;
        capturedSelectionForPopover = null;
        selectionPopoverExpanded = false;
        // A collapsed caret falls through to the debounce ONLY while a release
        // is pending: that is how the editor's own selection is observed
        // moving off {@link consumedSelection}, and observing it is what
        // releases the latch. Releasing on the KEYSTROKE instead would
        // reintroduce the original race — a caret key pressed inside
        // ProseMirror's ~20ms focus window collapses the DOM selection, the
        // pending `selectionToDOM` then restores the old range, and the
        // popover would reopen over the text just commented on.
        //
        // With nothing latched there is nothing for the callback to do, and
        // the popover state above is already cleared, so an ordinary caret
        // move schedules no timer at all.
        if (!consumedSelection || !consumedSelectionReleaseArm) return;
      }

      // Check if selection is within the actual editor DOM (not front matter controls,
      // sidebar, or toolbar content).
      const anchorNode = browserSelection?.anchorNode;
      const editorDom = editorRef?.getView()?.dom;
      if (!editorDom || !anchorNode || !editorDom.contains(anchorNode)) {
        selectionPopoverPosition = null;
        capturedSelectionForPopover = null;
        selectionPopoverExpanded = false;
        return;
      }

      // Debounce position calculation to let rapid selection events settle
      selectionTimeoutId = setTimeout(() => {
        selectionTimeoutId = null;

        // The latch is released here, once the editor's own selection has
        // settled somewhere other than the range whose comment was just
        // submitted. Debouncing is what makes that reliable: ProseMirror
        // syncs its state from the DOM asynchronously, and a restore that
        // lands inside the window simply reschedules this callback, so what
        // it reads is where the selection actually ended up.
        const settledView = editorRef?.getView();
        if (consumedSelection && consumedSelectionReleaseArm && settledView?.hasFocus()) {
          const settled = settledView.state.selection;
          const movedElsewhere =
            settled.from !== consumedSelection.from || settled.to !== consumedSelection.to;
          if (movedElsewhere || consumedSelectionReleaseArm === 'pointer') {
            consumedSelection = null;
            consumedSelectionReleaseArm = null;
          }
        }

        // Re-check selection after debounce
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
          selectionPopoverPosition = null;
          capturedSelectionForPopover = null;
          return;
        }

        // Get the selection range and compute position from the browser's DOM
        const range = sel.getRangeAt(0);
        const anchorPosition = getSelectionAnchorPosition(range);

        if (anchorPosition) {
          // Capture the ProseMirror selection range for thread creation
          // We need this because clicking the popover will collapse the selection
          // Get selection directly from the view since currentSelection state
          // may not be updated yet when the native selectionchange fires
          const view = editorRef?.getView();
          if (view) {
            const { from, to } = view.state.selection;
            // Still the range whose comment was just submitted: this is
            // ProseMirror restoring its stored selection on refocus, not the
            // user asking to comment on that text again.
            if (consumedSelection && consumedSelection.from === from && consumedSelection.to === to)
              return;
            if (from !== to) {
              capturedSelectionForPopover = { from, to };
              // Only show popover when we have a valid captured selection
              // This prevents showing a popover that can't submit due to timing mismatches
              selectionPopoverPosition = anchorPosition;
            }
          }
        }
      }, SELECTION_DEBOUNCE_MS);
    }

    // Input inside the editor ARMS the release; see
    // {@link consumedSelectionReleaseArm} for why it does not perform it.
    function armConsumedSelectionRelease(event: Event) {
      const editorDom = editorRef?.getView()?.dom;
      if (!editorDom || !(event.target instanceof Node) || !editorDom.contains(event.target))
        return;

      if (event.type !== 'keydown' && showSelectionPopover) {
        // Outside-click dismissal runs later in this same event dispatch. Do not
        // let a pointer gesture that did not close the popover arm a later Escape.
        pointerGesturePending = true;
        queueMicrotask(() => {
          pointerGesturePending = false;
        });
      }

      if (!consumedSelection) return;
      // A modifier held on its own arms nothing. It starts no selection, and
      // arming on it would let the transient caret ProseMirror reports during
      // the composer hand-off satisfy the release — the very race the latch
      // exists for. `Shift` is the one that matters: it is how a keyboard
      // selection begins, so it arrives before any selection exists.
      if (event instanceof KeyboardEvent && MODIFIER_KEYS.has(event.key)) return;
      // Select-all is released outright rather than armed. It cannot be
      // confused with ProseMirror's restore — that is not a keystroke — and
      // when the comment covered the whole document the range it selects is
      // the consumed one, so waiting for the selection to settle elsewhere
      // would strand a keyboard-only user; the browser may not even emit a
      // `selectionchange` when everything is already selected.
      if (
        event instanceof KeyboardEvent &&
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'a'
      ) {
        consumedSelection = null;
        consumedSelectionReleaseArm = null;
        return;
      }
      consumedSelectionReleaseArm = event.type === 'keydown' ? 'key' : 'pointer';
    }

    // `pointerdown` covers mouse, touch, and pen in one listener; the
    // `mousedown`/`touchstart` pair is the fallback for a browser without
    // Pointer Events, matching how the components package handles this.
    const pointerEventNames =
      typeof window.PointerEvent !== 'undefined'
        ? (['pointerdown'] as const)
        : (['mousedown', 'touchstart'] as const);

    document.addEventListener('selectionchange', handleBrowserSelectionChange);
    for (const eventName of pointerEventNames)
      document.addEventListener(eventName, armConsumedSelectionRelease, true);
    document.addEventListener('keydown', armConsumedSelectionRelease, true);

    return () => {
      document.removeEventListener('selectionchange', handleBrowserSelectionChange);
      for (const eventName of pointerEventNames)
        document.removeEventListener(eventName, armConsumedSelectionRelease, true);
      document.removeEventListener('keydown', armConsumedSelectionRelease, true);
      if (selectionTimeoutId !== null) {
        clearTimeout(selectionTimeoutId);
        selectionTimeoutId = null;
      }
    };
  });

  // Handle selection changes from ProseMirror (for currentSelection state)
  function handleSelectionChange(selection: EditorSelection | null) {
    // Mark editor as ready on first selection change (fired when editor initializes)
    if (!editorViewReady) {
      editorViewReady = true;
    }
    currentSelection = selection;
  }

  // Handle content changes
  function handleChange(newValue: string) {
    value = newValue;
    onValueChange?.(newValue);
  }

  function handleEditorBodyChange(newBody: string) {
    handleChange(combineFrontMatterAndBody(currentDocument, newBody));
  }

  function handleFrontMatterChange(data: Record<string, unknown> | null, raw?: string | null) {
    const previousBodyOffset = currentDocument.bodyOffset;
    const nextValue = replaceFrontMatterData(value, data, raw);
    const nextDocument = parseReviewEditorFrontMatter(nextValue);

    if (previousBodyOffset !== nextDocument.bodyOffset) {
      threads = threads.map((thread) => ({
        ...thread,
        anchor: remapDocumentAnchorBodyOffset(
          thread.anchor,
          previousBodyOffset,
          nextDocument.bodyOffset,
          nextValue,
        ),
      }));
    }

    handleChange(nextValue);
  }

  // =========================================================================
  // Imperative Methods
  // =========================================================================

  /** Focus the editor */
  export function focus(): void {
    editorRef?.focus();
  }

  /** Get current markdown content */
  export function getMarkdown(): string {
    const body = editorRef?.getMarkdown() ?? currentDocument.body;
    return combineFrontMatterAndBody(currentDocument, body);
  }

  /** Set markdown content */
  export function setMarkdown(content: string): void {
    value = content;
    editorRef?.setMarkdown(parseReviewEditorFrontMatter(content).body);
  }

  /** Get current AST */
  export function getAst() {
    return editorRef?.getAst();
  }

  /** Get current selection */
  export function getSelection(): EditorSelection | null {
    const selection = editorRef?.getSelection();
    if (!selection) return null;
    return {
      ...selection,
      from: selection.from + currentDocument.bodyOffset,
      to: selection.to + currentDocument.bodyOffset,
    };
  }

  /**
   * Resolve an anchor position to viewport coordinates, or null.
   *
   * `coordsAtPos` throws a RangeError for a position outside the document, and
   * an anchor's stored position outlives the text it described: an orphaned
   * anchor keeps its old range (so a later paste can be matched against it),
   * and a shorter document replacement can leave that range past the end.
   * Selecting such a thread in the sidebar is an ordinary click, so it must not
   * be able to throw. `calculateViewportPosition` already guards its own call
   * this way; these two did not.
   *
   * A review finding caught that this used `anchor.from` (the caller's cached
   * `thread.anchor`) directly, unlike `navigateToAdjacentComment` right above,
   * which already routes its own position through `resolveAnchorSelectionRange`
   * for exactly this reason: an edit before an anchor maps this plugin's live
   * position immediately, but does not update `threads` until deferred
   * re-anchoring. `resolveAnchorSelectionRange`'s selection fix and this
   * popover-positioning fix were the same underlying bug in two call sites —
   * fixing the selection alone left the popover opening beside unrelated text
   * at the anchor's former position even though the caret landed correctly.
   * `threadId` is now required so this can resolve the same live position.
   */
  function anchorCoords(
    view: NonNullable<ReturnType<NonNullable<typeof editorRef>['getView']>>,
    threadId: string,
    anchor: Thread['anchor'],
  ): { left: number; top: number } | null {
    if (anchor.status === 'orphaned') return null;
    const fallback = {
      from: documentPositionToBodyPosition(anchor.from, currentDocument.bodyOffset),
      to: documentPositionToBodyPosition(anchor.to, currentDocument.bodyOffset),
    };
    const { from: position } = resolveAnchorSelectionRange(view, threadId, fallback);
    if (position < 0 || position > view.state.doc.content.size) return null;
    try {
      return view.coordsAtPos(position);
    } catch {
      // Position was valid by size but not addressable (mid-node boundary).
      return null;
    }
  }

  /**
   * Scroll to a specific thread's anchor position in the editor.
   *
   * Throws if `threadId` does not match any thread in `threads`. This is a
   * deliberate departure from the mutation methods' (`deleteThread`,
   * `deleteComment`, ...) documented silent-no-op-on-missing-id convention —
   * those exist to support declarative UI patterns where a caller doesn't
   * pre-check state before issuing a delete. `scrollToThread` is a one-shot
   * imperative navigation call (driven by a deep link, a notification, a
   * "jump to comment" action); a stale or mistyped id there is a caller bug
   * that should fail loudly rather than silently do nothing, since a
   * successful no-op scroll (the anchor happened to already be in view) and
   * an unknown-id no-op were otherwise indistinguishable from the outside
   * (cinder#1317). Internal callers (`handleSidebarThreadSelect`) already
   * guard on thread existence before calling this, so they never hit the
   * throw.
   *
   * @throws {Error} if no thread with `threadId` exists.
   */
  export function scrollToThread(threadId: string): void {
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) {
      throw new Error(`ReviewEditor.scrollToThread: no thread with id "${threadId}"`);
    }

    // Scroll the anchor element itself into view via scrollIntoView — the
    // same mechanism scrollAnchorIntoView already uses successfully. The
    // previous implementation called `view.dom.scrollTo(...)`: `view.dom`
    // (the .ProseMirror contenteditable) has no `overflow` in any shipped
    // stylesheet, so that call was clamped to 0 and never moved anything
    // (cinder#1316). A thread with no anchor element in the document (a
    // document-level comment, or one still orphaned) is a silent no-op here,
    // same as before — there is nowhere to scroll it to.
    scrollAnchorIntoView(threadId);
  }

  /**
   * Handle thread selection from the comment sidebar.
   * Scrolls to the thread and opens its popover.
   */
  function handleSidebarThreadSelect(
    threadId: string,
    options: { openPopover?: boolean } = {},
  ): void {
    // Re-selecting a thread whose popover is ALREADY open is a no-op.
    // Deliberately checks BOTH activeThreadId and popoverThreadId, not just
    // activeThreadId: guarding on activeThreadId alone would also block a
    // legitimate RETRY. If the deferred timer below runs while the editor
    // view is unmounted (e.g. the user switched to the Diff/Summary tab
    // before it fired), `view` is unavailable and the callback bails without
    // ever setting popoverThreadId — activeThreadId stays set to this
    // thread, but no popover exists. A later re-click on the same row must
    // be allowed to try again rather than silently doing nothing forever.
    //
    // In the live component this exact scenario is already recovered by the
    // deep-linking `$effect` above (re-mounting MarkdownEditor re-syncs
    // `threads` through the anchor plugin, which is enough on its own to
    // retrigger that effect and reopen the popover — verified empirically,
    // with no re-click at all). This guard is kept anyway: it matches what
    // its own name promises rather than a narrower approximation of it, and
    // it is the only thing that would still matter for a consumer whose
    // `threads` prop stays reference-stable across the failed attempt (no
    // anchor-plugin re-sync to fall back on).
    //
    // Without any guard at all, re-clicking the active sidebar row
    // rescheduled a redundant 350ms scroll-then-reposition even once
    // ThreadPopover's ignoreRefs (see thread-popover.svelte) stopped the
    // click from destroying the open popover in the first place
    // (cinder#1320).
    if (threadId === activeThreadId && threadId === popoverThreadId) return;

    const thread = threads.find((t) => t.id === threadId);
    if (!thread) return;

    if (options.openPopover === false) {
      selectSidebarThreadWithoutPopover(threadId);
      return;
    }

    threadSelectedWithoutPopoverId = null;

    // Cancel any timer from a PREVIOUS sidebar selection still in flight.
    // Without this, choosing a second thread within POSITION_DELAY_MS of the
    // first orphans that first timer instead of cancelling it — it still
    // fires later, on its own original schedule, and can briefly reopen the
    // earlier thread's popover after the newer selection: the same class of
    // bug cinder#1319 fixed for the anchor-click path, recurring narrowly
    // between two sidebar selections.
    if (selectTimeoutId !== null) {
      clearTimeout(selectTimeoutId);
      selectTimeoutId = null;
    }

    // Set active thread
    activeThreadId = threadId;

    // Scroll to the thread
    scrollToThread(threadId);

    // Open popover at anchor position after scroll completes. Stored in
    // selectTimeoutId — matching handleAnchorClick's and the unmount
    // cleanup's expectations — so a thread selected afterward by anchor
    // click can actually cancel this timer. Previously this assigned
    // nothing, so handleAnchorClick's own cancellation was a no-op against
    // it, and selecting a different thread by anchor click within 350ms of a
    // sidebar click did not stop this timer: it fired anyway and silently
    // overwrote the popover back to the stale sidebar selection
    // (cinder#1319).
    selectTimeoutId = setTimeout(() => {
      selectTimeoutId = null;
      const view = editorRef?.getView();
      if (!view) return;

      const coords = anchorCoords(view, threadId, thread.anchor);
      if (coords) {
        popoverPosition = { x: coords.left + 16, y: coords.top };
        popoverThreadId = threadId;
        return;
      }

      // An orphaned thread has no position to anchor to — that is what makes it
      // orphaned. Its comments still have to be readable, so open the popover
      // against the editor's own box rather than dropping the click silently.
      const editorBox = view.dom.getBoundingClientRect();
      popoverPosition = { x: editorBox.left + 16, y: editorBox.top + 16 };
      popoverThreadId = threadId;
    }, POSITION_DELAY_MS);
  }

  function selectSidebarThreadWithoutPopover(threadId: string): void {
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) return;

    if (selectTimeoutId !== null) {
      clearTimeout(selectTimeoutId);
      selectTimeoutId = null;
    }

    threadSelectedWithoutPopoverId = threadId;
    activeThreadId = threadId;
    popoverThreadId = null;
    popoverPosition = null;
  }

  /**
   * Resolve the sidebar row for the currently active thread, scoped to this
   * editor instance's own sidebar (`{id}-sidebar`) so a page with more than
   * one ReviewEditor never matches another instance's row.
   *
   * Passed to ThreadPopover as `ignoreClickOutsideRef`: its click-outside
   * dismiss listener runs in the capture phase, before the row's own
   * `onclick`, so without this every click on the active row — including a
   * re-click that changes nothing — closed the popover before
   * `handleSidebarThreadSelect` ever ran, destroying and reopening it
   * ~350ms later and discarding any unsent reply text sitting in
   * CommentComposer's draft state (cinder#1320). Ignoring only the active
   * row (not the whole sidebar) is deliberate: clicking a DIFFERENT row
   * must still close this popover immediately rather than leaving it
   * visible for 350ms.
   */
  function activeSidebarRowElement(): HTMLElement | null {
    if (!activeThreadId) return null;
    return (
      document
        .getElementById(`${id}-sidebar`)
        ?.querySelector<HTMLElement>(
          `#${CSS.escape(`${id}-sidebar-thread-open-${activeThreadId}`)}`,
        ) ?? null
    );
  }

  /**
   * cinder#1304: the keyboard route to an anchored comment. `.comment-anchor`
   * decorations are intentionally not `tabindex`-focusable (see
   * anchor-decorations.ts's `computeDecorations` doc comment for why), so Tab
   * alone can never reach one — this is the substitute. Moves the caret to
   * the next/previous anchor in document order and opens its thread the same
   * way clicking the decoration does (`handleSidebarThreadSelect` already
   * does exactly that "scroll, then open popover at the anchor" sequence for
   * the sidebar's own click handler; reused here rather than duplicated).
   *
   * The ordering/wrap-around math lives in comment-navigation.ts, split out
   * so it is unit-testable without mounting the full component (which pulls
   * in ReviewEditorControls' formatting toolbar).
   *
   * A PR review on this fix flagged that `selectAnchorRange` below creates a
   * real, non-collapsed browser selection, which — in an editable,
   * `currentUserId`-bearing ReviewEditor — could also arm
   * `handleBrowserSelectionChange`'s "add new comment" selection popover,
   * flashing it open over this function's own (correct) thread popover.
   * Investigated with a real-Chromium probe against this exact scenario
   * (with-comments example, `currentUserId` set): `showSelectionPopover`'s
   * derivation does compute `true` once the debounced position calculation
   * completes (confirmed by mirroring its exact condition inline against
   * live component state at that instant — `popoverThreadId` is genuinely
   * still `null`, since `handleSidebarThreadSelect` below does not set it
   * until its own 350ms `POSITION_DELAY_MS` elapses), but the selection
   * popover element (`document.getElementById` on the same id string the
   * component's own selection-popover-focus check uses) never appears in
   * the DOM at any sampled point from 10ms to 600ms after the chord fires.
   * No suppression mechanism was added on the strength of that: a flag that
   * guards against something that doesn't visibly happen is complexity with
   * no proven benefit, and a one-shot "consume on the next selectionchange"
   * flag has its own failure mode (an earlier version of this fix could
   * silently swallow an unrelated real selection if the programmatic one
   * happened not to fire a selectionchange event at all). If this ever
   * reproduces in a real browser, re-open cinder#1304 with a repro rather
   * than re-adding the flag speculatively.
   */
  function navigateToAdjacentComment(direction: 1 | -1): void {
    const ordered = orderedTextThreads(threads);
    if (ordered.length === 0) {
      announce('No commented text in this document.');
      return;
    }

    const target = nextCommentThread(threads, activeThreadId, direction);
    if (!target) return;
    const nextIndex = ordered.findIndex((t) => t.id === target.id);

    const view = editorRef?.getView();
    if (view) {
      // `target.anchor.from`/`to` come from `threads` (converted to body
      // positions below), which a review finding on this fix caught can go
      // stale after an ordinary edit — see resolveAnchorSelectionRange's own
      // doc comment in anchor-decorations.ts for the full mechanism and why
      // this is only a fallback, not the primary source.
      const fallback = {
        from: documentPositionToBodyPosition(target.anchor.from, currentDocument.bodyOffset),
        to: documentPositionToBodyPosition(target.anchor.to, currentDocument.bodyOffset),
      };
      const { from, to } = resolveAnchorSelectionRange(view, target.id, fallback);
      if (selectAnchorRange(view, from, to)) {
        view.focus();
      }
      // else: position not resolvable right now — still open the thread
      // below, just without moving the caret.
    }

    handleSidebarThreadSelect(target.id);

    const preview = truncate(getVisibleComments(target)[0]?.body ?? '', 60);
    announce(`Comment ${nextIndex + 1} of ${ordered.length}${preview ? `: ${preview}` : ''}`);
  }

  /**
   * Handle request to add a document-level comment from the sidebar.
   * The body is provided by the inline CommentComposer in the sidebar.
   */
  function handleAddDocumentComment(body: string): void {
    if (!currentUserId) {
      devWarn('Cannot add document comment: no currentUserId');
      return;
    }

    createDocumentThread(body, currentUserId);
  }

  /**
   * Get serializable review state.
   * Threads are converted to persisted format for re-anchoring.
   *
   * Content is preserved as the complete Markdown document, including front matter.
   */
  export function getState(): ReviewState {
    // Shared with the public `toPersistedThreads` export so a saved state and a
    // hand-converted one round-trip through `toRuntimeThreads` identically.
    const persistedThreads: PersistedThread[] = toPersistedThreads(threads);

    return {
      schemaVersion: 4,
      content: value,
      original: original || undefined,
      threads: persistedThreads,
      reviewSession: undefined,
      frontMatter: currentDocument.data,
      frontMatterRaw: currentDocument.raw,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Restore review state from serialized data.
   * Thread anchors are re-anchored using the quote/prefix/suffix context.
   *
   * Note: This updates both content and original baseline from the incoming state,
   * ensuring subsequent diffs and exports use the correct baseline.
   */
  export function setState(state: ReviewState): void {
    const nextValue = reviewStateToMarkdown(state);
    value = nextValue;
    // Update original baseline if provided in state, so diffs work correctly
    if (state.original !== undefined) {
      original = state.original;
    }
    anchorManager.setPendingState({ ...state, content: nextValue });

    // Attempt re-anchoring immediately if editor is ready
    anchorManager.attemptReanchoring();
  }

  /** Get direct access to ProseMirror view (advanced use) */
  export function getView() {
    return editorRef?.getView() ?? null;
  }

  /** Get direct access to Milkdown editor (advanced use) */
  export function getEditor() {
    return editorRef?.getEditor() ?? null;
  }

  // =========================================================================
  // Export Operations
  // =========================================================================

  /**
   * Export an LLM-optimized Markdown summary of the review.
   * Includes document changes and comment threads
   * in a structured format suitable for LLM analysis.
   */
  export function exportMarkdownSummary(
    options: MarkdownSummaryOptions | undefined = undefined,
  ): MarkdownSummaryResult {
    return reviewEditorExports.exportMarkdownSummary(options);
  }

  /**
   * Export a Git-compatible unified diff.
   * The output can be applied with `git apply` or `patch` command.
   */
  export function exportUnifiedDiff(
    options: UnifiedDiffOptions | undefined = undefined,
  ): UnifiedDiffResult {
    return reviewEditorExports.exportUnifiedDiff(options);
  }

  // =========================================================================
  // Export Action Callbacks (for ExportActions component)
  // =========================================================================

  /** Get plain markdown content for clipboard export */
  function handleExportContent(): string {
    return reviewEditorExports.handleExportContent();
  }

  /** Get LLM-optimized summary for clipboard export */
  function handleExportSummary(): string {
    return reviewEditorExports.handleExportSummary();
  }

  /** Get JSON state for clipboard export */
  function handleExportJSON(): string {
    return reviewEditorExports.handleExportJSON();
  }

  /** Get unified diff for clipboard export */
  function handleExportDiff(): string {
    return reviewEditorExports.handleExportDiff();
  }

  /** Get comments export for clipboard export */
  function handleExportComments(): string {
    return reviewEditorExports.handleExportComments();
  }

  // =========================================================================
  // Form Participation (FormData integration)
  // =========================================================================

  /**
   * Get form data as a structured object.
   * Use this for programmatic access when not using native form submission.
   *
   * @example
   * ```ts
   * const data = editor.getFormData();
   * await fetch('/api/review', {
   *   method: 'POST',
   *   body: JSON.stringify(data)
   * });
   * ```
   */
  export function getFormData(): ReviewFormData {
    return reviewEditorExports.getFormData();
  }

  /**
   * Reset the editor to its initial state.
   * Reverts content to original and clears all threads.
   */
  export function reset(): void {
    // Revert content
    value = original;
    onValueChange?.(original);

    // Clear all threads
    for (const thread of threads) {
      onThreadDelete?.({ threadId: thread.id });
    }

    // Clear UI state
    popoverThreadId = null;
    popoverPosition = null;
    activeThreadId = null;
    activeView = 'editor';
    selectionPopoverPosition = null;
    capturedSelectionForPopover = null;
    selectionPopoverExpanded = false;

    announce('Review reset');
  }

  // =========================================================================
  // Selection Popover Handlers
  // =========================================================================

  /**
   * Handle the comment submission from the selection popover.
   * Creates a new thread at the captured selection using currentUserId as author.
   *
   * We use capturedSelectionForPopover instead of currentSelection because
   * clicking the popover button collapses the browser selection before this runs.
   *
   * @param body - The comment body from the selection popover form
   */
  function handleSelectionComment(body: string): void {
    // Helper to clear popover state and announce failure
    function failWithMessage(message: string): void {
      devWarn(message);
      selectionPopoverPosition = null;
      capturedSelectionForPopover = null;
      selectionPopoverExpanded = false;
      announce('Could not add comment. Please try selecting text again.', 'assertive');
    }

    if (!currentUserId) {
      failWithMessage('Cannot create comment: no currentUserId set');
      return;
    }

    // Use captured selection - clicking the popover collapses browser selection
    if (!capturedSelectionForPopover) {
      failWithMessage('Cannot create comment: no captured selection');
      return;
    }

    if (mode === 'readonly') {
      failWithMessage('Cannot create thread: editor is readonly');
      return;
    }

    const view = editorRef?.getView();
    if (!view) {
      failWithMessage('Cannot create thread: editor view not available');
      return;
    }

    const { from, to } = capturedSelectionForPopover;

    // Validate positions are still within document bounds
    // User may have edited the document while popover was expanded
    const docSize = view.state.doc.content.size;
    if (from < 0 || to > docSize || from > to) {
      failWithMessage('Cannot create thread: captured selection is out of bounds');
      return;
    }

    // Build anchor using shared helper
    const anchor = bodyAnchorToDocumentAnchor(
      buildAnchorFromSelection(view, from, to),
      currentDocument.bodyOffset,
      value,
    );

    // Generate requestId for correlating optimistic updates
    const requestId = generateId();

    // Extract @mentions from the comment body
    const mentions = extractMentions(body);

    // Fire the create event with the comment body
    const event: ThreadCreateEvent = {
      requestId,
      anchor,
      body,
      authorId: currentUserId,
      mentions: mentions.length > 0 ? mentions : undefined,
    };
    onThreadCreate?.(event);

    // Clear state. Remember the range so the selection ProseMirror restores on
    // refocus does not re-open the popover over the text just commented on.
    consumedSelection = { from, to };
    consumedSelectionReleaseArm = null;
    capturedSelectionForPopover = null;
    selectionPopoverPosition = null;
    selectionPopoverExpanded = false;

    announce('Comment added');
  }

  /**
   * Handle the selection popover expanding to show the comment form.
   * This keeps the popover visible even when the browser selection collapses.
   */
  function handleSelectionPopoverExpand(): void {
    selectionPopoverExpanded = true;
  }

  /**
   * Handle the selection popover cancel action.
   * Resets expanded state so new selections can be processed.
   */
  function handleSelectionPopoverCancel(): void {
    selectionPopoverExpanded = false;
    // Keep position and captured selection so user can re-expand if they want
  }

  /**
   * Close the selection popover.
   */
  function handleSelectionPopoverClose(): void {
    if (selectionTimeoutId !== null) {
      clearTimeout(selectionTimeoutId);
      selectionTimeoutId = null;
    }
    const view = editorRef?.getView();
    consumedSelection = view
      ? { from: view.state.selection.from, to: view.state.selection.to }
      : null;
    consumedSelectionReleaseArm = pointerGesturePending ? 'pointer' : null;
    pointerGesturePending = false;
    selectionPopoverPosition = null;
    capturedSelectionForPopover = null;
    selectionPopoverExpanded = false;
  }

  // =========================================================================
  // Thread Operations
  // =========================================================================

  /**
   * Create a new thread at the current selection.
   * Requires non-collapsed selection in edit or comment mode.
   *
   * Returns requestId for correlating with backend response, or null if creation failed.
   *
   * No-op (returns null) if:
   * - No text is selected (collapsed selection)
   * - Editor is in readonly mode
   * - Editor view is not available
   */
  export function createThread(body: string, authorId: string): string | null {
    if (!currentSelection || currentSelection.isCollapsed) {
      devWarn('Cannot create thread: no text selected');
      return null;
    }

    if (mode === 'readonly') {
      devWarn('Cannot create thread: editor is readonly');
      return null;
    }

    const view = editorRef?.getView();
    if (!view) {
      devWarn('Cannot create thread: editor view not available');
      return null;
    }

    const { from, to } = currentSelection;

    // Build anchor using shared helper
    const anchor = bodyAnchorToDocumentAnchor(
      buildAnchorFromSelection(view, from, to),
      currentDocument.bodyOffset,
      value,
    );

    // Extract mentions from comment body
    const mentions = extractMentions(body);

    // Generate requestId for correlating optimistic updates
    const requestId = generateId();

    // Fire the create event (parent handles actual thread creation)
    const event: ThreadCreateEvent = {
      requestId,
      anchor,
      body,
      authorId,
      mentions: mentions.length > 0 ? mentions : undefined,
    };
    onThreadCreate?.(event);

    announce('Comment added');
    return requestId;
  }

  /**
   * Create a document-level comment thread.
   *
   * Document-level comments are not anchored to specific text but apply to
   * the entire document. They appear at the top of the comment sidebar.
   *
   * Returns requestId for correlating with backend response, or null if creation failed.
   */
  export function createDocumentThread(body: string, authorId: string): string | null {
    if (mode === 'readonly') {
      devWarn('Cannot create thread: editor is readonly');
      return null;
    }

    // Create document-level anchor
    const anchor = createDocumentAnchor();

    // Extract mentions from comment body
    const mentions = extractMentions(body);

    // Generate requestId for correlating optimistic updates
    const requestId = generateId();

    // Fire the create event (parent handles actual thread creation)
    const event: ThreadCreateEvent = {
      requestId,
      anchor,
      body,
      authorId,
      mentions: mentions.length > 0 ? mentions : undefined,
    };
    onThreadCreate?.(event);

    announce('Document comment added');
    return requestId;
  }

  /**
   * Delete a thread.
   *
   * Silently returns without emitting an event if:
   * - Editor is in readonly mode (mode === 'readonly')
   * - Thread does not exist
   *
   * This silent no-op behavior supports declarative UI patterns where callers
   * don't need to pre-check conditions before calling mutation methods.
   */
  export function deleteThread(threadId: string): void {
    if (mode === 'readonly') return;

    const thread = threads.find((t) => t.id === threadId);
    if (!thread) return;

    onThreadDelete?.({ threadId });
  }

  /**
   * Delete all threads (clear all comments).
   *
   * Silently does nothing if:
   * - Editor is in readonly mode (mode === 'readonly')
   * - No threads exist
   *
   * Fires onThreadDelete for each thread.
   */
  export function clearAllThreads(): void {
    if (mode === 'readonly') return;
    if (threads.length === 0) return;

    // Fire delete event for each thread
    for (const thread of threads) {
      onThreadDelete?.({ threadId: thread.id });
    }

    // Clear any active selection state
    popoverThreadId = null;
    popoverPosition = null;
    activeThreadId = null;

    announce('All comments cleared');
  }

  // =========================================================================
  // Comment Operations
  // =========================================================================

  /**
   * Create a new comment in an existing thread.
   *
   * @returns requestId for correlating with backend response, or null if creation was blocked
   *
   * Silently returns null without emitting an event if:
   * - Editor is in readonly mode (mode === 'readonly')
   * - Thread does not exist
   *
   * This silent no-op behavior supports declarative UI patterns where callers
   * don't need to pre-check conditions before calling mutation methods.
   */
  export function createComment(threadId: string, body: string, authorId: string): string | null {
    if (mode === 'readonly') return null;

    const thread = threads.find((t) => t.id === threadId);
    if (!thread) return null;

    const mentions = extractMentions(body);
    const requestId = generateId();

    onCommentCreate?.({
      requestId,
      threadId,
      body,
      authorId,
      mentions: mentions.length > 0 ? mentions : undefined,
    });

    announce('Comment added');
    return requestId;
  }

  /**
   * Update an existing comment.
   *
   * Silently returns without emitting an event if:
   * - Editor is in readonly mode (mode === 'readonly')
   * - Thread or comment does not exist
   * - Comment is soft-deleted
   *
   * This silent no-op behavior supports declarative UI patterns where callers
   * don't need to pre-check conditions before calling mutation methods.
   */
  export function updateComment(threadId: string, commentId: string, body: string): void {
    if (mode === 'readonly') return;

    const thread = threads.find((t) => t.id === threadId);
    const comment = thread?.comments.find((c) => c.id === commentId);
    if (!comment || comment.deletedAt) return;

    const mentions = extractMentions(body);

    onCommentUpdate?.({
      threadId,
      commentId,
      body,
      mentions: mentions.length > 0 ? mentions : undefined,
    });
  }

  /**
   * Delete a comment.
   *
   * Silently returns without emitting an event if:
   * - Editor is in readonly mode (mode === 'readonly')
   * - Thread or comment does not exist
   * - Soft delete is requested but comment is already soft-deleted
   *
   * This silent no-op behavior supports declarative UI patterns where callers
   * don't need to pre-check conditions before calling mutation methods.
   *
   * @param soft - If true (default), sets deletedAt for soft delete. If false, requests hard delete.
   */
  export function deleteComment(threadId: string, commentId: string, soft: boolean = true): void {
    if (mode === 'readonly') return;

    const thread = threads.find((t) => t.id === threadId);
    const comment = thread?.comments.find((c) => c.id === commentId);
    if (!comment || (soft && comment.deletedAt)) return;

    onCommentDelete?.({ threadId, commentId, soft });
    announce('Comment deleted');
  }

  // =========================================================================
  // Block-Level Thread Creation
  // =========================================================================

  /**
   * Create a thread anchored to the block containing the cursor.
   * Works even with a collapsed selection (no text selected).
   *
   * Returns requestId for correlating with backend response, or null if creation failed.
   *
   * No-op (returns null) if:
   * - Editor is in readonly mode
   * - Editor view is not available
   * - Cursor is not inside a block
   */
  export function createBlockThread(body: string, authorId: string): string | null {
    if (mode === 'readonly') {
      devWarn('Cannot create block thread: editor is readonly');
      return null;
    }

    const view = editorRef?.getView();
    if (!view) {
      devWarn('Cannot create block thread: editor view not available');
      return null;
    }

    const { from } = view.state.selection;
    const resolvedPos = view.state.doc.resolve(from);

    // Find the nearest block-level node
    for (let depth = resolvedPos.depth; depth > 0; depth--) {
      const node = resolvedPos.node(depth);
      if (!node.isBlock) continue;

      // Get the block's inner positions (content bounds)
      const blockFrom = resolvedPos.start(depth);
      const blockTo = resolvedPos.end(depth);

      // Build anchor for the entire block
      const anchor = bodyAnchorToDocumentAnchor(
        buildAnchorFromSelection(view, blockFrom, blockTo),
        currentDocument.bodyOffset,
        value,
      );

      // Extract mentions and generate requestId
      const mentions = extractMentions(body);
      const requestId = generateId();

      // Fire the create event
      onThreadCreate?.({
        requestId,
        anchor,
        body,
        authorId,
        mentions: mentions.length > 0 ? mentions : undefined,
      });

      return requestId;
    }

    devWarn('Cannot create block thread: cursor not inside a block');
    return null;
  }

  // =========================================================================
  // Keyboard Navigation (F6 Landmark Navigation)
  // =========================================================================

  /**
   * Focus regions for F6 navigation.
   * The 'popover' region is conditionally included when a thread popover is open.
   */
  const focusRegions: FocusRegion[] = [
    { id: 'editor', selector: '.review-editor-main', label: 'Editor' },
    { id: 'popover', selector: '.thread-popover', label: 'Thread' },
  ];

  /**
   * Focus region navigator with conditional popover inclusion and custom editor focus.
   */
  const focusNavigator = createFocusRegionNavigator(focusRegions, {
    // Only include popover region when a thread popover is actually open
    isRegionActive: (region) => {
      if (region.id === 'popover') {
        return popoverThread !== null;
      }
      return true;
    },
    // Custom focus handler for the editor region (ProseMirror needs special handling)
    customFocusHandler: (region) => {
      if (region.id === 'editor') {
        editorRef?.getView()?.focus();
        return true; // Handled
      }
      return false; // Use default behavior
    },
  });

  /**
   * cinder#1304: `.comment-anchor` decorations are deliberately not
   * tabindex-focusable (see anchor-decorations.ts), so this chord is the
   * keyboard route the issue asks for instead.
   *
   * Platform-aware rather than a literal Ctrl-Alt, unlike this component's
   * own Ctrl-Alt-C (add comment, keymap-plugin.ts): Control+Option is
   * macOS VoiceOver's own modifier prefix, so a literal Ctrl-Alt-Arrow chord
   * is consumed by VoiceOver before it ever reaches this handler on a Mac —
   * the one platform where an AT-only keyboard route matters most. Same
   * mac-detection `getShortcutDisplay` already uses (keymap-plugin.ts).
   */
  function isCommentNavigationChord(event: KeyboardEvent): boolean {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return false;
    const isMacPlatform =
      typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    return isMacPlatform ? event.metaKey && event.altKey : event.ctrlKey && event.altKey;
  }

  /**
   * Handle F6 keyboard navigation between regions, and cinder#1304's
   * comment-navigation chord (see isCommentNavigationChord above).
   * Uses event.currentTarget to scope navigation to this specific editor instance,
   * supporting multiple ReviewEditor instances on the same page.
   */
  function handleContainerKeyDown(event: KeyboardEvent): void {
    if (event.key === 'F6') {
      // Use currentTarget (the element with the listener) to get this specific editor container
      const container = event.currentTarget;
      if (!(container instanceof HTMLElement)) return;

      event.preventDefault();
      const current = focusNavigator.getCurrentRegion(container);
      const next = focusNavigator.getNextRegion(current, event.shiftKey);
      focusNavigator.focusRegion(container, next);
      return;
    }

    if (isCommentNavigationChord(event)) {
      // Scoped to the ProseMirror surface itself, not the whole container:
      // the container also holds the comment composer, thread popovers,
      // front-matter fields, sidebar, and toolbar. Without this guard, the
      // chord fired from inside any of those too — e.g. typing a reply in
      // an open thread's composer — hijacking focus into the editor and
      // changing the active thread mid-reply.
      //
      // A review finding caught that `editorDom.contains(event.target)`
      // alone excludes a real ancestor: in readonly mode `setEditorReadonly`
      // (editor.ts) sets `contenteditable="false"` on `editorDom`, which
      // removes its native tab-stop (ProseMirror never sets an explicit
      // `tabindex` on it — that implicit stop is the ONLY thing
      // `contenteditable="true"` was providing). `MarkdownEditor`'s own
      // `.markdown-editor.surface` wrapper — the element `editorDom` is
      // mounted inside via the `{@attach}` directive, i.e. its parent, not
      // its child — keeps `tabindex="0"` unconditionally. So a real Tab
      // press in readonly mode lands there instead, `event.target` is that
      // wrapper, and `editorDom.contains(wrapper)` is false (`contains`
      // only looks at descendants), silently defeating this entire chord
      // for exactly the review-only consumers most likely to want it.
      // `target.contains(editorDom)` catches that ancestor case; it's safe
      // to add unconditionally because the only focusable ancestor of
      // `editorDom` is this one wrapper (the container itself carries no
      // tabindex — see the comment on the container element below), and
      // the sidebar/toolbar/composers this guard exists to exclude are
      // never ancestors of `editorDom` either way, so they still fail both
      // checks.
      const editorDom = editorRef?.getView()?.dom;
      const target = event.target;
      if (
        !editorDom ||
        !(target instanceof Node) ||
        !(editorDom.contains(target) || target.contains(editorDom))
      ) {
        return;
      }
      event.preventDefault();
      navigateToAdjacentComment(event.key === 'ArrowDown' ? 1 : -1);
    }
  }
</script>

<!--
  Formatting controls, hosted inside the unified bar. Only rendered in the
  editor view (the diff and summary views have no text formatting to offer) and
  only once the inner editor has published a context.
-->
{#snippet formattingSnippet()}
  {#if editorToolbarContext}
    <EditorToolbar
      id="{id}-toolbar"
      editorId={id}
      editorContext={editorToolbarContext.editorContext}
      activeMarks={editorToolbarContext.activeMarks}
      activeBlockType={editorToolbarContext.activeBlockType}
      canUndo={editorToolbarContext.canUndo}
      canRedo={editorToolbarContext.canRedo}
      linkPopoverOpen={editorToolbarContext.linkPopoverOpen}
      disabled={!editorToolbarContext.editorContext}
      onLinkClick={editorToolbarContext.onLinkClick}
      onUndo={editorToolbarContext.onUndo}
      onRedo={editorToolbarContext.onRedo}
    />
  {/if}
{/snippet}

<!-- Export actions snippet for passing to controls -->
{#snippet exportActionsSnippet()}
  <ExportActions
    id="{id}-export"
    onexportcontent={handleExportContent}
    onexportsummary={handleExportSummary}
    onexportjson={handleExportJSON}
    onexportdiff={handleExportDiff}
    onexportcomments={handleExportComments}
  />
{/snippet}

<!--
  The a11y_no_static_element_interactions ignore is intentional:
  F6 landmark navigation requires a container-level keydown listener to cycle
  focus between editor/popover regions. The container itself is not
  interactive; it only captures keyboard events for region-level focus management.
-->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={containerElement}
  data-testid="review-editor"
  class={classNames('review-editor-container', className)}
  data-mode={mode}
  data-view={activeView}
  data-ready={editorViewReady && !anchorManager.pendingState ? true : undefined}
  data-snapshot-mode={snapshotMode || undefined}
  onkeydown={handleContainerKeyDown}
>
  <!-- Screen reader announcements (DEP-47) -->
  <LiveRegion bind:this={liveRegionRef} />

  <!-- Diff review integration error (COR-512 / DR-7): a condition of the supplied
       `diffReviewState` prop, not of which tab is open -- visible regardless of `activeView`
       so an invalid update is never hidden behind a tab the person hasn't opened. Document
       editing is never affected: nothing here touches `value`/`original`/`threads`. -->
  {#if diffReviewIntegrationError}
    <Callout
      semantic="note"
      variant="danger"
      title="Diff review data couldn't be applied"
      class="review-editor-diff-review-error"
    >
      <p>
        {diffReviewIntegrationError.message} ({diffReviewIntegrationError.code} at
        {diffReviewIntegrationError.path || '/'}). Showing the last valid diff review state;
        document editing is unaffected.
      </p>
    </Callout>
  {/if}

  <!-- Unsaved diff-review drafts inventory (COR-512 / DR-7): "persistent" per the contract, so
       it renders regardless of `activeView`, not only while the diff tab happens to be open --
       otherwise a draft cancelled from the composer (which never deletes nonempty text) would be
       invisible again the moment the person left the diff tab, with `drafts-pending` silently
       blocking every export scope and no visible way back to it. `handleDiffDraftOpen` switches
       to the diff tab itself when the person chooses "Open". Excludes `activeDiffDraftId`: that
       one already has its own dedicated composer panel open (immediately, on `create-draft`,
       before any text is typed) -- listing it here too would duplicate it under a second,
       ambiguous "Save" control for the exact same draft. -->
  {#if effectiveDiffReviewState}
    {@const hiddenDrafts = effectiveDiffReviewState.drafts.filter(
      (draft) => draft.draftId !== activeDiffDraftId,
    )}
    <DiffReviewDraftsInventory
      drafts={hiddenDrafts}
      readonly={isReadonly}
      onopen={handleDiffDraftOpen}
      onsave={handleDiffDraftSave}
      ondiscard={handleDiffDraftDiscard}
    />
  {/if}

  <!-- Hidden form inputs for FormData participation -->
  {#if name}
    <input
      type="hidden"
      name={reviewEditorExports.getFieldName('original')}
      value={formData.original}
    />
    <input
      type="hidden"
      name={reviewEditorExports.getFieldName('current')}
      value={formData.current}
    />
    <input
      type="hidden"
      name={reviewEditorExports.getFieldName('comments')}
      value={formData.comments}
    />
    <input type="hidden" name={reviewEditorExports.getFieldName('diff')} value={formData.diff} />
    <input
      type="hidden"
      name={reviewEditorExports.getFieldName('summary')}
      value={formData.summary}
    />
  {/if}

  <!-- Unified controls bar - consistent across all views -->
  <ReviewEditorControls
    id="{id}-controls"
    {activeView}
    {viewPanelIds}
    onViewChange={(view) => {
      // Clear selection popover state when leaving editor view
      // Otherwise stale expanded state blocks new selections when returning
      if (view !== 'editor') {
        selectionPopoverPosition = null;
        capturedSelectionForPopover = null;
        selectionPopoverExpanded = false;

        // Close the thread popover too (cinder#1305 review follow-up): its
        // anchor only exists in the editor view, and leaving it destroys
        // editorRef (the same unbind #1301 relies on), which turns F6's
        // `customFocusHandler` for the 'editor' region into a no-op
        // (`editorRef?.getView()?.focus()` on a null ref) that still returns
        // `true` — suppressing the navigator's fallback and stranding focus
        // inside a popover pointing at content that is no longer rendered.
        // Closing here, alongside the selection popover this branch already
        // clears for the same "left the editor view" reason, means F6 never
        // gets the chance to strand: there is nothing left to navigate away
        // from.
        if (popoverThreadId !== null) {
          handlePopoverClose();

          // Second review-round finding: closing the popover here unmounts
          // it, and its OWN focus trap unconditionally restores focus on
          // deactivate — to whatever had focus when the popover opened, or
          // its restoreFallback (the sidebar toggle) — even when THIS SAME
          // interaction already moved focus to the newly active tab a
          // moment earlier in the same call stack. Concretely, for the
          // arrow-key roving-tabindex path: `SegmentedControlController`
          // calls `toggle()` (reaching this callback, synchronously) and
          // THEN focuses the destination tab — so the trap's restore, which
          // runs when this state change flushes, lands AFTER that focus
          // move and steals it. There is no reactive hook into the trap's
          // own restore decision from here (it is not exposed as
          // reactive), so this corrects it afterward instead: `tick()`
          // resolves once the pending state changes above — including the
          // trap's synchronous `deactivate()` — have been applied, and only
          // then is it safe to re-assert focus on the tab that is actually
          // selected now.
          tick().then(() => {
            if (activeView !== view || !containerElement) return;
            const activeTab = containerElement.querySelector<HTMLElement>(
              '.review-editor-controls [role="tab"][aria-selected="true"]',
            );
            activeTab?.focus();
          });
        }
      }
      activeView = view;
      announce(`Switched to ${view} view`);
    }}
    showDiffTabs={!!original}
    {diffStats}
    bind:diffViewMode
    {hasContentChanges}
    readonly={isReadonly}
    onRevertAll={() => {
      value = original;
      onValueChange?.(original);
      announce('All changes reverted');
    }}
    {commentCount}
    sidebarId="{id}-sidebar"
    {sidebarOpen}
    onSidebarToggle={() => (sidebarOpen = !sidebarOpen)}
    formatting={activeView === 'editor' && !isReadonly ? formattingSnippet : undefined}
    trailing={exportActionsSnippet}
  />

  <!-- Main content area -->
  <div class="review-editor-main">
    {#if activeView === 'editor'}
      <!-- Editor view: formatting toolbar + editor content -->
      <div
        id={viewPanelIds.editor}
        class="review-editor-view-panel"
        role="tabpanel"
        aria-label="Editor view"
      >
        {#if hasMalformedFrontMatter && !malformedFrontMatterDismissed}
          <Callout
            semantic="note"
            variant="warning"
            title="Front matter warning"
            class="review-editor-front-matter-warning"
          >
            <p>{frontMatterParseWarning}</p>
            <div class="review-editor-front-matter-warning__actions">
              <Button onclick={focusMalformedFrontMatterSource}>Edit as plain text</Button>
              <Button variant="ghost" onclick={() => (malformedFrontMatterDismissed = true)}>
                Dismiss front matter warning
              </Button>
            </div>
          </Callout>
        {/if}
        {#if currentDocument.hasFrontMatter}
          <FrontMatterFields
            id={`${id}-front-matter`}
            data={currentDocument.data}
            raw={currentDocument.raw}
            readonly={isReadonly}
            onchange={handleFrontMatterChange}
          />
        {/if}
        {#if hasMalformedFrontMatter}
          <MarkdownEditor
            {id}
            bind:this={editorRef}
            {value}
            mode="source"
            readonly={isReadonly}
            {placeholder}
            {snapshotMode}
            toolbarEnabled={false}
            onValueChange={handleChange}
            onReady={() => {
              if (!editorViewReady) {
                editorViewReady = true;
              }
            }}
          />
        {:else}
          <MarkdownEditor
            {id}
            bind:this={editorRef}
            value={editorValue}
            mode="wysiwyg"
            readonly={isReadonly}
            {placeholder}
            plugins={[anchorPlugin]}
            {snapshotMode}
            toolbarEnabled={false}
            onToolbarContextChange={(context) => (editorToolbarContext = context)}
            onValueChange={handleEditorBodyChange}
            onReady={() => {
              if (!editorViewReady) {
                editorViewReady = true;
              }
            }}
            onSelectionChange={handleSelectionChange}
          />
        {/if}
      </div>
    {:else if activeView === 'diff'}
      <!-- Diff view content -->
      <div
        id={viewPanelIds.diff}
        class="review-editor-view-panel"
        role="tabpanel"
        aria-label="Diff view"
      >
        <DiffViewer
          {original}
          current={value}
          bind:viewMode={diffViewMode}
          readonly={isReadonly}
          bind:ref={diffViewerRef}
          {...diffReviewEnabled && effectiveDiffReviewState && !isReadonly
            ? {
                annotationSelection: diffReviewAnnotationSelection,
                onAnnotationSelectionChange: handleDiffAnnotationSelectionChange,
              }
            : {}}
        >
          {#snippet toolbar()}
            <!-- Empty toolbar - controls are in the unified bar above -->
          {/snippet}
        </DiffViewer>
        {#if activeDiffDraft}
          <div
            class="review-editor-diff-composer"
            role="group"
            aria-label={`New diff comment on ${formatDiffReviewCommentLocation(activeDiffDraft)}`}
          >
            <p class="review-editor-diff-composer-location">
              {formatDiffReviewCommentLocation(activeDiffDraft)}
            </p>
            {#if isReadonly}
              <!-- Reaching a nonempty draft's composer while read-only is now possible through
                   the drafts inventory's "Open" action (COR-512 / DR-7 follow-up), which the
                   shared `DiffReviewDraftsInventory` leaf always shows regardless of `readonly`
                   (only its own Save/Discard are hidden). Before this, `activeDiffDraftId` could
                   only be set from `onAnnotationSelectionChange`, which is never wired when
                   read-only -- so this branch was previously unreachable there. A disabled Save
                   plus visible explanatory text, per contract ("Use native disabled buttons/
                   inputs with nearby visible explanatory text"). The textarea itself uses native
                   `readonly`, not `disabled` (COR-511 review): a `disabled` textarea can never
                   receive focus in a real browser, which would silently break "Open ... focuses
                   its composer" -- stated with no read-only exception -- for exactly this case.
                   `readonly` blocks editing identically while keeping the element focusable and
                   its text selectable/copyable. -->
              <p class="review-editor-diff-composer-readonly-note">
                Enable editing to change or save this draft.
              </p>
            {/if}
            <textarea
              aria-label="Diff comment"
              value={activeDiffDraft.body}
              readonly={isReadonly}
              bind:this={diffComposerTextareaElement}
              oninput={(event) => updateDiffComposerBody(event.currentTarget.value)}></textarea>
            <div class="review-editor-diff-composer-actions">
              <Button
                onclick={saveDiffComposer}
                disabled={isReadonly || activeDiffDraft.body.trim().length === 0}
              >
                Save
              </Button>
              <Button variant="ghost" onclick={closeDiffComposer}
                >{isReadonly ? 'Close' : 'Cancel'}</Button
              >
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <!-- Summary view (auto-generated, readonly preview) -->
      <div
        id={viewPanelIds.summary}
        class="review-editor-view-panel"
        role="tabpanel"
        aria-label="Summary view"
      >
        {#if hasContentChanges || threads.length > 0}
          <MarkdownEditor
            id="{id}-summary"
            value={summaryContent}
            mode="wysiwyg"
            readonly
            toolbarEnabled={false}
            placeholder=""
          />
        {:else}
          <div class="summary-view" role="region" aria-label="Review summary">
            <div class="summary-empty">
              <p>No changes or comments to summarize.</p>
              <p class="summary-hint">Edit the document or add comments to generate a summary.</p>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Comment sidebar -->
  {#if sidebarOpen}
    <CommentSidebar
      id="{id}-sidebar"
      {threads}
      {activeThreadId}
      readonly={isReadonly}
      onthreadselect={handleSidebarThreadSelect}
      onThreadDelete={deleteThread}
      onclearall={clearAllThreads}
      onadddocumentcomment={handleAddDocumentComment}
      diffReviewState={effectiveDiffReviewState}
      onDiffCommentNavigate={navigateToDiffComment}
      onDiffCommentAction={handleDiffCommentAction}
    />
  {/if}

  <!-- Thread popover -->
  {#if popoverThread && popoverPosition}
    <ThreadPopover
      id="{id}-thread-popover"
      thread={popoverThread}
      {currentUserId}
      {mode}
      position={popoverPosition}
      restoreFallbackId={`${id}-sidebar-toggle`}
      ignoreClickOutsideRefs={[activeSidebarRowElement, ...sidebarRemoveControlRefs]}
      onclose={handlePopoverClose}
      ondelete={handlePopoverDelete}
      onCommentCreate={handlePopoverCommentCreate}
      onCommentUpdate={handlePopoverCommentUpdate}
      onCommentDelete={handlePopoverCommentDelete}
    />
  {/if}

  <!-- Selection popover for quick comment creation -->
  {#if selectionPopoverMounted}
    <SelectionPopover
      id="{id}-selection-popover"
      position={selectionPopoverPosition}
      open={showSelectionPopover}
      onCommentSubmit={handleSelectionComment}
      onExpand={handleSelectionPopoverExpand}
      onCancel={handleSelectionPopoverCancel}
      onClose={handleSelectionPopoverClose}
      onExitComplete={() => {
        selectionPopoverMounted = false;
      }}
    />
  {/if}
</div>

<style>
  /*
   * Reset outer border/radius/overflow on the markdown-editor-wrapper when
   * nested inside review-editor-main (.review-editor-main provides the outer shape).
   *
   * :global() is required because .markdown-editor-wrapper is rendered by
   * MarkdownEditor (a child component) and would not match a scoped selector.
   */
  :global(.review-editor-container .review-editor-main .markdown-editor-wrapper) {
    border: none;
    border-radius: 0;
    overflow: visible;
  }

  .review-editor-view-panel {
    min-width: 0;
  }

  .review-editor-diff-composer {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-2, 0.5rem);
    padding: var(--cinder-space-3, 0.75rem);
    margin-block-start: var(--cinder-space-2, 0.5rem);
    border: 1px solid var(--cinder-border, #ccc);
    border-radius: var(--cinder-radius-md, 6px);
  }

  .review-editor-diff-composer-location {
    margin: 0;
    font-size: var(--cinder-text-xs, 0.75rem);
    color: var(--cinder-text-muted, #666);
  }

  .review-editor-diff-composer-actions {
    display: flex;
    gap: var(--cinder-space-2, 0.5rem);
  }

  .review-editor-diff-composer-readonly-note {
    margin: 0;
    font-size: var(--cinder-text-xs, 0.75rem);
    color: var(--cinder-text-muted, #666);
  }

  /*
   * Snapshot mode: suppress the blinking caret and text selection highlights
   * so visual regression screenshots are pixel-stable across runs.
   * Scoped to [data-snapshot-mode] so normal editing is completely unaffected.
   */
  /*
   * `:global(*)` and a transparent `::selection`, and both halves are load-bearing.
   *
   * Svelte scopes a bare `*` to `:where(.svelte-…)`, so the descendant half only
   * ever reached elements this component rendered — never `.milkdown` /
   * `.ProseMirror`, which Milkdown creates at runtime with no scope class. That
   * was true in every engine; Chromium merely LOOKED correct because Blink
   * inherits `user-select`, which css-ui-4 defines as non-inherited and Gecko
   * implements as such. Firefox reporting `auto` there is the spec-correct value
   * and is what surfaced this.
   *
   * `user-select` alone would still not deliver the promise: a real drag inside a
   * snapshot-mode editor selected and repainted in BOTH Chromium and Firefox even
   * where the property computed to `none`, because ProseMirror's contenteditable
   * stays selectable regardless. Painting the selection transparent is what
   * actually makes the surface pixel-stable, which is what the prop documents.
   */
  .review-editor-container[data-snapshot-mode],
  .review-editor-container[data-snapshot-mode] :global(*) {
    caret-color: transparent;
    user-select: none;
  }

  .review-editor-container[data-snapshot-mode] :global(::selection) {
    background: transparent;
    color: inherit;
  }
</style>
