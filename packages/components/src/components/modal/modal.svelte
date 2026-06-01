<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status stable
   * @purpose Centered modal dialog shell built on the native dialog element with focus capture, restoration, and dismissal handling.
   * @tag overlay
   * @tag dialog
   * @useWhen Presenting rich or structured content that requires user interaction before returning to the page — forms, multi-step wizards, detail views.
   * @useWhen Collecting structured input (forms, multi-field workflows) inside an overlay.
   * @avoidWhen Only a two-action confirm/cancel prompt is needed — use confirm-dialog instead.
   * @avoidWhen An urgent blocking acknowledgement is needed — use alert-dialog instead.
   * @avoidWhen Showing side-anchored navigation or settings — use a drawer instead.
   * @avoidWhen Presenting a small contextual surface anchored to a trigger — use a popover or sheet instead.
   * @related confirm-dialog, alert-dialog, drawer, sheet, popover
   */
  export type { ModalProps } from './modal.types.ts';
</script>

<script lang="ts">
  import type { ModalProps } from './modal.types.ts';
  import { onDestroy } from 'svelte';
  import { DEV } from 'esm-env';
  import { captureFocus, lockBodyScroll, pushEscapeHandler } from '../../_internal/overlay.ts';
  import { overflowFade } from '../../utilities/attachments.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { restoreFocusTo } from '../../utilities/focus.ts';
  import { useId } from '../../utilities/use-id.ts';

  let {
    open = $bindable(false),
    title,
    role = 'dialog',
    dismissOnBackdropClick = true,
    dismissOnEscape = true,
    showCloseButton = true,
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
  // Refcounted body scroll lock. Acquired when `open` transitions to true and
  // released on close OR on destroy (defensive — both fire on close-then-unmount,
  // and idempotence is guaranteed by checking `releaseBodyScrollLock !== null`).
  let releaseBodyScrollLock: (() => void) | null = null;
  // Escape-stack handle. Modal handles its own Escape via the native <dialog>
  // `cancel` event, but pushing a no-op handler keeps non-dialog overlays
  // above us from accidentally swallowing the keystroke (per OVERLAY-POLICY).
  let releaseEscapeHandler: (() => void) | null = null;

  function acquireLock() {
    if (releaseBodyScrollLock !== null) return;
    releaseBodyScrollLock = lockBodyScroll();
  }

  function releaseLock() {
    releaseBodyScrollLock?.();
    releaseBodyScrollLock = null;
  }

  function acquireEscapeHandler() {
    if (releaseEscapeHandler !== null) return;
    releaseEscapeHandler = pushEscapeHandler(() => {
      // No-op: the native <dialog> cancel event handles ESC dismissal. We
      // push this handler purely to participate in the escape-stack ordering
      // so non-dialog overlays above us route their own ESC correctly.
    });
  }

  function releaseEscape() {
    releaseEscapeHandler?.();
    releaseEscapeHandler = null;
  }

  const titleId = useId('cinder-modal-title');
  const bodyOverflowFade = overflowFade();

  $effect(() => {
    mounted = true;
  });

  $effect(() => {
    if (!DEV) return;
    if (
      role === 'alertdialog' &&
      (dismissOnBackdropClick !== false || dismissOnEscape !== false || showCloseButton !== false)
    ) {
      console.warn(
        '[cinder/Modal] role="alertdialog" requires dismissOnBackdropClick={false}, dismissOnEscape={false}, and showCloseButton={false}. ' +
          'Without these, Escape or backdrop click can bypass the mandatory acknowledgement. ' +
          'Use <AlertDialog> instead, or pass all three companion props explicitly.',
      );
    }
  });

  $effect(() => {
    if (!dialogElement) return;
    if (open && !dialogElement.open) {
      capturedFocus = captureFocus();
      dialogElement.showModal();
      acquireLock();
      acquireEscapeHandler();
      // Initial focus strategy:
      //   1. If a child carries `autofocus`, the native dialog already focused it.
      //   2. Otherwise, focus the body container (tabindex=-1) so initial focus
      //      lands on meaningful content rather than the close-X button — which
      //      would otherwise be the first sequentially-focusable element.
      // Check both the HTML attribute (set by static markup) and the DOM property
      // (set by Svelte 5's $.autofocus() helper, which sets element.autofocus = true
      // rather than the attribute). The attribute selector alone misses the Svelte case.
      const hasExplicitAutofocus =
        dialogElement.querySelector('[autofocus]') !== null ||
        Array.from(dialogElement.querySelectorAll<HTMLElement>('*')).some(
          (el) => el.autofocus === true,
        );
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
    // Iterate the local candidate list; the first that passes the connection
    // /ownership check wins. No fallback to document.body — if both candidates
    // are gone, leave focus where the browser put it.
    const candidates: Array<HTMLElement | null> = [triggerRef, capturedFocus];
    for (const candidate of candidates) {
      if (restoreFocusTo(candidate)) break;
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
    releaseLock();
    releaseEscape();
    returnFocus();
  }

  onDestroy(() => {
    // Defensive — close-then-unmount and unmount-while-open both land here.
    // The release functions are idempotent so a double-release is impossible.
    releaseLock();
    releaseEscape();
  });

  function handleBackdropClick(event: MouseEvent) {
    if (dismissOnBackdropClick && event.target === dialogElement) {
      dismiss();
    }
  }

  function handleNativeCancel(event: Event) {
    // Escape key fires the native 'cancel' event on <dialog>. We prevent the default
    // so the browser doesn't close the dialog through its own mechanism — we route
    // exclusively through dismiss() → open = false → $effect → dialogElement.close()
    // → 'close' event → handleClose. This ensures exactly one close path for Escape.
    event.preventDefault();
    if (!dismissOnEscape) return;
    dismiss();
  }
</script>

{#if mounted || open}
  <dialog
    bind:this={dialogElement}
    class={classNames('cinder-modal', className)}
    {role}
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

        <div
          bind:this={bodyElement}
          class="cinder-modal__body"
          tabindex="-1"
          {@attach bodyOverflowFade}
        >
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
        {#if showCloseButton}
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
        {/if}
      </div>
    {/if}
  </dialog>
{/if}
