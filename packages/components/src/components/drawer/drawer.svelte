<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status stable
   * @purpose Side-anchored modal panel built on the native dialog element for secondary navigation, settings, or long-form supporting content.
   * @tag overlay
   * @tag dialog
   * @useWhen Showing supplementary navigation, filters, or settings that should slide in from a page edge.
   * @useWhen Presenting long-form content that benefits from a side panel without leaving the current view.
   * @avoidWhen Interrupting the user for a focused decision — use modal so the surface is centered and task-scoped.
   * @avoidWhen Anchoring a small surface to a trigger — use popover or sheet instead.
   * @related modal, sheet, popover
   */
  export type { DrawerProps, DrawerSide, DrawerSize } from './drawer.types.ts';
</script>

<script lang="ts">
  import type { DrawerProps } from './drawer.types.ts';
  import { onDestroy } from 'svelte';

  import { overflowFade } from '../../utilities/attachments.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { createFocusTrap } from '../focus-trap/index.ts';
  import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';
  import { createSlidingDialogState } from '../_internal/create-sliding-dialog-state.svelte.ts';

  let {
    open = $bindable(false),
    side = 'right',
    size = 'md',
    title,
    class: className,
    triggerRef = null,
    ariaLabelledBy,
    header,
    children,
    footer,
    ...rest
  }: DrawerProps = $props();

  const titleId = $props.id();

  let dialogElement: HTMLDialogElement | undefined = $state();
  let panelElement: HTMLDivElement | undefined = $state();
  /**
   * The side that was active when the current open/close cycle began.
   * Snapshotted at open time so that a side-prop change while the drawer
   * is open or closing does not flip the slide direction mid-animation.
   * Only updated when the drawer actually (re)opens a new cycle.
   */
  let activeSide = $state(side);

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
  });

  $effect(() => {
    dialogState.markHydrated();
  });

  $effect(() => {
    if (open) {
      if (dialogState.isClosing) {
        // Quick-reopen while a close transition is still running.
        // Snapshot the current side so the reversal / re-entry animation
        // uses the side the user expects for this new open intent.
        activeSide = side;
      }

      if (!dialogState.renderPanel) {
        // Fresh mount — snapshot the side for this open cycle so any later
        // side-prop change while open or closing does not flip the direction.
        activeSide = side;
      }
    }
    dialogState.syncOpenState();
  });

  /**
   * Resolve the drawer's initial focus target for the shared focus trap.
   *
   * When the consumer marked a child with `autofocus`, the native <dialog>
   * already focused it — honour that by handing the element back so the trap
   * does not steal focus to the first tabbable. Otherwise return `null`, which
   * lets `createFocusTrap` fall through to the first tabbable element inside the
   * drawer — typically the close button. (The Drawer passes no `fallbackFocus`,
   * so when there is nothing tabbable the trap focuses the trap root itself;
   * unlike Modal/Sheet, the Drawer does not opt into host-managed body focus.)
   * This replaces the prior ad-hoc selector, which accepted any `[tabindex]`
   * other than `-1` (e.g. `-2`) and CSS-hidden elements that are not
   * Tab-reachable.
   */
  function resolveInitialFocus(): HTMLElement | null {
    if (!dialogElement) return null;
    const explicitlyAutofocused =
      dialogElement.querySelector<HTMLElement>('[autofocus]') ??
      Array.from(dialogElement.querySelectorAll<HTMLElement>('*')).find(
        (element) => element.autofocus === true,
      ) ??
      null;
    return explicitlyAutofocused;
  }

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
    aria-labelledby={ariaLabelledBy ?? titleId}
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
        shared focus-trap is the defence-in-depth fallback and owns initial focus.
        It carefully filters hidden/inert/disabled/`tabindex="-1"` elements, so it
        replaces the prior ad-hoc selector. Drawer owns focus restoration
        (returnFocus), so the trap runs with `restoreFocus: false`.
      -->
      <div
        bind:this={panelElement}
        class="cinder-drawer__panel"
        data-cinder-side={activeSide}
        data-cinder-size={size}
        data-cinder-closing={dialogState.isClosing ? '' : undefined}
        inert={dialogState.isClosing}
        {@attach createFocusTrap({
          active: () => open && !dialogState.isClosing,
          restoreFocus: false,
          initialFocus: resolveInitialFocus,
        })}
      >
        <header class="cinder-drawer__header">
          {#if header}
            {#if !ariaLabelledBy}
              <h2 id={titleId} class="cinder-sr-only">{title}</h2>
            {/if}
            {@render header()}
          {:else}
            <h2 id={titleId} class="cinder-drawer__title">{title}</h2>
          {/if}
          {@render closeButton()}
        </header>

        <div class="cinder-drawer__body" tabindex="-1" {@attach bodyOverflowFade}>
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
