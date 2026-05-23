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

  import { captureFocus, lockBodyScroll, pushEscapeHandler } from '../../_internal/overlay.ts';
  import { waitForTransitionCompletion } from '../../_internal/transition-completion.ts';
  import { cn } from '../../utilities/class-names.ts';
  import { restoreFocusTo } from '../../utilities/focus.ts';
  import { useId } from '../../utilities/use-id.ts';
  import { useReducedMotion } from '../../utilities/use-reduced-motion.svelte.ts';

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

  const titleId = useId('cinder-sheet-title');

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
    } else {
      renderPanel = false;
      pendingOpenFocus = false;
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
    const candidates: Array<HTMLElement | null> = [triggerRef, capturedFocus];
    capturedFocus = null;
    for (const candidate of candidates) {
      if (restoreFocusTo(candidate)) break;
    }
  }

  function requestClose(): void {
    if (!open && (isClosing || !dialogElement?.open)) return;
    open = false;
    beginClosing();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === dialogElement) {
      requestClose();
    }
  }

  function handleNativeCancel(event: Event) {
    event.preventDefault();
    requestClose();
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
      const candidates: Array<HTMLElement | null> = [triggerRef, capturedFocus];
      capturedFocus = null;
      for (const candidate of candidates) {
        if (restoreFocusTo(candidate)) break;
      }
    }
  });
</script>

{#if hydrated}
  <dialog
    {...rest}
    bind:this={dialogElement}
    class={cn('cinder-sheet', className)}
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
        class="cinder-sheet__close"
        aria-label="Close sheet"
        onclick={requestClose}
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

    {#if renderPanel}
      <div
        bind:this={panelElement}
        class="cinder-sheet__panel"
        data-cinder-closing={isClosing ? '' : undefined}
        inert={isClosing}
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

        <div bind:this={bodyElement} class="cinder-sheet__body" tabindex="-1">
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
