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
  import { devWarn } from '../../utilities/dev-warn.ts';
  import { overflowFade } from '../../utilities/attachments.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';
  import { createFocusTrap } from '../focus-trap/index.ts';
  import { createSlidingDialogState } from '../_internal/create-sliding-dialog-state.svelte.ts';

  const titleId = $props.id();

  let {
    open = $bindable(false),
    title,
    role = 'dialog',
    dismissOnBackdropClick = true,
    dismissOnEscape = true,
    closeButtonVisible = true,
    class: className,
    children,
    footer,
    triggerRef = null,
    describedById,
    onDismiss,
  }: ModalProps = $props();

  let dialogElement: HTMLDialogElement | undefined = $state();
  let panelElement: HTMLDivElement | undefined = $state();
  let bodyElement: HTMLDivElement | undefined = $state();
  // `mounted` is false during SSR and becomes true after the first client-side effect.
  // The dialog renders only when mounted (client) or when open (SSR with open=true).
  // This keeps the <dialog> absent from SSR HTML when closed, while letting the client
  // keep the element mounted so dialogElement.close() fires correctly.
  let mounted = $state(false);

  const reducedMotion = useReducedMotion();
  const bodyOverflowFade = overflowFade();
  // Owns focus capture/restore, body scroll lock, escape-stack participation
  // (a no-op handler — Modal handles Escape via the native <dialog> `cancel`
  // event, but still needs a stack entry so non-dialog overlays above it
  // route their own Escape correctly per OVERLAY-POLICY), and — the piece
  // Modal previously lacked entirely — a real exit-transition grace period.
  // This is the same shared mechanism Drawer and Sheet already use, so all
  // three dialog-based overlays animate symmetrically in and out.
  const dialogState = createSlidingDialogState({
    getOpen: () => open,
    setOpen: (nextOpen) => {
      open = nextOpen;
    },
    getDialogElement: () => dialogElement,
    getPanelElement: () => panelElement,
    getReducedMotion: () => reducedMotion.current,
    getTriggerRef: () => triggerRef,
    onOpen: () => {
      // Initial focus strategy:
      //   1. If a child carries `autofocus`, the native dialog already focused it.
      //   2. Otherwise, focus the body container (tabindex=-1) so initial focus
      //      lands on meaningful content rather than the close-X button — which
      //      would otherwise be the first sequentially-focusable element.
      // Check both the HTML attribute (set by static markup) and the DOM property
      // (set by Svelte 5's $.autofocus() helper, which sets element.autofocus = true
      // rather than the attribute). The attribute selector alone misses the Svelte case.
      const hasExplicitAutofocus =
        dialogElement?.querySelector('[autofocus]') !== null ||
        Array.from(dialogElement?.querySelectorAll<HTMLElement>('*') ?? []).some(
          (el) => el.autofocus === true,
        );
      if (!hasExplicitAutofocus && bodyElement) {
        bodyElement.focus();
      }
    },
  });

  $effect(() => {
    mounted = true;
  });

  $effect(() => {
    if (
      role === 'alertdialog' &&
      (dismissOnBackdropClick !== false ||
        dismissOnEscape !== false ||
        closeButtonVisible !== false)
    ) {
      devWarn(
        '[cinder/Modal] role="alertdialog" requires dismissOnBackdropClick={false}, dismissOnEscape={false}, and closeButtonVisible={false}. ' +
          'Without these, Escape or backdrop click can bypass the mandatory acknowledgement. ' +
          'Use <AlertDialog> instead, or pass all three companion props explicitly.',
      );
    }
  });

  $effect(() => {
    dialogState.syncOpenState();
  });

  // Single source of truth for all user-initiated dismissal paths: Escape, backdrop click,
  // and the close-X button. `open` flips FIRST (inside requestClose) so a thrown callback
  // does not leave the dialog's reactive state open. Callbacks are not awaited; sync throws
  // propagate to the caller.
  function dismiss() {
    dialogState.requestClose();
    onDismiss?.();
  }

  onDestroy(() => {
    dialogState.destroy();
  });

  function handleBackdropClick(event: MouseEvent) {
    if (dismissOnBackdropClick && event.target === dialogElement) {
      dismiss();
    }
  }

  function handleNativeCancel(event: Event) {
    // Escape key fires the native 'cancel' event on <dialog>. We prevent the default
    // so the browser doesn't close the dialog through its own mechanism — we route
    // exclusively through dismiss() → requestClose() → the exit transition → the real
    // 'close' event → dialogState.handleClose(). This ensures exactly one close path
    // for Escape.
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
    data-cinder-closing={dialogState.isClosing ? '' : undefined}
    onclose={() => dialogState.handleClose()}
    onclick={handleBackdropClick}
    oncancel={handleNativeCancel}
  >
    {#if dialogState.renderPanel}
      <!--
        The native <dialog> opened with showModal() already traps focus in
        supporting browsers. The shared focus-trap is a defence-in-depth fallback
        that keeps Tab / Shift+Tab cycling inside the panel; it carefully filters
        hidden/inert/disabled/`tabindex="-1"` elements. Modal owns its own initial
        focus (the body container, below) and focus restoration (via
        `dialogState`'s `getTriggerRef`), so the trap runs with
        `manageInitialFocus: false` and `restoreFocus: false` — without the
        former the trap would yank focus off the body onto the close button on
        the next microtask. `active` also drops during the closing transition
        so the trap stops enforcing tab-containment while the panel fades out.
      -->
      <div
        bind:this={panelElement}
        class="cinder-modal__panel"
        data-cinder-closing={dialogState.isClosing ? '' : undefined}
        inert={dialogState.isClosing}
        {@attach createFocusTrap({
          active: () => open && !dialogState.isClosing,
          restoreFocus: false,
          manageInitialFocus: false,
        })}
      >
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
        {#if closeButtonVisible}
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
