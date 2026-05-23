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
  import { onDestroy, tick } from 'svelte';

  import { captureFocus, lockBodyScroll, pushEscapeHandler } from '../../_internal/overlay.ts';
  import { waitForTransitionCompletion } from '../../_internal/transition-completion.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { restoreFocusTo } from '../../utilities/focus.ts';
  import { useId } from '../../utilities/use-id.ts';
  import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';

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

  const titleId = useId('cinder-drawer-title');

  let dialogElement: HTMLDialogElement | undefined = $state();
  let bodyElement: HTMLDivElement | undefined = $state();
  let panelElement: HTMLDivElement | undefined = $state();
  let hydrated = $state(false);
  let renderPanel = $state(open);
  let isClosing = $state(false);
  let closeGeneration = $state(0);
  let pendingOpenFocus = $state(false);

  let capturedFocus: HTMLElement | null = null;
  let releaseScrollLock: (() => void) | null = null;
  let releaseEscape: (() => void) | null = null;
  let cancelPendingClose: (() => void) | null = null;

  const reducedMotion = useReducedMotion();

  function acquireScrollLock(): void {
    if (releaseScrollLock) return;
    releaseScrollLock = lockBodyScroll();
  }

  function acquireEscapeMarker(): void {
    if (releaseEscape) return;
    // No-op handler: presence marker so stacked non-dialog overlays
    // route ESC to themselves. Native <dialog> owns the actual ESC close.
    releaseEscape = pushEscapeHandler(() => {});
  }

  $effect(() => {
    hydrated = true;
  });

  $effect(() => {
    if (!dialogElement) return;
    if (open) {
      if (isClosing) {
        closeGeneration += 1;
        cancelPendingClose?.();
        cancelPendingClose = null;
        isClosing = false;
      }

      if (!renderPanel) {
        renderPanel = true;
      }

      if (!dialogElement.open) {
        capturedFocus = captureFocus();
        pendingOpenFocus = true;
        dialogElement.showModal();
        acquireScrollLock();
        acquireEscapeMarker();
      }
      return;
    }

    if (dialogElement.open) {
      beginClosing();
    }
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

  function beginClosing(): void {
    if (!dialogElement?.open || isClosing) return;
    if (!panelElement) {
      finishClosing(closeGeneration);
      return;
    }

    isClosing = true;
    const generation = ++closeGeneration;
    cancelPendingClose?.();
    cancelPendingClose = waitForTransitionCompletion({
      element: panelElement,
      reducedMotion: reducedMotion.current,
      onComplete: () => finishClosing(generation),
    });
  }

  function finishClosing(generation: number): void {
    if (generation !== closeGeneration) return;
    cancelPendingClose?.();
    cancelPendingClose = null;
    isClosing = false;
    renderPanel = false;
    pendingOpenFocus = false;
    if (dialogElement?.open) {
      dialogElement.close();
    }
  }

  function handleClose() {
    if (releaseScrollLock) {
      releaseScrollLock();
      releaseScrollLock = null;
    }
    if (releaseEscape) {
      releaseEscape();
      releaseEscape = null;
    }
    open = false;
    returnFocus();
  }

  function requestClose(): void {
    if (!open && (isClosing || !dialogElement?.open)) return;
    open = false;
    beginClosing();
  }

  // Iterate candidates so a disconnected `triggerRef` falls through to the
  // captured pre-open focus. Matches modal/sheet/popover/command-palette.
  function returnFocus(): void {
    const candidates: Array<HTMLElement | null> = [triggerRef, capturedFocus];
    for (const candidate of candidates) {
      if (restoreFocusTo(candidate)) break;
    }
    capturedFocus = null;
  }

  function handleNativeCancel(event: Event) {
    // The browser's native ESC handler on <dialog> fires `cancel` then closes
    // the dialog. preventDefault keeps the close out of the native path so it
    // goes through `dialogElement.close()` here — which fires the `close`
    // event and lets handleClose() run as the single canonical close path.
    // This matches modal.svelte's pattern; without it, ESC would close the
    // dialog out from under Svelte's `open` state for one tick.
    event.preventDefault();
    requestClose();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === dialogElement) {
      requestClose();
    }
  }

  onDestroy(() => {
    cancelPendingClose?.();
    cancelPendingClose = null;
    const wasOpen = releaseScrollLock !== null || releaseEscape !== null;
    if (releaseScrollLock) {
      releaseScrollLock();
      releaseScrollLock = null;
    }
    if (releaseEscape) {
      releaseEscape();
      releaseEscape = null;
    }
    if (wasOpen) {
      returnFocus();
    }
  });
</script>

{#if hydrated}
  <dialog
    {...rest}
    bind:this={dialogElement}
    class={classNames('cinder-drawer', className)}
    aria-modal="true"
    aria-labelledby={ariaLabelledBy ?? titleId}
    data-cinder-closing={isClosing ? '' : undefined}
    onclose={handleClose}
    oncancel={handleNativeCancel}
    onclick={handleBackdropClick}
  >
    {#snippet closeButton()}
      <button
        type="button"
        class="cinder-drawer__close"
        aria-label="Close drawer"
        onclick={requestClose}
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

    {#if renderPanel}
      <div
        bind:this={panelElement}
        class="cinder-drawer__panel"
        data-cinder-side={side}
        data-cinder-size={size}
        data-cinder-closing={isClosing ? '' : undefined}
        inert={isClosing}
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

        <div bind:this={bodyElement} class="cinder-drawer__body" tabindex="-1">
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
