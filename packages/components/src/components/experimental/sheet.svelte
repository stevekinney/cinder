<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export type SheetEdge = 'top' | 'right' | 'bottom' | 'left';
  export type SheetSize = 'sm' | 'md' | 'lg' | 'full';

  /**
   * EXPERIMENTAL — Sheet API may change between minor versions until promoted
   * to stable.
   *
   * Slide-out panel anchored to a viewport edge. Behaves like a modal by
   * default (focus trap via the platform `<dialog>`, body scroll locked,
   * backdrop). `nonModal=true` disables those for inline panel patterns.
   */
  export type SheetProps = {
    /** Whether the sheet is open. Bindable. */
    open?: boolean;
    /** Edge the sheet slides in from. Default `right`. */
    edge?: SheetEdge;
    /** Sheet width/height token. Default `md`. */
    size?: SheetSize;
    /** When true, the sheet does not lock body scroll or trap focus. */
    nonModal?: boolean;
    /** Accessible name for the sheet. Required for screen-reader labelling. */
    title: string;
    /** Additional class names merged with `.cinder-sheet`. */
    class?: string;
    /** Sheet content. */
    children: Snippet;
  };
</script>

<script lang="ts">
  import { captureFocus, lockBodyScroll, restoreFocusTo } from '../../_internal/overlay.ts';
  import { cn } from '../../utilities/class-names.ts';
  import { useId } from '../../utilities/use-id.ts';

  let {
    open = $bindable(false),
    edge = 'right',
    size = 'md',
    nonModal = false,
    title,
    class: className,
    children,
  }: SheetProps = $props();

  const titleId = useId('cinder-sheet-title');

  let dialogElement: HTMLDialogElement | undefined = $state();
  let mounted = $state(false);
  let capturedFocus: HTMLElement | null = null;
  let releaseScrollLock: (() => void) | null = null;

  $effect(() => {
    mounted = true;
  });

  $effect(() => {
    if (!dialogElement) return;
    if (open && !dialogElement.open) {
      capturedFocus = captureFocus();
      if (!nonModal) {
        dialogElement.showModal();
        releaseScrollLock = lockBodyScroll();
      } else {
        // Non-modal: render but don't trap or lock scroll.
        dialogElement.show();
      }
    } else if (!open && dialogElement.open) {
      dialogElement.close();
    }
  });

  function handleClose() {
    open = false;
    if (releaseScrollLock) {
      releaseScrollLock();
      releaseScrollLock = null;
    }
    restoreFocusTo(capturedFocus);
    capturedFocus = null;
  }

  function handleBackdropClick(event: MouseEvent) {
    // Click on the dialog itself (not its panel children) is the backdrop.
    if (event.target === dialogElement) {
      open = false;
    }
  }
</script>

{#if mounted}
  <dialog
    bind:this={dialogElement}
    class={cn('cinder-sheet', className)}
    data-cinder-edge={edge}
    data-cinder-size={size}
    aria-labelledby={titleId}
    aria-modal={nonModal ? undefined : 'true'}
    onclose={handleClose}
    onclick={handleBackdropClick}
  >
    <div class="cinder-sheet__panel">
      <header class="cinder-sheet__header">
        <h2 id={titleId} class="cinder-sheet__title">{title}</h2>
        <button type="button" class="cinder-sheet__close" aria-label="Close" onclick={handleClose}>
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
            />
          </svg>
        </button>
      </header>
      <div class="cinder-sheet__body">
        {@render children()}
      </div>
    </div>
  </dialog>
{/if}
