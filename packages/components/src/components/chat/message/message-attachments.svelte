<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';
  import type { MultiModalContent } from '../conversation-model.ts';

  export type MessageAttachmentsProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
    /** Image parts from the message content */
    images: ReadonlyArray<MultiModalContent>;
    /** Lazy loading strategy */
    loading?: 'lazy' | 'eager';
    /** Called when an image loads */
    onimageload?: (index: number) => void;
    /** Called when an image fails to load */
    onimageerror?: (index: number, error: Event) => void;
    /** Additional CSS class */
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../../../utilities/class-names.ts';
  import ImageLightbox from './image-lightbox.svelte';

  let {
    images,
    loading = 'lazy',
    onimageload,
    onimageerror,
    class: className,
    ...rest
  }: MessageAttachmentsProps = $props();

  // Filter to only image type content with valid URLs
  // Pre-compute URLs to ensure data-count matches rendered items
  const validImages = $derived(
    images
      .filter((item) => item.type === 'image')
      .map((image) => ({
        image,
        url: getImageUrlFromContent(image),
      }))
      .filter((item) => item.url !== ''),
  );

  // Lightbox state
  let lightboxOpen = $state(false);
  let lightboxIndex = $state(0);

  // Pre-compute lightbox image array for the lightbox component
  const lightboxImages = $derived(
    validImages.map(({ image, url }, index) => ({
      src: url,
      alt: getAltText(image, index + 1),
    })),
  );

  /**
   * Extracts the image URL from an image content item.
   */
  function getImageUrlFromContent(image: MultiModalContent): string {
    if (image.type !== 'image') return '';
    return image.url;
  }

  /**
   * Extracts alt text from an image content item.
   * Uses displayIndex for fallback text (1-based position in rendered list).
   */
  function getAltText(image: MultiModalContent, displayIndex: number): string {
    if (image.type !== 'image') return '';
    // ImageContent carries optional descriptive text used as the alt.
    if (image.text) return image.text;
    return `Image attachment ${displayIndex}`;
  }

  function handleLoad(index: number) {
    onimageload?.(index);
  }

  function handleError(index: number, event: Event) {
    onimageerror?.(index, event);
  }

  function openLightbox(index: number) {
    lightboxIndex = index;
    lightboxOpen = true;
  }
</script>

<div
  class={classNames('message-attachments', className)}
  role="list"
  aria-label="Message attachments"
  data-count={validImages.length}
  {...rest}
>
  {#each validImages as { image, url }, loopIndex (url)}
    {@const displayIndex = loopIndex + 1}
    {@const alt = getAltText(image, displayIndex)}
    <figure class="message-attachment" role="listitem">
      <button
        type="button"
        class="message-attachment-button"
        aria-label={`View image: ${alt}`}
        onclick={() => openLightbox(loopIndex)}
      >
        <img
          src={url}
          {alt}
          {loading}
          decoding="async"
          class="message-attachment-image"
          onload={() => handleLoad(loopIndex)}
          onerror={(event) => handleError(loopIndex, event)}
        />
      </button>
      {#if alt && alt !== `Image attachment ${displayIndex}`}
        <figcaption class="sr-only">{alt}</figcaption>
      {/if}
    </figure>
  {/each}
</div>

<ImageLightbox images={lightboxImages} initialIndex={lightboxIndex} bind:open={lightboxOpen} />

<style>
  .message-attachments {
    display: grid;
    gap: var(--cinder-space-2);
    margin-top: var(--cinder-space-2);
  }

  /* Single image: larger, centered */
  .message-attachments[data-count='1'] {
    grid-template-columns: minmax(200px, 60%);
  }

  /* Two images: side by side */
  .message-attachments[data-count='2'] {
    grid-template-columns: repeat(2, 1fr);
  }

  /* Three or more: auto-fit grid */
  .message-attachments:not([data-count='1']):not([data-count='2']) {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }

  .message-attachment {
    position: relative;
    margin: 0;
    border-radius: var(--cinder-radius-md);
    overflow: hidden;
  }

  /* Button wrapper: removes chrome but keeps keyboard-operable behavior */
  .message-attachment-button {
    display: block;
    width: 100%;
    padding: 0;
    background: none;
    border: none;
    border-radius: var(--cinder-radius-md);
    cursor: zoom-in;
    overflow: hidden;
  }

  .message-attachment-button:focus-visible {
    outline: 2px solid var(--cinder-ring-color);
    outline-offset: 2px;
  }

  .message-attachment-image {
    display: block;
    width: 100%;
    height: auto;
    max-height: 400px;
    border-radius: var(--cinder-radius-md);
    /* Use contain to preserve full image content and avoid cropping */
    object-fit: contain;
    transition: opacity 150ms ease;
  }

  .message-attachment-button:hover .message-attachment-image {
    opacity: 0.85;
  }

  /* Screen reader only text */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
