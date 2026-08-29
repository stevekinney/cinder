<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status stable
   * @purpose Edge-anchored modal panel built on the native dialog element; slides from the left, right, or bottom edge for secondary navigation, settings, or mobile-first sheet patterns.
   * @tag overlay
   * @tag dialog
   * @useWhen Showing supplementary navigation, filters, or settings that should slide in from a page edge.
   * @useWhen Presenting long-form content that benefits from a side panel without leaving the current view.
   * @useWhen Presenting a focused task or set of actions that slides up from the bottom of the viewport on touch surfaces — use `placement="bottom"`.
   * @avoidWhen Interrupting the user for a focused decision — use modal so the surface is centered and task-scoped.
   * @avoidWhen Anchoring a small surface to a trigger — use popover instead.
   * @related modal, popover
   */
  export type { DrawerProps, DrawerPlacement, DrawerSize } from './drawer.types.ts';
</script>

<script lang="ts">
  import type { DrawerPlacement, DrawerProps } from './drawer.types.ts';
  import { onDestroy, untrack } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  import { pushEscapeHandler } from '../../_internal/overlay.ts';
  import { overflowFade } from '../../utilities/attachments.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { restoreFocusTo } from '../../utilities/focus.ts';
  import { createFocusTrap } from '../focus-trap/index.ts';
  import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';
  import {
    createSlidingDialogState,
    focusDialogBodyUnlessAutofocused,
  } from '../_internal/create-sliding-dialog-state.svelte.ts';

  let {
    open = $bindable(false),
    placement = 'right',
    size = 'md',
    modal = true,
    title,
    class: className,
    triggerRef = null,
    ariaLabelledby,
    dragHandleVisible = false,
    header,
    children,
    footer,
    ...rest
  }: DrawerProps = $props();

  const titleId = $props.id();
  const nonModalPortalScopeId = `${titleId}-scope`;
  const asideAttributes = $derived(rest as HTMLAttributes<HTMLElement>);

  let dialogElement: HTMLDialogElement | undefined = $state();
  let bodyElement: HTMLDivElement | undefined = $state();
  let panelElement: HTMLDivElement | undefined = $state();
  let nonModalAsideElement: HTMLElement | undefined = $state();
  let nonModalPanelElement: HTMLDivElement | undefined = $state();
  let nonModalReturnFocusTarget: HTMLElement | null = null;
  let wasNonModalOpen = false;
  let wasModal = $state(untrack(() => modal));
  /**
   * The placement that was active when the current open/close cycle began.
   * Snapshotted at open time so that a placement-prop change while the drawer
   * is open or closing does not flip the slide direction mid-animation.
   * Only updated when the drawer actually (re)opens a new cycle.
   */
  let activePlacement = $state<DrawerPlacement>();

  function isValidNonModalFocusTarget(target: HTMLElement | null): target is HTMLElement {
    return (
      target !== null &&
      target.isConnected &&
      target.ownerDocument === document &&
      !nonModalAsideElement?.contains(target)
    );
  }

  const reducedMotion = useReducedMotion();
  const bodyOverflowFade = overflowFade();
  const dialogState = createSlidingDialogState({
    getOpen: () => open,
    setOpen: (nextOpen) => {
      open = nextOpen;
    },
    getDialogElement: () => dialogElement,
    getPanelElement: () => panelElement,
    getReducedMotion: () => reducedMotion.current,
    getTriggerRef: () => triggerRef,
    onClosed: () => {
      activePlacement = undefined;
    },
    // Host-managed initial focus (the Modal policy, via the trap's
    // `manageInitialFocus: false` opt-out): focus the body container unless a
    // child is autofocused, so opening never lands focus on the close button.
    onOpen: () =>
      focusDialogBodyUnlessAutofocused({
        getOpen: () => open,
        getDialogElement: () => dialogElement,
        getBodyElement: () => bodyElement,
      }),
  });

  $effect(() => {
    dialogState.markHydrated();
  });

  $effect.pre(() => {
    if (!modal || !open || activePlacement) return;
    activePlacement = placement;
  });

  $effect(() => {
    if (wasModal && !modal) {
      activePlacement = undefined;
      dialogState.releaseModalState();
    }
    wasModal = modal;
  });

  $effect(() => {
    if (!modal) return;
    if (open) {
      if (dialogState.isClosing) {
        // Quick-reopen while a close transition is still running.
        // Snapshot the current placement so the reversal / re-entry animation
        // uses the edge the user expects for this new open intent.
        activePlacement = placement;
      }

      if (!dialogState.renderPanel) {
        // Fresh mount — snapshot the placement for this open cycle so any
        // later placement-prop change while open or closing does not flip
        // the direction.
        activePlacement = placement;
      }
    }
    dialogState.syncOpenState();
  });

  $effect(() => {
    if (modal || !dialogState.hydrated || !open) return;
    return pushEscapeHandler((event) => {
      event.preventDefault();
      open = false;
    });
  });

  $effect(() => {
    if (modal || !dialogState.hydrated) {
      wasNonModalOpen = false;
      nonModalReturnFocusTarget = null;
      return;
    }

    if (open && !wasNonModalOpen) {
      const activeElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      nonModalReturnFocusTarget =
        (isValidNonModalFocusTarget(triggerRef) && triggerRef) ||
        (isValidNonModalFocusTarget(activeElement) && activeElement) ||
        null;
      wasNonModalOpen = true;
      return;
    }

    if (!open && wasNonModalOpen) {
      wasNonModalOpen = false;
      const returnTarget =
        (isValidNonModalFocusTarget(triggerRef) ? triggerRef : null) ?? nonModalReturnFocusTarget;
      nonModalReturnFocusTarget = null;
      const activeElement = document.activeElement;
      if (
        activeElement === document.body ||
        (activeElement instanceof HTMLElement && nonModalPanelElement?.contains(activeElement))
      ) {
        restoreFocusTo(returnTarget);
      }
      activePlacement = undefined;
    }
  });

  onDestroy(() => {
    if (!modal && wasNonModalOpen) {
      const activeElement = document.activeElement;
      if (
        activeElement === document.body ||
        (activeElement instanceof HTMLElement && nonModalPanelElement?.contains(activeElement))
      ) {
        restoreFocusTo(
          (isValidNonModalFocusTarget(triggerRef) ? triggerRef : null) ?? nonModalReturnFocusTarget,
        );
      }
    }
    dialogState.destroy();
  });

  function requestDrawerClose(): void {
    if (modal) {
      dialogState.requestClose();
      return;
    }
    open = false;
  }
</script>

{#if dialogState.hydrated || (!modal && open)}
  {#if modal}
    <dialog
      {...rest}
      bind:this={dialogElement}
      class={classNames('cinder-drawer', className)}
      aria-modal="true"
      aria-labelledby={ariaLabelledby ?? titleId}
      data-cinder-modal="true"
      data-cinder-closing={dialogState.isClosing ? '' : undefined}
      onclose={() => dialogState.handleClose()}
      oncancel={(event) => dialogState.handleNativeCancel(event)}
      onclick={(event) => dialogState.handleBackdropClick(event)}
    >
      {#if dialogState.renderPanel}
        <!--
          The native <dialog> (showModal) traps focus in supporting browsers; the
          shared focus-trap is the defence-in-depth fallback. The Drawer owns
          both focus restoration (returnFocus) and initial focus (the body-focus
          effect above), so the trap runs with `restoreFocus: false` and
          `manageInitialFocus: false`.
        -->
        <div
          bind:this={panelElement}
          class="cinder-drawer__panel"
          data-cinder-placement={activePlacement ?? placement}
          data-cinder-size={size}
          data-cinder-closing={dialogState.isClosing ? '' : undefined}
          inert={dialogState.isClosing}
          {@attach createFocusTrap({
            active: () => open && !dialogState.isClosing,
            restoreFocus: false,
            manageInitialFocus: false,
          })}
        >
          {#if dragHandleVisible && (activePlacement ?? placement) === 'bottom'}
            <div class="cinder-drawer__drag-handle" aria-hidden="true">
              <span class="cinder-drawer__drag-handle-pill"></span>
            </div>
          {/if}

          <header class="cinder-drawer__header">
            {#if header}
              {#if !ariaLabelledby}
                <h2 id={titleId} class="cinder-sr-only">{title}</h2>
              {/if}
              {@render header()}
            {:else}
              <h2 id={titleId} class="cinder-drawer__title">{title}</h2>
            {/if}
            <button
              type="button"
              class="cinder-drawer__close"
              aria-label="Close drawer"
              onclick={requestDrawerClose}
            >
              <svg
                class="cinder-drawer__close-icon"
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
          </header>

          <div
            bind:this={bodyElement}
            class="cinder-drawer__body cinder-_scroll-fade"
            tabindex="-1"
            {@attach bodyOverflowFade}
          >
            {@render children()}
          </div>

          {#if footer}
            <div class="cinder-drawer__footer">
              {@render footer()}
            </div>
          {/if}
        </div>
      {/if}
    </dialog>
  {:else if open}
    <aside
      bind:this={nonModalAsideElement}
      {...asideAttributes}
      class={classNames('cinder-drawer', className)}
      aria-labelledby={ariaLabelledby ?? titleId}
      data-cinder-modal="false"
      data-cinder-portal-owner={nonModalPortalScopeId}
    >
      <div id={nonModalPortalScopeId} class="cinder-drawer__portal-scope"></div>
      <div
        bind:this={nonModalPanelElement}
        class="cinder-drawer__panel"
        data-cinder-placement={placement}
        data-cinder-size={size}
      >
        {#if dragHandleVisible && placement === 'bottom'}
          <div class="cinder-drawer__drag-handle" aria-hidden="true">
            <span class="cinder-drawer__drag-handle-pill"></span>
          </div>
        {/if}

        <header class="cinder-drawer__header">
          {#if header}
            {#if !ariaLabelledby}
              <h2 id={titleId} class="cinder-sr-only">{title}</h2>
            {/if}
            {@render header()}
          {:else}
            <h2 id={titleId} class="cinder-drawer__title">{title}</h2>
          {/if}
          <button
            type="button"
            class="cinder-drawer__close"
            aria-label="Close drawer"
            onclick={requestDrawerClose}
          >
            <svg
              class="cinder-drawer__close-icon"
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
        </header>

        <div
          bind:this={bodyElement}
          class="cinder-drawer__body cinder-_scroll-fade"
          tabindex="-1"
          {@attach bodyOverflowFade}
        >
          {@render children()}
        </div>

        {#if footer}
          <div class="cinder-drawer__footer">
            {@render footer()}
          </div>
        {/if}
      </div>
    </aside>
  {/if}
{/if}
