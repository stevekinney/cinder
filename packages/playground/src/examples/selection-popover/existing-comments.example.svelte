<script lang="ts" module>
  export const title = 'Existing commented selections';
  export const description =
    'Shows persistent comment highlights as consumer-owned markup while SelectionPopover handles new text selections.';
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import type { SelectionPopoverPosition } from '@lostgradient/cinder/selection-popover';
  import { SelectionPopover } from '@lostgradient/cinder/selection-popover';

  type ExistingComment = {
    id: string;
    quote: string;
    body: string;
  };

  type SubmittedComment = { id: string; body: string };

  const popoverId = 'existing-comments-selection-popover';
  const activeCommentPanelId = 'existing-comment-panel';
  const existingComments: ExistingComment[] = [
    {
      id: 'existing-comment-platform',
      quote: 'platform review workflow',
      body: 'This phrase already has a persisted comment. The highlight is rendered by the consumer.',
    },
    {
      id: 'existing-comment-anchors',
      quote: 'anchored selections visible',
      body: 'ReviewEditor uses commentary anchor decorations for the full editor-backed version.',
    },
  ];

  let surfaceElement = $state<HTMLElement | null>(null);
  let activeCommentId = $state(existingComments[0]?.id ?? null);
  let isOpen = $state(false);
  let position = $state<SelectionPopoverPosition | null>(null);
  let submittedComments = $state<SubmittedComment[]>([]);

  const activeComment = $derived(
    existingComments.find((comment) => comment.id === activeCommentId) ?? null,
  );
  const layoutStyle =
    'display: flex; flex-wrap: wrap; gap: var(--cinder-space-4); align-items: flex-start;';
  const surfaceStyle =
    'flex: 1 1 24rem; min-width: min(100%, 20rem); max-width: 36rem; line-height: 1.6; user-select: text; cursor: text;';
  const paragraphStyle = 'margin: 0 0 var(--cinder-space-3);';
  const anchorBaseStyle =
    'border-radius: var(--cinder-radius-sm); color: inherit; text-decoration-color: var(--cinder-accent); text-decoration-thickness: 0.1em; text-underline-offset: 0.15em; cursor: pointer;';
  const panelStyle =
    'flex: 1 1 14rem; max-width: 18rem; padding: var(--cinder-space-3); border: 1px solid var(--cinder-border-muted); border-radius: var(--cinder-radius-md); background: var(--cinder-surface);';
  const headingStyle =
    'margin: 0 0 var(--cinder-space-2); font-size: var(--cinder-text-sm); font-weight: var(--cinder-font-medium);';
  const bodyStyle =
    'margin: 0; color: var(--cinder-text-muted); font-size: var(--cinder-text-sm); line-height: 1.5;';
  const submittedStyle = `${panelStyle} max-width: 36rem; margin-top: var(--cinder-space-3);`;

  function getAnchorStyle(active: boolean): string {
    const background = active
      ? 'background: color-mix(in oklch, var(--cinder-accent), transparent 72%); outline: 1px solid color-mix(in oklch, var(--cinder-accent), transparent 32%);'
      : 'background: color-mix(in oklch, var(--cinder-accent), transparent 84%);';
    return `${anchorBaseStyle} ${background}`;
  }

  function getSelectionAnchor(surface: HTMLElement): SelectionPopoverPosition | null {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    if (!surface.contains(range.commonAncestorContainer)) return null;

    const rect =
      Array.from(range.getClientRects()).find((clientRect) => {
        return clientRect.width > 0 && clientRect.height > 0;
      }) ?? range.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) return null;

    return {
      x: rect.left + rect.width / 2,
      y: rect.top,
    };
  }

  onMount(() => {
    function handleSelectionChange(): void {
      if (!surfaceElement) return;

      const popoverElement = document.getElementById(popoverId);
      if (popoverElement?.contains(document.activeElement)) return;
      if (popoverElement?.hasAttribute('data-cinder-expanded')) return;

      const anchor = getSelectionAnchor(surfaceElement);
      if (anchor) {
        position = anchor;
        isOpen = true;
      } else {
        position = null;
        isOpen = false;
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  });

  function openExistingComment(event: MouseEvent, commentId: string): void {
    event.preventDefault();
    activeCommentId = commentId;
    isOpen = false;
    position = null;
  }

  function handleExistingCommentKeydown(event: KeyboardEvent, commentId: string): void {
    if (event.key !== ' ') return;
    event.preventDefault();
    activeCommentId = commentId;
    isOpen = false;
    position = null;
  }

  function handleClose(): void {
    isOpen = false;
    position = null;
  }

  function addComment(body: string): void {
    submittedComments = [...submittedComments, { id: crypto.randomUUID(), body }];
    handleClose();
  }
</script>

<div style={layoutStyle}>
  <article bind:this={surfaceElement} style={surfaceStyle}>
    <p style={paragraphStyle}>
      Consumers can keep the
      <a
        href="#existing-comment-platform"
        data-testid="existing-comment-anchor"
        data-active={activeCommentId === 'existing-comment-platform'}
        aria-current={activeCommentId === 'existing-comment-platform' ? 'true' : undefined}
        aria-controls={activeCommentPanelId}
        style={getAnchorStyle(activeCommentId === 'existing-comment-platform')}
        onclick={(event) => openExistingComment(event, 'existing-comment-platform')}
        onkeydown={(event) => handleExistingCommentKeydown(event, 'existing-comment-platform')}
      >
        platform review workflow
      </a>
      visibly connected to saved comments while still using SelectionPopover for brand-new selections.
    </p>

    <p style={paragraphStyle}>
      For editor-backed documents, ReviewEditor and commentary anchor decorations keep
      <a
        href="#existing-comment-anchors"
        data-testid="existing-comment-anchor"
        data-active={activeCommentId === 'existing-comment-anchors'}
        aria-current={activeCommentId === 'existing-comment-anchors' ? 'true' : undefined}
        aria-controls={activeCommentPanelId}
        style={getAnchorStyle(activeCommentId === 'existing-comment-anchors')}
        onclick={(event) => openExistingComment(event, 'existing-comment-anchors')}
        onkeydown={(event) => handleExistingCommentKeydown(event, 'existing-comment-anchors')}
      >
        anchored selections visible
      </a>
      as the document changes. Select any unhighlighted text in this example to add a new note.
    </p>
  </article>

  <aside id={activeCommentPanelId} style={panelStyle} aria-live="polite">
    {#if activeComment}
      <h4 id={activeComment.id} style={headingStyle}>{activeComment.quote}</h4>
      <p style={bodyStyle}>{activeComment.body}</p>
    {/if}
  </aside>
</div>

<SelectionPopover
  id={popoverId}
  open={isOpen}
  {position}
  onclose={handleClose}
  oncommentsubmit={addComment}
/>

{#if submittedComments.length > 0}
  <section style={submittedStyle} aria-label="New comments">
    <h4 style={headingStyle}>New comments</h4>
    {#each submittedComments as comment (comment.id)}
      <p style={bodyStyle}>{comment.body}</p>
    {/each}
  </section>
{/if}
