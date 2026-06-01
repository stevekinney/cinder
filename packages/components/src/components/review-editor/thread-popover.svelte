<script lang="ts" module>
  import type { Thread } from 'cinder/commentary/comments';
  import type { ReviewMode } from './review-editor-types.ts';

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
  import { createFocusTrap } from '../focus-trap/index.ts';
  import { createClickOutside } from '../../utilities/attachments.ts';
  import Button from '../button/button.svelte';
  import { isDocumentAnchor } from 'cinder/commentary/comments';
  import CommentList from './comment-list.svelte';
  import CommentComposer from './comment-composer.svelte';
  import FileText from 'lucide-svelte/icons/file-text';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import X from 'lucide-svelte/icons/x';

  let {
    id,
    thread,
    currentUserId,
    mode = 'edit',
    position,
    class: className,
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

  function handleDelete() {
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

<div
  bind:this={popoverElement}
  {id}
  role="dialog"
  aria-modal="true"
  aria-labelledby="{id}-title"
  tabindex="-1"
  class={classNames('thread-popover', className)}
  style={anchoredOverlay.positionStyle}
  data-position-ready={anchoredOverlay.positionReady}
  inert={!anchoredOverlay.positionReady ? true : undefined}
  {@attach createFocusTrap({ active: () => anchoredOverlay.positionReady })}
  {@attach createClickOutside({ handler: () => onclose?.() })}
  onkeydown={handleKeyDown}
>
  <header class="thread-popover-header">
    <div class="thread-popover-title-row">
      <h2 id="{id}-title" class="thread-popover-title">
        {#if isDocumentComment}
          <span class="thread-popover-document-label">
            <FileText class="icon-xs" />
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
            <Trash2 class="icon-sm" />
          </Button>
        {/if}
        <button type="button" class="thread-popover-close" onclick={onclose} aria-label="Close">
          <X class="icon-sm" />
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

  .thread-popover-close:focus-visible {
    outline: 2px solid var(--cinder-accent);
    outline-offset: -2px;
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
    color: var(--cinder-accent);
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
