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
   * @avoidWhen Presenting a small contextual surface anchored to a trigger — use a popover or a bottom-placed drawer instead.
   * @related confirm-dialog, alert-dialog, drawer, popover
   */
  export type { ModalProps } from './modal.types.ts';
</script>

<script lang="ts">
  import type { ModalProps } from './modal.types.ts';
  import { onDestroy } from 'svelte';
  import { BROWSER as browser } from 'esm-env';
  import { devWarn } from '../../utilities/dev-warn.ts';
  import { overflowFade } from '../../utilities/attachments.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';
  import { createFocusTrap } from '../focus-trap/index.ts';
  import {
    createSlidingDialogState,
    focusDialogBodyUnlessAutofocused,
  } from '../_internal/create-sliding-dialog-state.svelte.ts';

  /**
   * `typeof value === 'string'` first, THEN `.trim()` — a bare truthiness
   * check alone would let a non-string truthy value (e.g. an object slipping
   * through from dynamic/CMS-driven config that bypasses TypeScript) reach
   * `.trim()`, which does not exist on it, throwing inside the nameless-guard
   * $effect below and turning a dev-only warning into a hard crash. Accepts
   * `unknown` rather than `string | undefined` specifically because the
   * runtime value this guards against is exactly the case TypeScript's own
   * `string | undefined` type would already rule out.
   */
  function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim() !== '';
  }

  const titleId = $props.id();

  let {
    open = $bindable(false),
    title,
    chrome = 'default',
    'aria-label': ariaLabel,
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
    onExitComplete,
  }: ModalProps = $props();

  const isChromeless = $derived(chrome === 'none');

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
  // This is the same shared mechanism Drawer already uses, so all
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
    // Initial focus strategy: if a child carries `autofocus`, the native
    // dialog already focused it; otherwise focus the body container
    // (tabindex=-1) so initial focus lands on meaningful content rather than
    // the close-X button. The shared helper defers via tick() — onOpen fires
    // in the same effect that first sets renderPanel, before the panel
    // subtree (and the bodyElement binding) has flushed.
    onOpen: () =>
      focusDialogBodyUnlessAutofocused({
        getOpen: () => open,
        getDialogElement: () => dialogElement,
        getBodyElement: () => bodyElement,
      }),
    // Fires once the exit transition genuinely finishes and the panel
    // actually unmounts (not merely when `open` flips false) — see
    // `onExitComplete` on ModalProps. `SlidingDialogState` already skips
    // this callback on a reopen-during-close (the panel never actually
    // unmounts in that case), so no extra guard is needed here.
    onClosed: () => onExitComplete?.(),
  });

  $effect(() => {
    mounted = true;
  });

  // One-time SSR-to-client upgrade. When the modal starts open, the server
  // render emits the `open` HTML attribute directly on <dialog> (see the
  // `!browser` spread on the element below) so a deep-linked initially-open
  // modal is actually visible in the served HTML instead of `display:none`
  // per UA default styles until the client calls `showModal()`. A plain
  // attribute-open dialog is not a real top-layer modal, though — no
  // backdrop, no focus trap, no scroll lock, no escape-stack entry. Strip
  // the attribute (not `.close()` — that would fire the native `close`
  // event and route through `dialogState.handleClose()` as if a user had
  // dismissed it) so `dialogElement.open` reads false again; the
  // `syncOpenState()` effect below then takes its normal `!dialogElement.open`
  // branch and promotes it to a genuine `showModal()` dialog with all the
  // associated side effects. Runs once per mount, before `syncOpenState()`.
  $effect(() => {
    if (!browser) return;
    if (dialogElement?.hasAttribute('open')) {
      dialogElement.removeAttribute('open');
    }
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

  // Runtime nameless guard: the discriminated `chrome` union enforces this at
  // the type level, but a consumer building props dynamically (spread props,
  // a CMS-driven config, etc.) can still bypass TypeScript and render a
  // nameless dialog. Warn in both directions rather than assuming the type
  // system caught it.
  //
  // `isNonEmptyString` guards with `typeof value === 'string'` BEFORE
  // calling `.trim()` — a non-string truthy value (e.g. a stray object from
  // dynamic config bypassing TS) has no `.trim()` method and would otherwise
  // throw inside this $effect, turning a dev-only warning into a hard crash.
  // Any non-string value is treated as not a valid name.
  $effect(() => {
    if (!isChromeless && !isNonEmptyString(title)) {
      devWarn(
        '[cinder/Modal] rendered with chrome="default" but no non-empty `title`. ' +
          'The visible heading also supplies the accessible name — without it the dialog has no name for assistive technology.',
      );
    }
    if (isChromeless && !isNonEmptyString(ariaLabel)) {
      devWarn(
        '[cinder/Modal] rendered with chrome="none" but no non-empty `aria-label`. ' +
          "The chromeless chrome renders no header, so `aria-label` is the only source of the dialog's accessible name — without it the dialog has no name for assistive technology.",
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
    // Defensive: a native <dialog> shown via showModal() is promoted to the
    // browser's top layer, outside ordinary document flow. When a consumer
    // composes Modal behind its own conditional mount (e.g. clearing a
    // mount flag from `onExitComplete`, the same pattern Popover/
    // SelectionPopover support), the surrounding block's teardown can leave
    // this element attached even after this component instance is
    // destroyed — the top-layer promotion means it is not a normal
    // document-flow child removal. Explicitly detach it so no closed
    // <dialog> is ever left behind in the DOM.
    dialogElement?.remove();
  });

  function handleBackdropClick(event: MouseEvent) {
    if (!dismissOnBackdropClick) return;
    if (event.target === dialogElement) {
      dismiss();
      return;
    }
    if (!isChromeless) return;
    // Chromeless mode (chrome="none") fills the dialog's entire content box
    // with the panel/body — `dialogElement` itself has no visible padding
    // or gap left to click, so `event.target === dialogElement` can never
    // be true there. The panel and body ARE the backdrop-equivalent
    // surface for this chrome: a click that lands directly on either
    // (rather than on real content the consumer rendered inside them)
    // dismisses, the same way a default-chrome backdrop click does.
    if (event.target === panelElement || event.target === bodyElement) {
      dismiss();
      return;
    }
    // The canonical chromeless composition is a consumer-rendered root
    // child that fills the body (width/height 100%) — the panel/body check
    // above never fires there, since every empty-surface click's target is
    // that child, not the body. `data-cinder-modal-backdrop` is a
    // consumer-supplied marker (same idiom as OVERLAY-POLICY.md's
    // `data-cinder-initial-focus`): place it on your own full-bleed scrim
    // wrapper and a click landing DIRECTLY on that element (not on a
    // deeper descendant — real content still doesn't dismiss) is treated as
    // a backdrop click. This works regardless of how deeply the consumer's
    // content is nested, independent of the panel/body checks above.
    const targetElement = event.target;
    if (
      targetElement instanceof Element &&
      targetElement.hasAttribute('data-cinder-modal-backdrop')
    ) {
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
    data-cinder-chrome={isChromeless ? 'none' : undefined}
    {...isChromeless ? { 'aria-label': ariaLabel } : { 'aria-labelledby': titleId }}
    {...describedById ? { 'aria-describedby': describedById } : {}}
    data-cinder-closing={dialogState.isClosing ? '' : undefined}
    {...!browser && open ? { open: true } : {}}
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
        data-cinder-chrome={isChromeless ? 'none' : undefined}
        data-cinder-closing={dialogState.isClosing ? '' : undefined}
        inert={dialogState.isClosing}
        {@attach createFocusTrap({
          active: () => open && !dialogState.isClosing,
          restoreFocus: false,
          manageInitialFocus: false,
        })}
      >
        {#if !isChromeless}
          <div class="cinder-modal__header">
            <h2 id={titleId} class="cinder-modal__title">{title}</h2>
          </div>
        {/if}

        <div
          bind:this={bodyElement}
          class="cinder-modal__body cinder-_scroll-fade"
          data-cinder-chrome={isChromeless ? 'none' : undefined}
          tabindex="-1"
          {@attach bodyOverflowFade}
        >
          {@render children()}
        </div>

        {#if footer}
          <div class="cinder-modal__footer" data-cinder-chrome={isChromeless ? 'none' : undefined}>
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
