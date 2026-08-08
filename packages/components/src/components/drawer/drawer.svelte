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
  import type { DrawerProps } from './drawer.types.ts';
  import { onDestroy } from 'svelte';

  import { overflowFade } from '../../utilities/attachments.ts';
  import { classNames } from '../../utilities/class-names.ts';
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

  let dialogElement: HTMLDialogElement | undefined = $state();
  let bodyElement: HTMLDivElement | undefined = $state();
  let panelElement: HTMLDivElement | undefined = $state();
  /**
   * The placement that was active when the current open/close cycle began.
   * Snapshotted at open time so that a placement-prop change while the drawer
   * is open or closing does not flip the slide direction mid-animation.
   * Only updated when the drawer actually (re)opens a new cycle.
   */
  let activePlacement = $state(placement);

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

  $effect(() => {
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

  onDestroy(() => {
    dialogState.destroy();
  });
</script>

{#if dialogState.hydrated}
  <dialog
    {...rest}
    bind:this={dialogElement}
    class={classNames('cinder-drawer', className)}
    aria-modal="true"
    aria-labelledby={ariaLabelledby ?? titleId}
    data-cinder-closing={dialogState.isClosing ? '' : undefined}
    onclose={() => dialogState.handleClose()}
    oncancel={(event) => dialogState.handleNativeCancel(event)}
    onclick={(event) => dialogState.handleBackdropClick(event)}
  >
    {#snippet closeButton()}
      <button
        type="button"
        class="cinder-drawer__close"
        aria-label="Close drawer"
        onclick={() => dialogState.requestClose()}
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
    {/snippet}

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
        data-cinder-placement={activePlacement}
        data-cinder-size={size}
        data-cinder-closing={dialogState.isClosing ? '' : undefined}
        inert={dialogState.isClosing}
        {@attach createFocusTrap({
          active: () => open && !dialogState.isClosing,
          restoreFocus: false,
          manageInitialFocus: false,
        })}
      >
        {#if dragHandleVisible && activePlacement === 'bottom'}
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
          {@render closeButton()}
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
{/if}
