<script lang="ts" module>
  export type LightboxImage = {
    src: string;
    alt: string;
  };

  export type ImageLightboxProps = {
    /** Images to display in the lightbox */
    images: LightboxImage[];
    /** Index of the image to show initially */
    initialIndex?: number;
    /** Whether the lightbox is open */
    open?: boolean;
    /** Called when the lightbox is closed */
    onClose?: () => void;
  };
</script>

<script lang="ts">
  import { ChevronLeft, ChevronRight, X } from '@lostgradient/cinder/icons';
  import { Modal } from '@lostgradient/cinder/modal';

  let { images, initialIndex = 0, open = $bindable(false), onClose }: ImageLightboxProps = $props();

  // clampedInitialIndex is the clamped version of the `initialIndex` prop.
  const clampedInitialIndex = $derived(
    images.length > 0 ? Math.max(0, Math.min(initialIndex, images.length - 1)) : 0,
  );

  // navigationIndex is null when no user navigation has occurred in the current
  // open session. effectiveIndex falls back to clampedInitialIndex.
  //
  // Reset semantics WITHOUT a write-back loop: when the lightbox is closed
  // (`open === false`) effectiveIndex ignores navigationIndex entirely, so the
  // displayed index is always clampedInitialIndex while closed — regardless of
  // how it was closed (the close() button, Escape via Modal, OR a parent
  // setting `bind:open` false). On the next open, a single guarded $effect
  // clears the stale navigationIndex so navigation starts fresh from
  // initialIndex. This effect only writes navigationIndex in response to
  // `open` (two distinct values), so it is not the read-and-write-back-the-
  // same-bindable pattern #464 removes.
  let navigationIndex = $state<number | null>(null);
  const effectiveIndex = $derived(
    open ? (navigationIndex ?? clampedInitialIndex) : clampedInitialIndex,
  );
  $effect(() => {
    if (!open && navigationIndex !== null) {
      navigationIndex = null;
    }
  });

  const hasMultiple = $derived(images.length > 1);
  const currentImage = $derived(images[effectiveIndex]);
  const counterText = $derived(`${effectiveIndex + 1} of ${images.length}`);

  // The single path for a lightbox-initiated close (the close button, or a
  // click on the backdrop area around the image). `open` flips first so a
  // thrown onClose callback does not leave the lightbox's reactive state open.
  function close() {
    navigationIndex = null;
    open = false;
    onClose?.();
  }

  // Modal's own dismiss paths (Escape, and its own backdrop-click handling)
  // route through `onDismiss` instead of our `close()` — Modal has already
  // flipped `open` to false by the time this fires, via the coordinated
  // SlidingDialogState lifecycle (focus trap, scroll lock, escape-stack
  // participation, exit-transition) that Modal owns entirely. We only need to
  // mirror close()'s bookkeeping: reset navigation state and forward onClose.
  function handleModalDismiss() {
    navigationIndex = null;
    onClose?.();
  }

  function previous() {
    navigationIndex = (effectiveIndex - 1 + images.length) % images.length;
  }

  function next() {
    navigationIndex = (effectiveIndex + 1) % images.length;
  }

  // Clicking the content wrapper directly (not the image or a button) closes
  // the lightbox, matching a backdrop-click dismissal. Modal's own
  // dismissOnBackdropClick only fires when the click lands on the <dialog>
  // element itself, which chrome="none" full-bleed content covers entirely —
  // this handler is what makes "click outside the image" work.
  function handleContentClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      close();
    }
  }

  // Arrow-key navigation is the one piece of lightbox-specific keyboard
  // handling Modal does not own. Escape is handled entirely by Modal (native
  // <dialog> `cancel` event, routed through the shared LIFO escape stack via
  // `pushEscapeHandler` — see OVERLAY-POLICY.md § Escape priority) — this
  // component no longer has its own Escape handler.
  function handleKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowLeft':
        if (hasMultiple) {
          event.preventDefault();
          previous();
        }
        break;
      case 'ArrowRight':
        if (hasMultiple) {
          event.preventDefault();
          next();
        }
        break;
    }
  }
</script>

{#if currentImage}
  <Modal
    bind:open
    chrome="none"
    aria-label="Image viewer"
    closeButtonVisible={false}
    class="lightbox-modal"
    onDismiss={handleModalDismiss}
  >
    <!--
      `autofocus` (plus `tabindex="-1"` so it's programmatically focusable)
      makes this element Modal's initial-focus target: Modal's own initial-
      focus policy (`focusDialogBodyUnlessAutofocused`) looks for an
      `[autofocus]` descendant and focuses it directly via `.focus()`, falling
      back to the body container only when none exists. Without this, focus
      would land on Modal's own `.cinder-modal__body` wrapper — the PARENT of
      this element — and the `onkeydown` handler below (which owns
      ArrowLeft/ArrowRight navigation) would never see the keystroke until
      focus moved somewhere inside this subtree.
    -->
    <div
      class="lightbox-content"
      onclick={handleContentClick}
      onkeydown={handleKeyDown}
      role="presentation"
      tabindex="-1"
      autofocus
    >
      <button type="button" class="lightbox-close" aria-label="Close image viewer" onclick={close}>
        <X size={20} />
      </button>

      {#if hasMultiple}
        <button
          type="button"
          class="lightbox-nav lightbox-nav-previous"
          aria-label="Previous image"
          onclick={previous}
        >
          <ChevronLeft size={24} />
        </button>
      {/if}

      <div class="lightbox-image-container">
        <img
          src={currentImage.src}
          alt={currentImage.alt}
          class="lightbox-image"
          decoding="async"
        />
      </div>

      {#if hasMultiple}
        <button
          type="button"
          class="lightbox-nav lightbox-nav-next"
          aria-label="Next image"
          onclick={next}
        >
          <ChevronRight size={24} />
        </button>

        <div class="lightbox-counter" aria-live="polite" aria-atomic="true">
          {counterText}
        </div>
      {/if}
    </div>
  </Modal>
{/if}

<style>
  /*
   * `--cinder-modal-backdrop` is Modal's supported override point for the
   * `::backdrop` color — scoped via the `class` prop Modal already forwards
   * onto its own <dialog>, not a `:global()` reach into Modal's internal
   * selectors. `.lightbox-modal` lives on that external dialog element (not
   * inside this component's own template), so `:global()` is required here
   * for the selector to match — the override point itself is the public
   * contract, not an escape into `.cinder-modal__panel` etc.
   */
  :global(.lightbox-modal) {
    --cinder-modal-backdrop: rgba(0, 0, 0, 0.9);
  }

  .lightbox-content {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .lightbox-image-container {
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 90vw;
    max-height: 90vh;
  }

  .lightbox-image {
    max-width: 90vw;
    max-height: 90vh;
    object-fit: contain;
    border-radius: var(--cinder-radius-sm);
  }

  /* Close button */
  .lightbox-close {
    position: fixed;
    top: var(--cinder-space-4, 1rem);
    right: var(--cinder-space-4, 1rem);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--cinder-radius-sm);
    color: white;
    cursor: pointer;
    transition: background var(--cinder-duration-fast) var(--cinder-ease-standard);
    z-index: 1;
  }

  @media (hover: hover) {
    .lightbox-close:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }

  .lightbox-close:focus-visible {
    /* Documented allowlist exception (docs/focus-ring-policy.md § Deviations):
       these controls float over an arbitrary dimmed photo backdrop where the
       accent ring color cannot guarantee contrast. A literal white outline is
       the deliberate high-contrast choice; it is already visible in Windows
       High Contrast Mode, so no forced-colors override is required. */
    /* stylelint-disable-next-line cinder/no-focus-visible-colored-outline -- white-over-photo contrast, see policy Deviations appendix */
    outline: 2px solid white;
    outline-offset: 2px;
  }

  /* Navigation buttons */
  .lightbox-nav {
    position: fixed;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--cinder-radius-sm);
    color: white;
    cursor: pointer;
    transition: background var(--cinder-duration-fast) var(--cinder-ease-standard);
    z-index: 1;
  }

  @media (hover: hover) {
    .lightbox-nav:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }

  .lightbox-nav:focus-visible {
    /* Documented allowlist exception (docs/focus-ring-policy.md § Deviations):
       white-over-photo contrast — same rationale as .lightbox-close above. */
    /* stylelint-disable-next-line cinder/no-focus-visible-colored-outline -- white-over-photo contrast, see policy Deviations appendix */
    outline: 2px solid white;
    outline-offset: 2px;
  }

  .lightbox-nav-previous {
    left: var(--cinder-space-4, 1rem);
  }

  .lightbox-nav-next {
    right: var(--cinder-space-4, 1rem);
  }

  /* Image counter */
  .lightbox-counter {
    position: fixed;
    bottom: var(--cinder-space-4, 1rem);
    left: 50%;
    transform: translateX(-50%);
    color: rgba(255, 255, 255, 0.8);
    font-size: var(--cinder-text-sm, 0.875rem);
    background: rgba(0, 0, 0, 0.5);
    padding: var(--cinder-space-1, 0.25rem) var(--cinder-space-3, 0.75rem);
    border-radius: var(--cinder-radius-sm);
    pointer-events: none;
    z-index: 1;
  }
</style>
