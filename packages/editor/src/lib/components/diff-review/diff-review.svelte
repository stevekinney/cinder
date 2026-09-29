<script lang="ts" module>
  /**
   * @cinder
   * @category domain
   * @status domain-suite
   * @purpose Aggregate single- and multi-target diff review: file list, comment controls, drafts inventory, and Markdown/JSON export -- composed entirely from the public DiffViewer/SourceDiffViewer annotation hooks and diff-review-state.
   * @tag diff-review
   * @useWhen Reviewing one or many mixed Markdown/source-patch targets and collecting comments for an agent handoff.
   * @avoidWhen Rendering a single diff with no comment/export workflow -- use DiffViewer or SourceDiffViewer directly.
   * @related diff-review-comments, diff-viewer, review-editor
   */
  export type { DiffReviewProps } from './diff-review.types.ts';
</script>

<script lang="ts">
  import { untrack } from 'svelte';

  import type {
    DiffReviewAnchor,
    DiffReviewComment,
    DiffReviewDraft,
    DiffReviewTargetInput,
  } from '../../diff-review-state/index.ts';
  import {
    reduceDiffReviewState,
    validateDiffReviewTargetList,
  } from '../../diff-review-state/index.ts';
  import { exportDiffReviewJson, exportDiffReviewMarkdown } from '../../export/index.ts';
  import { dispatchDiffReviewAction } from '../../utilities/diff-review-dispatch.ts';
  import { formatDiffReviewCommentLocation } from '../diff-review-comments/diff-review-comment-location.ts';
  import DiffReviewComments from '../diff-review-comments/diff-review-comments.svelte';
  import type { DiffReviewAnnotationBridgeResult } from './diff-review-annotation-bridge.ts';
  import DiffReviewDraftsInventory from './diff-review-drafts-inventory.svelte';
  import { getDiffReviewExportGate } from './diff-review-export-gate.ts';
  import { buildDiffReviewFileEntries } from './diff-review-file-entries.ts';
  import { filterDiffReviewFileEntries } from './diff-review-file-filter.ts';
  import DiffReviewFileList from './diff-review-file-list.svelte';
  import DiffReviewRenderer from './diff-review-renderer.svelte';
  import type { DiffReviewRendererRef } from './diff-review-renderer.types.ts';
  import DiffReviewToolbar from './diff-review-toolbar.svelte';
  import type { DiffReviewExportScope } from './diff-review-toolbar.svelte';
  import type { DiffReviewProps } from './diff-review.types.ts';

  let {
    targets,
    state: reviewState,
    onStateChange,
    readonly = false,
    reviewTitle = 'Review feedback',
    class: className,
    ...rest
  }: DiffReviewProps = $props();

  let filterQuery = $state('');
  /**
   * The draft currently shown in the composer panel, if any. The composer
   * never holds its own text buffer -- every keystroke is a real
   * `update-draft` dispatch, so a partially written comment survives target
   * switching, filtering, mode changes, collapse, and remount exactly like
   * any other draft (contract: "must not discard a partially written
   * comment").
   */
  let activeDraftId = $state<string | null>(null);
  let resetToken = $state(0);
  let draftsOpen = $state(false);
  /** Set by `openDraft`; the effect below focuses the composer once it is in the DOM. */
  let composerFocusRequested = $state(false);
  let composerTextareaElement = $state<HTMLTextAreaElement | undefined>(undefined);
  let rendererRef = $state<DiffReviewRendererRef | undefined>(undefined);
  let rendererFailed = $state(false);
  /** Non-null while a comment-navigation focus attempt found no target to focus. */
  let navigationUnavailable = $state(false);
  /**
   * Set by `navigateToComment` when the target/file switch it dispatched has
   * not yet reached this component's own `state` prop (the host must accept
   * `onStateChange` and pass the new state back down first). The effect
   * below completes the focus once `reviewState` reflects that switch.
   */
  let pendingFocus = $state<{
    targetId: string;
    fileOccurrence: number;
    anchor: DiffReviewAnchor;
  } | null>(null);

  /**
   * `targets` is host-supplied live content, not validated by any reducer
   * action -- an invalid update (COR-509 / DR-6, "invalid-target") must
   * report a structured error without discarding the last good render.
   */
  const targetsValidation = $derived(validateDiffReviewTargetList(targets));
  // An initial `targets` prop that is itself invalid has no prior good
  // render to fall back to -- start from an empty list rather than the
  // unvalidated value, or every derived computation below would still see
  // the same malformed data this fallback exists to shield them from.
  let lastValidTargets = $state<DiffReviewTargetInput[]>(
    untrack(() => (targetsValidation.ok ? targetsValidation.value : [])),
  );
  $effect(() => {
    if (targetsValidation.ok) lastValidTargets = targetsValidation.value;
  });
  const effectiveTargets = $derived(
    targetsValidation.ok ? targetsValidation.value : lastValidTargets,
  );

  const fileEntries = $derived(buildDiffReviewFileEntries(effectiveTargets, reviewState));
  const visibleFileEntries = $derived(filterDiffReviewFileEntries(fileEntries, filterQuery));
  const selectedTarget = $derived(
    effectiveTargets.find((t) => t.targetId === reviewState.selectedTargetId),
  );
  const exportGate = $derived(getDiffReviewExportGate(reviewState));
  const activeDraft = $derived(
    reviewState.drafts.find((draft) => draft.draftId === activeDraftId) ?? null,
  );

  /**
   * Selecting a file may require two sequential transitions (switch target,
   * then switch file). Each call to `reduceDiffReviewState` only sees the
   * state it is handed -- chaining two `dispatchDiffReviewAction` calls
   * against the same stale `reviewState` would compute the second transition
   * from pre-first-transition state and silently drop it. Reducing locally
   * and dispatching only the final result keeps this atomic from the host's
   * perspective (exactly one `onStateChange` call, with the fully-applied
   * state).
   */
  function selectFile(targetId: string, fileOccurrence: number): void {
    let current = reviewState;
    if (targetId !== current.selectedTargetId) {
      const result = reduceDiffReviewState(current, { type: 'select-target', targetId });
      if (!result.ok) return;
      current = result.value;
    }
    dispatchDiffReviewAction(current, { type: 'select-file', fileOccurrence }, onStateChange);
  }

  function setReviewed(targetId: string, fileOccurrence: number, reviewed: boolean): void {
    dispatchDiffReviewAction(
      reviewState,
      { type: 'set-reviewed', targetId, fileOccurrence, reviewed },
      onStateChange,
      { readonly },
    );
  }

  function handleSelectionChange(result: DiffReviewAnnotationBridgeResult | null): void {
    if (result === null) {
      // Clearing the viewer's own selection only closes the composer panel;
      // an already-created draft remains in state, recoverable from the
      // drafts inventory.
      activeDraftId = null;
      return;
    }
    if (!reviewState.selectedTargetId) return;
    const draftId = crypto.randomUUID();
    const outcome = dispatchDiffReviewAction(
      reviewState,
      {
        type: 'create-draft',
        draftId,
        targetId: reviewState.selectedTargetId,
        anchor: result.anchor,
        oldPath: result.oldPath,
        newPath: result.newPath,
      },
      onStateChange,
      { readonly },
    );
    if (outcome.ok) activeDraftId = draftId;
  }

  function addFileComment(): void {
    if (!reviewState.selectedTargetId || rendererFailed) return;
    const fileOccurrence = reviewState.selectedFileOccurrence ?? 0;
    const draftId = crypto.randomUUID();
    const outcome = dispatchDiffReviewAction(
      reviewState,
      {
        type: 'create-draft',
        draftId,
        targetId: reviewState.selectedTargetId,
        anchor: { kind: 'file', fileOccurrence },
      },
      onStateChange,
      { readonly },
    );
    if (outcome.ok) activeDraftId = draftId;
  }

  function updateComposerBody(body: string): void {
    if (!activeDraftId) return;
    dispatchDiffReviewAction(
      reviewState,
      { type: 'update-draft', draftId: activeDraftId, body },
      onStateChange,
      { readonly },
    );
  }

  function closeComposer(): void {
    activeDraftId = null;
    resetToken += 1;
  }

  function saveComposer(): void {
    if (!activeDraftId) return;
    const outcome = dispatchDiffReviewAction(
      reviewState,
      { type: 'save-draft', draftId: activeDraftId },
      onStateChange,
      { readonly },
    );
    if (outcome.ok) closeComposer();
  }

  /**
   * Opening a hidden draft (COR-511 / DR-8 review follow-up; contract:
   * "Open clears only the necessary filters and focuses its composer").
   * Clearing `filterQuery` unconditionally would discard a filter the host
   * still needs for an unrelated reason -- it is cleared only when it is
   * itself the reason the draft's own file entry isn't currently visible.
   * `fileEntries` lists every target's files regardless of selection, so
   * this check needs no `reviewState` round-trip through `onStateChange`.
   *
   * A draft whose target was removed entirely has no entry in `fileEntries`
   * under ANY filter value (COR-511 review follow-up) -- the filter was
   * never the reason it is hidden, so clearing it would discard an
   * unrelated filter the host still needs. Only clear when an entry exists
   * unfiltered but the current filter is excluding it.
   */
  function openDraft(draft: DiffReviewDraft): void {
    if (effectiveTargets.some((target) => target.targetId === draft.targetId)) {
      selectFile(draft.targetId, draft.anchor.fileOccurrence);
    }
    activeDraftId = draft.draftId;
    draftsOpen = true;
    const matchesDraft = (entry: { targetId: string; fileOccurrence: number }): boolean =>
      entry.targetId === draft.targetId && entry.fileOccurrence === draft.anchor.fileOccurrence;
    const ownEntryExists = fileEntries.some(matchesDraft);
    const ownEntryVisible = filterDiffReviewFileEntries(fileEntries, filterQuery).some(
      matchesDraft,
    );
    if (ownEntryExists && !ownEntryVisible) filterQuery = '';
    composerFocusRequested = true;
  }

  function saveDraft(draftId: string): void {
    const outcome = dispatchDiffReviewAction(
      reviewState,
      { type: 'save-draft', draftId },
      onStateChange,
      { readonly },
    );
    if (outcome.ok && draftId === activeDraftId) closeComposer();
  }

  function discardDraft(draftId: string): void {
    const outcome = dispatchDiffReviewAction(
      reviewState,
      { type: 'discard-draft', draftId },
      onStateChange,
      { readonly },
    );
    if (outcome.ok && draftId === activeDraftId) closeComposer();
  }

  function getExportContent(format: 'markdown' | 'json', scope: DiffReviewExportScope) {
    const options = { scope, reviewTitle };
    return format === 'markdown'
      ? exportDiffReviewMarkdown(reviewState, options)
      : exportDiffReviewJson(reviewState, options);
  }

  /**
   * Focuses a CURRENT comment's anchor in the diff, through whichever
   * viewer's public `focusAnchor`/`focusFile` handle `DiffReviewRenderer`
   * currently exposes (COR-509 / DR-6, "comment-to-anchor navigation").
   * `DiffReviewComments` only calls this for comments it has already
   * classified as `current` -- an outdated or removed comment focuses its
   * own captured-detail element locally and never reaches here.
   */
  function navigateToComment(comment: DiffReviewComment): void {
    navigationUnavailable = false;
    const alreadyShowing =
      reviewState.selectedTargetId === comment.targetId &&
      reviewState.selectedFileOccurrence === comment.anchor.fileOccurrence;
    if (alreadyShowing) {
      performFocus(comment.anchor);
      return;
    }
    pendingFocus = {
      targetId: comment.targetId,
      fileOccurrence: comment.anchor.fileOccurrence,
      anchor: comment.anchor,
    };
    selectFile(comment.targetId, comment.anchor.fileOccurrence);
  }

  function performFocus(anchor: DiffReviewAnchor): void {
    const result =
      anchor.kind === 'file'
        ? rendererRef?.focusFile(anchor.fileOccurrence)
        : rendererRef?.focusAnchor(anchor);
    navigationUnavailable = (result ?? { status: 'unavailable' }).status === 'unavailable';
  }

  // Completes a navigation that first had to switch target/file: this only
  // fires once `reviewState` (the host-controlled prop) reflects the switch
  // `navigateToComment` dispatched above.
  $effect(() => {
    if (!pendingFocus) return;
    if (reviewState.selectedTargetId !== pendingFocus.targetId) return;
    if (reviewState.selectedFileOccurrence !== pendingFocus.fileOccurrence) return;
    const anchor = pendingFocus.anchor;
    pendingFocus = null;
    performFocus(anchor);
  });

  // Focuses the composer once `openDraft` has requested it and the composer
  // textarea is actually in the DOM (it renders inside `{#if activeDraft}`,
  // so on a first open the element does not exist yet in the same tick).
  $effect(() => {
    if (!composerFocusRequested || !composerTextareaElement) return;
    composerTextareaElement.focus();
    composerFocusRequested = false;
  });
</script>

<div class={['diff-review', className].filter(Boolean).join(' ')} {...rest}>
  {#if !targetsValidation.ok}
    <p class="diff-review-targets-error" role="alert">
      Couldn't apply the latest targets ({targetsValidation.error.code} at
      {targetsValidation.error.path || '/'}: {targetsValidation.error.message}). Showing the last
      valid view.
    </p>
  {/if}

  <DiffReviewToolbar
    {filterQuery}
    onfilterchange={(query) => (filterQuery = query)}
    gate={exportGate}
    ongetcontent={getExportContent}
    onopendrafts={() => (draftsOpen = true)}
  />

  <div class="diff-review-layout">
    <nav class="diff-review-files" aria-label="File navigation">
      <DiffReviewFileList
        entries={visibleFileEntries}
        selectedTargetId={reviewState.selectedTargetId}
        selectedFileOccurrence={reviewState.selectedFileOccurrence}
        {readonly}
        onselect={selectFile}
        onreviewedchange={setReviewed}
      />
    </nav>

    <main class="diff-review-diff" aria-label="Diff">
      {#if !readonly}
        <button type="button" onclick={addFileComment} disabled={rendererFailed}>
          Add file comment
        </button>
      {/if}
      {#if navigationUnavailable}
        <p class="diff-review-navigation-unavailable" role="status">
          That comment's location isn't available in the current view.
        </p>
      {/if}
      <DiffReviewRenderer
        target={selectedTarget}
        state={reviewState}
        selectedFileOccurrence={reviewState.selectedFileOccurrence}
        {readonly}
        {resetToken}
        onSelectionChange={handleSelectionChange}
        onRendererFailedChange={(failed) => (rendererFailed = failed)}
        bind:ref={rendererRef}
      />
      {#if activeDraft}
        <div
          class="diff-review-composer"
          role="group"
          aria-label={`New comment on ${formatDiffReviewCommentLocation(activeDraft)}`}
        >
          <p class="diff-review-composer-location">
            {formatDiffReviewCommentLocation(activeDraft)}
          </p>
          {#if readonly}
            <!-- Reaching a nonempty draft's composer while read-only is possible through the
                 drafts inventory's "Open" action, which always renders regardless of `readonly`
                 (only its own Save/Discard are hidden) -- a disabled Save plus visible
                 explanatory text, per the contract ("Use native disabled buttons/inputs with
                 nearby visible explanatory text"; "If read-only mode has nonempty drafts, export
                 stays blocked and explains that the host must enable editing to save/discard
                 them"). The textarea itself uses native `readonly`, not `disabled` (COR-511
                 review): a `disabled` textarea can never receive focus in a real browser, which
                 would silently break "Open ... focuses its composer" -- stated with no read-only
                 exception -- for exactly this case. `readonly` blocks editing identically while
                 keeping the element focusable and its text selectable/copyable. -->
            <p class="diff-review-composer-readonly-note">
              Enable editing to change or save this draft.
            </p>
          {/if}
          <textarea
            aria-label="Comment"
            value={activeDraft.body}
            {readonly}
            bind:this={composerTextareaElement}
            oninput={(event) => updateComposerBody(event.currentTarget.value)}></textarea>
          <div class="diff-review-composer-actions">
            <button
              type="button"
              onclick={saveComposer}
              disabled={readonly || activeDraft.body.trim().length === 0}
            >
              Save
            </button>
            <button type="button" onclick={closeComposer}>{readonly ? 'Close' : 'Cancel'}</button>
          </div>
        </div>
      {/if}
    </main>

    <aside class="diff-review-sidebar" aria-label="Review">
      {#if draftsOpen}
        <DiffReviewDraftsInventory
          drafts={reviewState.drafts}
          {readonly}
          onopen={openDraft}
          onsave={saveDraft}
          ondiscard={discardDraft}
        />
      {/if}
      <DiffReviewComments
        state={reviewState}
        {onStateChange}
        {readonly}
        onNavigate={navigateToComment}
      />
    </aside>
  </div>
</div>
