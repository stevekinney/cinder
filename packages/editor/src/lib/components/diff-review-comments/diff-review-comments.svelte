<script lang="ts" module>
  /**
   * @cinder
   * @category domain
   * @status domain-suite
   * @purpose Reusable, resolution-aware comments panel for a `DiffReviewState` session: every saved comment by default, with an unresolved filter, and a review note.
   * @tag diff-review
   * @tag comments
   * @useWhen Building a standalone comment panel next to a `DiffViewer` or `SourceDiffViewer` instance.
   * @useWhen Composing the aggregate `DiffReview` shell, which renders this panel internally.
   * @avoidWhen Reviewing ProseMirror document threads with author identity — use ReviewEditor's own comment UI instead.
   * @related diff-review
   */
  export type {
    DiffReviewCommentsFilter,
    DiffReviewCommentsProps,
  } from './diff-review-comments.types.ts';
</script>

<script lang="ts">
  import { untrack } from 'svelte';

  import { classifyDiffReviewAnchorStatus } from '../diff-review/diff-review-anchor-status.ts';
  import { dispatchDiffReviewAction } from '../../utilities/diff-review-dispatch.ts';
  import DiffReviewCommentItem from './diff-review-comment-item.svelte';
  import { filterDiffReviewComments } from './diff-review-comments-filter.ts';
  import type {
    DiffReviewCommentsFilter,
    DiffReviewCommentsProps,
  } from './diff-review-comments.types.ts';

  // Destructured as `reviewState` (not `state`): Svelte's `$state` rune is
  // parsed as the legacy `$identifier` auto-subscription form whenever a
  // variable literally named `state` is in scope, which breaks every
  // `$state(...)` call below. The public prop name stays `state` per the
  // ratified contract; only this internal binding is renamed.
  let {
    state: reviewState,
    onStateChange,
    readonly = false,
    defaultFilter = 'all',
    onNavigate,
    class: className,
    ...rest
  }: DiffReviewCommentsProps = $props();

  // Uncontrolled after mount (see the prop doc): only the initial value of
  // `defaultFilter` seeds this, so it deliberately does not track later
  // prop changes.
  let filter = $state<DiffReviewCommentsFilter>(untrack(() => defaultFilter));
  // Instance-unique id so two `DiffReviewComments` mounts on one page never
  // collide on the review-note label association.
  const instanceId = $props.id();
  const reviewNoteId = `diff-review-review-note-${instanceId}`;

  const visibleComments = $derived(filterDiffReviewComments(reviewState.comments, filter));

  function editComment(id: string, body: string): void {
    dispatchDiffReviewAction(reviewState, { type: 'edit-comment', id, body }, onStateChange, {
      readonly,
    });
  }

  function deleteComment(id: string): void {
    dispatchDiffReviewAction(reviewState, { type: 'delete-comment', id }, onStateChange, {
      readonly,
    });
  }

  function resolveComment(id: string): void {
    dispatchDiffReviewAction(reviewState, { type: 'resolve-comment', id }, onStateChange, {
      readonly,
    });
  }

  function reopenComment(id: string): void {
    dispatchDiffReviewAction(reviewState, { type: 'reopen-comment', id }, onStateChange, {
      readonly,
    });
  }

  function setReviewNote(body: string): void {
    dispatchDiffReviewAction(reviewState, { type: 'set-review-note', body }, onStateChange, {
      readonly,
    });
  }

  /**
   * Only a CURRENT comment ever reaches the host's `onNavigate` -- an
   * outdated or removed one is handled entirely locally by
   * `DiffReviewCommentItem` itself (focus its captured detail), per the
   * contract's "never focus a current row" for either case.
   */
  function navigate(comment: (typeof visibleComments)[number]): void {
    if (classifyDiffReviewAnchorStatus(reviewState, comment) !== 'current') return;
    onNavigate?.(comment);
  }
</script>

<section
  class={['diff-review-comments', className].filter(Boolean).join(' ')}
  aria-label="Comments"
  {...rest}
>
  <div class="diff-review-comments-filter" role="group" aria-label="Comment filter">
    <button type="button" aria-pressed={filter === 'all'} onclick={() => (filter = 'all')}>
      All comments
    </button>
    <button
      type="button"
      aria-pressed={filter === 'unresolved'}
      onclick={() => (filter = 'unresolved')}
    >
      Unresolved only
    </button>
  </div>

  {#if visibleComments.length === 0}
    <p class="diff-review-comments-empty">
      {filter === 'unresolved' ? 'No unresolved comments.' : 'No comments yet.'}
    </p>
  {:else}
    <ul class="diff-review-comments-list">
      {#each visibleComments as comment (comment.id)}
        <DiffReviewCommentItem
          {comment}
          status={classifyDiffReviewAnchorStatus(reviewState, comment)}
          {readonly}
          onedit={editComment}
          ondelete={deleteComment}
          onresolve={resolveComment}
          onreopen={reopenComment}
          onnavigate={() => navigate(comment)}
        />
      {/each}
    </ul>
  {/if}

  <div class="diff-review-comments-note">
    <label for={reviewNoteId}>Review note</label>
    <textarea
      id={reviewNoteId}
      value={reviewState.reviewNote}
      disabled={readonly}
      onchange={(event) => setReviewNote(event.currentTarget.value)}></textarea>
  </div>
</section>
