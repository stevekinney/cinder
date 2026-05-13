<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export type ModalProps = {
    open: boolean;
    title: string;
    class?: string;
    children: Snippet;
    footer?: Snippet;
    triggerRef?: HTMLElement | null;
    /** When set, applied as aria-describedby on the underlying <dialog>. Pass a short, plain description ID only. */
    describedById?: string;
    /**
     * Fired on user-initiated dismissal. Includes: Escape key (native dialog 'cancel' event),
     * backdrop click, and the close-X button. EXCLUDES: parent-driven open = false.
     * Callbacks are not awaited and thrown callbacks do not block close.
     */
    ondismiss?: () => void;
  };
</script>

<script lang="ts">
  import { captureFocus, restoreFocusTo } from '../_internal/overlay.ts';
  import { cn } from '../utilities/class-names.ts';
  import { useId } from '../utilities/use-id.ts';

  let {
    open = $bindable(false),
    title,
    class: className,
    children,
    footer,
    triggerRef = null,
    describedById,
    ondismiss,
  }: ModalProps = $props();

  let dialogElement: HTMLDialogElement | undefined = $state();
  let bodyElement: HTMLDivElement | undefined = $state();
  // `mounted` is false during SSR and becomes true after the first client-side effect.
  // The dialog renders only when mounted (client) or when open (SSR with open=true).
  // This keeps the <dialog> absent from SSR HTML when closed, while letting the client
  // keep the element mounted so dialogElement.close() fires correctly.
  let mounted = $state(false);
  // Element that had focus before the dialog opened. Captured each time the dialog
  // transitions from closed → open so focus can be restored to wherever the user
  // came from, even if the consumer didn't supply an explicit `triggerRef`.
  let capturedFocus: HTMLElement | null = null;

  const titleId = useId('cinder-modal-title');

  $effect(() => {
    mounted = true;
  });

  $effect(() => {
    if (!dialogElement) return;
    if (open && !dialogElement.open) {
      capturedFocus = captureFocus();
      dialogElement.showModal();
      // Initial focus strategy:
      //   1. If a child carries `autofocus`, the native dialog already focused it.
      //   2. Otherwise, focus the body container (tabindex=-1) so initial focus
      //      lands on meaningful content rather than the close-X button — which
      //      would otherwise be the first sequentially-focusable element.
      const hasExplicitAutofocus = dialogElement.querySelector('[autofocus]') !== null;
      if (!hasExplicitAutofocus && bodyElement) {
        bodyElement.focus();
      }
    } else if (!open && dialogElement.open) {
      // Only close if the dialog is actually open — close() throws InvalidStateError
      // if called on a dialog that was never opened.
      dialogElement.close();
    }
  });

  function returnFocus() {
    // Explicit triggerRef wins over auto-capture; otherwise restore to wherever
    // focus lived before the dialog opened.
    if (triggerRef) {
      restoreFocusTo(triggerRef);
    } else {
      restoreFocusTo(capturedFocus);
    }
    capturedFocus = null;
  }

  // Single source of truth for all user-initiated dismissal paths: Escape, backdrop click,
  // and the close-X button. State flips FIRST so a thrown callback does not leave the
  // dialog open. Callbacks are not awaited; sync throws propagate to the caller.
  function dismiss() {
    open = false;
    ondismiss?.();
  }

  function handleClose() {
    // Fired on the native 'close' event — may be triggered by dismiss() (via dialogElement.close())
    // or by parent-driven open = false. Only restores focus; does NOT call ondismiss here
    // so parent-driven closes do not fire the callback.
    open = false;
    returnFocus();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === dialogElement) {
      dismiss();
    }
  }

  function handleNativeCancel(event: Event) {
    // Escape key fires the native 'cancel' event on <dialog>. We prevent the default
    // so the browser doesn't close the dialog through its own mechanism — we route
    // exclusively through dismiss() → open = false → $effect → dialogElement.close()
    // → 'close' event → handleClose. This ensures exactly one close path for Escape.
    event.preventDefault();
    dismiss();
  }
</script>

{#if mounted || open}
  <dialog
    bind:this={dialogElement}
    class={cn('cinder-modal', className)}
    aria-modal="true"
    aria-labelledby={titleId}
    {...describedById ? { 'aria-describedby': describedById } : {}}
    onclose={handleClose}
    onclick={handleBackdropClick}
    oncancel={handleNativeCancel}
  >
    {#if open}
      <div class="cinder-modal__panel">
        <div class="cinder-modal__header">
          <h2 id={titleId} class="cinder-modal__title">{title}</h2>
        </div>

        <div bind:this={bodyElement} class="cinder-modal__body" tabindex="-1">
          {@render children()}
        </div>

        {#if footer}
          <div class="cinder-modal__footer">
            {@render footer()}
          </div>
        {/if}

        <!--
          Rendered last so tabbing forward from the panel leaves it last in
          sequential focus order. CSS positions it visually in the corner.
        -->
        <button
          type="button"
          class="cinder-modal__close"
          aria-label="Close dialog"
          onclick={dismiss}
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
    {/if}
  </dialog>
{/if}
