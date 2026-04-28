<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export type ModalProps = {
    open: boolean;
    title: string;
    class?: string;
    children: Snippet;
    footer?: Snippet;
    triggerRef?: HTMLElement | null;
  };
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';
  import { useId } from '../utilities/use-id.ts';

  let {
    open = $bindable(false),
    title,
    class: className,
    children,
    footer,
    triggerRef = null,
  }: ModalProps = $props();

  let dialogElement: HTMLDialogElement | undefined = $state();

  const titleId = useId('cinder-modal-title');

  // The dialog element only mounts when open=true, so call showModal() on mount.
  // close() is handled by the onclose event handler via handleClose().
  $effect(() => {
    if (dialogElement && !dialogElement.open) {
      dialogElement.showModal();
    }
  });

  function handleClose() {
    open = false;
    triggerRef?.focus();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === dialogElement) {
      open = false;
      triggerRef?.focus();
    }
  }
</script>

{#if open}
  <dialog
    bind:this={dialogElement}
    class={cn('cinder-modal', className)}
    aria-modal="true"
    aria-labelledby={titleId}
    onclose={handleClose}
    onclick={handleBackdropClick}
  >
    <div class="cinder-modal__panel">
      <div class="cinder-modal__header">
        <h2 id={titleId} class="cinder-modal__title">{title}</h2>
        <button
          type="button"
          class="cinder-modal__close"
          aria-label="Close dialog"
          onclick={handleClose}
        >
          <svg
            class="cinder-modal__close-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
            />
          </svg>
        </button>
      </div>

      <div class="cinder-modal__body">
        {@render children()}
      </div>

      {#if footer}
        <div class="cinder-modal__footer">
          {@render footer()}
        </div>
      {/if}
    </div>
  </dialog>
{/if}
