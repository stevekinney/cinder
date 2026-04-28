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
  // `mounted` is false during SSR and becomes true after the first client-side effect.
  // The dialog renders only when mounted (client) or when open (SSR with open=true).
  // This keeps the <dialog> absent from SSR HTML when closed, while letting the client
  // keep the element mounted so dialogElement.close() fires correctly.
  let mounted = $state(false);

  const titleId = useId('cinder-modal-title');

  $effect(() => {
    mounted = true;
  });

  $effect(() => {
    if (!dialogElement) return;
    if (open && !dialogElement.open) {
      dialogElement.showModal();
    } else if (!open && dialogElement.open) {
      // Only close if the dialog is actually open — close() throws InvalidStateError
      // if called on a dialog that was never opened.
      dialogElement.close();
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

{#if mounted || open}
  <dialog
    bind:this={dialogElement}
    class={cn('cinder-modal', className)}
    aria-modal="true"
    aria-labelledby={titleId}
    onclose={handleClose}
    onclick={handleBackdropClick}
  >
    {#if open}
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
    {/if}
  </dialog>
{/if}
