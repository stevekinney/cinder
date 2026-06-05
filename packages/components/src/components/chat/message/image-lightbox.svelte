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
    onclose?: () => void;
  };
</script>

<script lang="ts">
  import { fade } from 'svelte/transition';
  import ChevronLeft from 'lucide-svelte/icons/chevron-left';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import X from 'lucide-svelte/icons/x';
  import { createFocusTrap } from '../../focus-trap/index.ts';
  import { createBodyScrollLock } from '../../../utilities/attachments.ts';

  let { images, initialIndex = 0, open = $bindable(false), onclose }: ImageLightboxProps = $props();

  // currentIndex tracks navigation within the session; resets to initialIndex when lightbox opens
  let currentIndex = $state(0);

  // Reset currentIndex to initialIndex whenever the lightbox opens or initialIndex changes
  let previousOpen = $state(false);
  $effect(() => {
    const isOpening = open && !previousOpen;
    previousOpen = open;
    if (isOpening) {
      currentIndex = images.length > 0 ? Math.max(0, Math.min(initialIndex, images.length - 1)) : 0;
    }
  });

  const hasMultiple = $derived(images.length > 1);
  const currentImage = $derived(images[currentIndex]);
  const counterText = $derived(`${currentIndex + 1} of ${images.length}`);

  function close() {
    open = false;
    onclose?.();
  }

  function previous() {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
  }

  function next() {
    currentIndex = (currentIndex + 1) % images.length;
  }

  function handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      close();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        close();
        break;
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

{#if open && currentImage}
  <div
    class="lightbox-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Image viewer"
    onclick={handleOverlayClick}
    onkeydown={handleKeyDown}
    tabindex="-1"
    transition:fade={{ duration: 150 }}
    {@attach createBodyScrollLock()}
    {@attach createFocusTrap()}
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
      <img src={currentImage.src} alt={currentImage.alt} class="lightbox-image" decoding="async" />
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
{/if}

<style>
  .lightbox-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
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
    transition: background 150ms ease;
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
    transition: background 150ms ease;
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

  /* Respect reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .lightbox-overlay {
      transition: none;
    }
  }
</style>
