<script lang="ts" module>
  import type { Snippet } from 'svelte';
  import type { HTMLDialogAttributes } from 'svelte/elements';

  export type DrawerSide = 'left' | 'right';
  export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl';

  export type DrawerProps = {
    /** Whether the drawer is open. Bindable via `bind:open`. */
    open?: boolean;
    /** Edge the drawer slides in from. Default `right`. */
    side?: DrawerSide;
    /** Drawer width token. Default `md`. */
    size?: DrawerSize;
    /**
     * Accessible name for the drawer. Required for screen-reader labelling.
     * Rendered as a visible `<h2>` in the default header. When a custom
     * `header` snippet is provided without `ariaLabelledBy`, this text is
     * rendered in a visually-hidden `<h2>` as the accessible name fallback.
     */
    title: string;
    /** Additional class names merged with `.cinder-drawer`. */
    class?: string;
    /**
     * Optional reference to the element that opened the drawer. When supplied,
     * focus returns to this element on close. When omitted, focus restores to
     * the element that held focus before the drawer opened.
     */
    triggerRef?: HTMLElement | null;
    /**
     * Optional id of an element that names the drawer. When supplied, drawer
     * wires `aria-labelledby` to this id and renders no internal heading.
     * Use this when a custom `header` snippet has its own visible heading —
     * supply `ariaLabelledBy` pointing to that heading's id so the
     * visible and accessible names stay in sync.
     */
    ariaLabelledBy?: string;
    /** Custom header. Falls back to a default header that renders `title`. */
    header?: Snippet;
    /** Drawer body content. Required. */
    children: Snippet;
    /** Optional footer (e.g. action buttons). */
    footer?: Snippet;
  } & Omit<
    HTMLDialogAttributes,
    | 'open'
    | 'class'
    | 'children'
    | 'aria-labelledby'
    | 'aria-modal'
    | 'role'
    | 'onclose'
    | 'oncancel'
    | 'onclick'
  >;
</script>

<script lang="ts">
  import { onDestroy } from 'svelte';

  import {
    captureFocus,
    lockBodyScroll,
    pushEscapeHandler,
    restoreFocusTo,
  } from '../_internal/overlay.ts';
  import { cn } from '../utilities/class-names.ts';
  import { useId } from '../utilities/use-id.ts';

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
  const effectiveLabelledBy = $derived(ariaLabelledBy ?? titleId);

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
    class={cn('cinder-drawer', className)}
    aria-modal="true"
    aria-labelledby={effectiveLabelledBy}
    onclose={handleClose}
    onclick={handleBackdropClick}
  >
    {#if open}
      <div class="cinder-drawer__panel" data-cinder-side={side} data-cinder-size={size}>
        {#if header}
          <header class="cinder-drawer__header">
            {#if !ariaLabelledBy}
              <h2 id={titleId} class="cinder-sr-only">{title}</h2>
            {/if}
            {@render header()}
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
          </header>
        {:else}
          <header class="cinder-drawer__header">
            <h2 id={titleId} class="cinder-drawer__title">{title}</h2>
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
          </header>
        {/if}

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
