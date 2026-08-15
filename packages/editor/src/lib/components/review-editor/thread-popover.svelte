<script lang="ts" module>
  import type { Thread } from '../../comments/index.ts';
  import type { ReviewMode } from './review-editor.types.ts';

  export type ThreadPopoverProps = {
    /** Unique ID for accessibility */
    id: string;
    /** The thread to display */
    thread: Thread;
    /** Current user ID (for permissions) */
    currentUserId?: string | undefined;
    /** Editor mode (affects available actions) */
    mode?: ReviewMode;
    /** Position of the popover (relative to viewport) */
    position?: { x: number; y: number };
    /** Additional CSS class */
    class?: string;
    /**
     * `id` of the element that should receive focus when the element that opened
     * this popover can no longer take it back.
     *
     * Deleting a thread from inside its own popover is the case that needs it:
     * the sidebar item the user opened the popover from is removed by the same
     * action, so the focus trap's captured element is gone by the time it tries
     * to restore, and focus lands on `<body>`.
     *
     * An id rather than a selector, deliberately. The value is derived from the
     * consumer-supplied editor `id`, which only has to be a valid HTML id and so
     * may contain `"` or `\\` — characters that make an interpolated attribute
     * selector invalid or change what it matches, whereupon the lookup fails
     * silently and focus lands on `<body>` after all. `getElementById` takes a
     * raw string and parses nothing, so the failure mode does not exist rather
     * than being escaped around.
     */
    restoreFallbackId?: string;
    /**
     * Resolves an element whose clicks should NOT count as "outside" this
     * popover for the purposes of the dismiss-on-click-outside listener.
     *
     * Concretely: the sidebar row that opened this popover, while it is still
     * the active selection. `createClickOutside`'s listener runs in the
     * `document` capture phase, before that row's own bubble-phase `onclick`,
     * so a re-click on the row you are already looking at would otherwise
     * close this popover before the row's click handler ever runs — a
     * destroy-then-recreate round trip for a gesture that changes nothing,
     * and one that silently drops any unsent reply text sitting in
     * CommentComposer's draft state (cinder#1320).
     *
     * A getter, not a static ref, because "the active row" changes: the
     * consumer resolves it fresh (by DOM query, scoped to its own sidebar) on
     * every click, so clicking a DIFFERENT row is unaffected and still closes
     * this popover immediately.
     */
    ignoreClickOutsideRef?: () => Element | null;
    /** Called when the popover should close */
    onclose?: () => void;
    /** Called when thread is deleted */
    ondelete?: (threadId: string) => void;
    /** Called when a new comment is created */
    oncommentcreate?: (threadId: string, body: string) => void;
    /** Called when a comment is updated */
    oncommentupdate?: (threadId: string, commentId: string, body: string) => void;
    /** Called when a comment is deleted */
    oncommentdelete?: (threadId: string, commentId: string) => void;
  };
</script>

<script lang="ts">
  import type { Placement, VirtualElement } from '@floating-ui/dom';
  import { createAnchoredOverlay } from '../../_internal/anchored-overlay.svelte.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { createFocusTrap } from '@lostgradient/cinder/focus-trap';
  import { createClickOutside } from '../../utilities/attachments.ts';
  import Button from '@lostgradient/cinder/button';
  import { isDocumentAnchor } from '../../comments/index.ts';
  import CommentList from './comment-list.svelte';
  import CommentComposer from './comment-composer.svelte';
  import { FileText, Trash2, X } from '@lostgradient/cinder/icons';

  let {
    id,
    thread,
    currentUserId,
    mode = 'edit',
    position,
    class: className,
    restoreFallbackId,
    ignoreClickOutsideRef,
    onclose,
    ondelete,
    oncommentcreate,
    oncommentupdate,
    oncommentdelete,
  }: ThreadPopoverProps = $props();

  const isReadonly = $derived(mode === 'readonly');

  let popoverElement = $state<HTMLDivElement | null>(null);
  const virtualAnchor = $derived.by<VirtualElement | null>(() => {
    if (!position) return null;
    return {
      getBoundingClientRect: () =>
        ({
          x: position.x,
          y: position.y,
          top: position.y,
          left: position.x,
          right: position.x,
          bottom: position.y,
          width: 0,
          height: 0,
        }) as DOMRect,
    };
  });
  const anchoredOverlay = createAnchoredOverlay({
    open: () => Boolean(position),
    anchor: () => virtualAnchor,
    panel: () => popoverElement,
    placement: () => 'right-start' as Placement,
    offset: () => 8,
    widthMode: () => 'content',
  });

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault();
      onclose?.();
    }
  }

  /**
   * Set once the user has asked for this thread to be deleted, so focus
   * restoration prefers `restoreFallback` over the element that opened the
   * popover.
   *
   * Without it, a consumer whose `onthreaddelete` is server-backed gets the bug
   * back: the popover closes as soon as the request is made, the sidebar item is
   * still on screen awaiting the response, so restoration hands focus back to it
   * — and then it unmounts, dropping focus on `<body>` with the fallback never
   * consulted. A consumer that removes the thread synchronously never reaches
   * that window, which is why the synchronous case looks fixed either way.
   */
  let deleteRequested = $state(false);

  function handleDelete() {
    deleteRequested = true;
    ondelete?.(thread.id);
  }

  function handleCommentUpdate(commentId: string, body: string) {
    oncommentupdate?.(thread.id, commentId, body);
  }

  function handleCommentDelete(commentId: string) {
    oncommentdelete?.(thread.id, commentId);
  }

  function handleCommentCreate(body: string) {
    oncommentcreate?.(thread.id, body);
  }

  /** Whether this is a document-level comment */
  const isDocumentComment = $derived(isDocumentAnchor(thread.anchor));

  /** Display title for the popover */
  const displayTitle = $derived.by(() => {
    if (isDocumentComment) {
      return null; // Will show "Document comment" label instead
    }
    const quote = thread.anchor.quote;
    return quote.length > 30 ? `${quote.slice(0, 30)}...` : quote;
  });
</script>

<!--
  Deliberately `role="dialog"` WITHOUT `aria-modal="true"` (cinder#1305). This
  is an anchored, non-modal dialog — the same pattern as a comment popover in
  Google Docs or a GitHub PR review thread — not a blocking modal, and the
  component's own keyboard design says so: F6 landmark navigation
  (`handleContainerKeyDown` in `review-editor-impl.svelte`) deliberately moves
  focus from this popover to `.review-editor-main` while the popover stays
  open, so a reviewer can jump back to the document without closing the
  thread. `aria-modal="true"` is a promise that everything outside the dialog
  is unavailable; nothing here makes `.review-editor-main` or the comment
  sidebar `inert` while this is open, and F6 proves they are still reachable
  on purpose. Making the markup honest about that (rather than adding
  `inert`/`aria-hidden` to the rest of the editor and removing F6) is the
  smaller change AND the one that keeps this popover's actual, intended
  workflow — F6 out, `Escape` or click-outside to close, `Tab` cycling the
  popover's own controls while it has focus. Tab-trapping while non-modal is
  intentional here too: this is a transient, anchored control surface (much
  like a menu or combobox listbox), not a page-blocking dialog, so trapping
  Tab within it while open — while still leaving F6/Escape/click-outside as
  explicit ways out — is consistent, not contradictory.
-->
<div
  bind:this={popoverElement}
  {id}
  role="dialog"
  aria-labelledby="{id}-title"
  tabindex="-1"
  class={classNames('thread-popover', className)}
  style={anchoredOverlay.positionStyle}
  data-position-ready={anchoredOverlay.positionReady}
  inert={!anchoredOverlay.positionReady ? true : undefined}
  {@attach createFocusTrap({
    active: () => anchoredOverlay.positionReady,
    restoreFallback: () => (restoreFallbackId ? document.getElementById(restoreFallbackId) : null),
    preferRestoreFallback: () => deleteRequested,
  })}
  {@attach createClickOutside({
    handler: () => onclose?.(),
    ...(ignoreClickOutsideRef ? { ignoreRefs: [ignoreClickOutsideRef] } : {}),
  })}
  onkeydown={handleKeyDown}
>
  <header class="thread-popover-header">
    <div class="thread-popover-title-row">
      <h2 id="{id}-title" class="thread-popover-title">
        {#if isDocumentComment}
          <span class="thread-popover-document-label">
            <FileText class="cinder-icon-xs" />
            Document comment
          </span>
        {:else}
          <span class="thread-popover-quote" title={thread.anchor.quote}>
            "{displayTitle}"
          </span>
        {/if}
      </h2>
      <div class="thread-popover-header-actions">
        {#if !isReadonly}
          <Button
            variant="ghost"
            size="xs"
            onclick={handleDelete}
            disabled={!currentUserId}
            aria-label="Delete thread"
          >
            <Trash2 class="cinder-icon-sm" />
          </Button>
        {/if}
        <button type="button" class="thread-popover-close" onclick={onclose} aria-label="Close">
          <X class="cinder-icon-sm" />
        </button>
      </div>
    </div>
  </header>

  <div class="thread-popover-content">
    <CommentList
      comments={thread.comments}
      {currentUserId}
      {mode}
      onupdate={handleCommentUpdate}
      ondelete={handleCommentDelete}
    />
  </div>

  {#if !isReadonly && currentUserId}
    <div class="thread-popover-composer">
      <CommentComposer id="{id}-composer" placeholder="Reply..." onsubmit={handleCommentCreate} />
    </div>
  {/if}
</div>

<style>
  .thread-popover {
    /* Dimension custom properties - keep in sync with JS constants */
    --cinder-review-editor-popover-width: 360px;
    --cinder-review-editor-popover-min-height: 200px;

    position: fixed;
    z-index: var(--cinder-z-dropdown);
    display: flex;
    flex-direction: column;
    width: var(--cinder-review-editor-popover-width);
    min-height: var(--cinder-review-editor-popover-min-height);
    max-width: calc(100vw - 2rem);
    max-height: calc(100vh - 4rem);
    background: var(--cinder-surface);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
    box-shadow: var(--cinder-shadow-lg);
    overflow: hidden;
  }

  .thread-popover-header {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-2);
    padding: var(--cinder-space-3) var(--cinder-space-4);
    border-bottom: 1px solid var(--cinder-border);
    background: var(--cinder-surface-raised);
  }

  .thread-popover-title-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--cinder-space-2);
  }

  .thread-popover-title {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2);
    margin: 0;
    font-size: var(--cinder-text-sm);
    font-weight: var(--cinder-font-medium);
  }

  .thread-popover-quote {
    color: var(--cinder-text-muted);
    font-weight: var(--cinder-font-normal);
    font-style: italic;
  }

  .thread-popover-header-actions {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-1);
    flex-shrink: 0;
  }

  .thread-popover-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    flex-shrink: 0;
    color: var(--cinder-text-muted);
    background: transparent;
    border: none;
    border-radius: var(--cinder-radius-sm);
    cursor: pointer;
    transition:
      background-color var(--cinder-duration-fast) var(--cinder-ease-standard),
      color var(--cinder-duration-fast) var(--cinder-ease-standard);
  }

  @media (hover: hover) {
    .thread-popover-close:hover {
      color: var(--cinder-text);
      background: var(--cinder-surface-hover);
    }
  }

  /* Close button sits in the popover corner; an outset ring would overhang the
     popover edge, so paint an INSET ring (Strategy B-inset). */
  .thread-popover-close:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: inset 0 0 0 var(--cinder-ring-width)
      var(--_cinder-thread-popover-close-ring, var(--cinder-ring-color));
  }

  @media (forced-colors: active) {
    .thread-popover-close:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: calc(var(--cinder-ring-width) * -1);
    }
  }

  .thread-popover-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--cinder-space-4);
  }

  .thread-popover-document-label {
    display: inline-flex;
    align-items: center;
    gap: var(--cinder-space-1);
    font-size: var(--cinder-text-xs);
    font-weight: var(--cinder-font-medium);
    font-style: normal;
    color: var(--cinder-accent-text);
    padding: var(--cinder-space-0-5) var(--cinder-space-1-5);
    background: color-mix(in oklch, var(--cinder-accent), transparent 90%);
    border-radius: var(--cinder-radius-sm);
  }

  .thread-popover-composer {
    padding: var(--cinder-space-3) var(--cinder-space-4);
    border-top: 1px solid var(--cinder-border-muted);
    background: var(--cinder-surface-raised);
  }
</style>
