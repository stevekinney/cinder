<script lang="ts" module>
  export type { DrawerProps, DrawerSide, DrawerSize } from './drawer.types.ts';
</script>

<script lang="ts">
  import type { DrawerProps } from './drawer.types.ts';
  import { onDestroy } from 'svelte';

  import { captureFocus, lockBodyScroll, pushEscapeHandler } from '../../_internal/overlay.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { restoreFocusTo } from '../../utilities/focus.ts';
  import { useId } from '../../utilities/use-id.ts';

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
  let hydrated = $state(false);

  let capturedFocus: HTMLElement | null = null;
  let releaseScrollLock: (() => void) | null = null;
  let releaseEscape: (() => void) | null = null;

  $effect(() => {
    hydrated = true;
  });

  $effect(() => {
    if (!dialogElement) return;
    if (open && !dialogElement.open) {
      capturedFocus = captureFocus();
      dialogElement.showModal();
      releaseScrollLock = lockBodyScroll();
      // No-op handler: presence marker so stacked non-dialog overlays
      // route ESC to themselves. Native <dialog> owns the actual ESC close.
      releaseEscape = pushEscapeHandler(() => {});
      const hasAutofocus = dialogElement.querySelector('[autofocus]') !== null;
      if (!hasAutofocus && bodyElement) {
        bodyElement.focus();
      }
    } else if (!open && dialogElement.open) {
      dialogElement.close();
    }
  });

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
    const target = triggerRef ?? capturedFocus;
    capturedFocus = null;
    restoreFocusTo(target);
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === dialogElement) {
      dialogElement?.close();
    }
  }

  onDestroy(() => {
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
      const target = triggerRef ?? capturedFocus;
      capturedFocus = null;
      if (target) restoreFocusTo(target);
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
    onclose={handleClose}
    onclick={handleBackdropClick}
  >
    {#snippet closeButton()}
      <button
        type="button"
        class="cinder-drawer__close"
        aria-label="Close drawer"
        onclick={() => dialogElement?.close()}
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

    {#if open}
      <div class="cinder-drawer__panel" data-cinder-side={side} data-cinder-size={size}>
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
