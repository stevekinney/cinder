<script lang="ts" module>
  /**
   * @cinder
   * @category overlay
   * @status stable
   * @purpose Bottom-anchored modal panel built on the native dialog element with an optional drag handle for mobile-first sheet patterns.
   * @tag overlay
   * @tag dialog
   * @useWhen Presenting a focused task or set of actions that slides up from the bottom of the viewport on touch surfaces.
   * @useWhen Showing a contextual surface that should feel anchored to the screen edge rather than centered like a modal.
   * @avoidWhen Interrupting the user with a centered task or confirmation — use modal instead.
   * @avoidWhen Showing supplementary side navigation or filters — use drawer or popover.
   * @related modal, drawer, popover
   */
  export type { SheetProps } from './sheet.types.ts';
</script>

<script lang="ts">
  import type { SheetProps } from './sheet.types.ts';
  import { onDestroy, tick } from 'svelte';

  import { overflowFade } from '../../utilities/attachments.ts';
  import { createFocusTrap } from '../focus-trap/index.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';
  import { createSlidingDialogState } from '../_internal/create-sliding-dialog-state.svelte.ts';

  let {
    open = $bindable(false),
    title,
    class: className,
    triggerRef = null,
    ariaLabelledBy,
    showDragHandle = false,
    header,
    children,
    footer,
    ...rest
  }: SheetProps = $props();

  const titleId = $props.id();

  let dialogElement: HTMLDialogElement | undefined = $state();
  let bodyElement: HTMLDivElement | undefined = $state();
  let panelElement: HTMLDivElement | undefined = $state();
  let pendingOpenFocus = $state(false);

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
    onOpen: () => {
      pendingOpenFocus = true;
    },
    onClosed: () => {
      pendingOpenFocus = false;
    },
  });

  $effect(() => {
    dialogState.markHydrated();
  });

  $effect(() => {
    dialogState.syncOpenState();
  });

  $effect(() => {
    if (!pendingOpenFocus || !dialogElement?.open) return;
    pendingOpenFocus = false;
    void tick().then(() => {
      if (!open || !dialogElement?.open) return;
      const hasExplicitAutofocus =
        dialogElement.querySelector('[autofocus]') !== null ||
        Array.from(dialogElement.querySelectorAll<HTMLElement>('*')).some(
          (element) => element.autofocus === true,
        );
      if (!hasExplicitAutofocus && bodyElement) {
        bodyElement.focus();
      }
    });
  });

  onDestroy(() => {
    dialogState.destroy();
  });
</script>

{#if dialogState.hydrated}
  <dialog
    {...rest}
    bind:this={dialogElement}
    class={classNames('cinder-sheet', className)}
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
        class="cinder-sheet__close"
        aria-label="Close sheet"
        onclick={() => dialogState.requestClose()}
      >
        <svg
          class="cinder-sheet__close-icon"
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
      <div
        bind:this={panelElement}
        class="cinder-sheet__panel"
        data-cinder-closing={dialogState.isClosing ? '' : undefined}
        inert={dialogState.isClosing}
        {@attach createFocusTrap({
          active: () => open && !dialogState.isClosing,
          restoreFocus: false,
          manageInitialFocus: false,
        })}
      >
        {#if showDragHandle}
          <div class="cinder-sheet__drag-handle" aria-hidden="true">
            <span class="cinder-sheet__drag-handle-pill"></span>
          </div>
        {/if}

        <header class="cinder-sheet__header">
          {#if header}
            {#if !ariaLabelledBy}
              <h2 id={titleId} class="cinder-sr-only">{title}</h2>
            {/if}
            {@render header()}
          {:else}
            <h2 id={titleId} class="cinder-sheet__title">{title}</h2>
          {/if}
          {@render closeButton()}
        </header>

        <div
          bind:this={bodyElement}
          class="cinder-sheet__body"
          tabindex="-1"
          {@attach bodyOverflowFade}
        >
          {@render children()}
        </div>

        {#if footer}
          <div class="cinder-sheet__footer">
            {@render footer()}
          </div>
        {/if}
      </div>
    {/if}
  </dialog>
{/if}
