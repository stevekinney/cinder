<script lang="ts" module>
  import type { HTMLImgAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';

  /**
   * Props for the Image component.
   *
   * A general-purpose `<img>` wrapper with `loading="lazy"` and `decoding="async"`
   * defaults, an aspect-ratio container, a blur-up placeholder for progressive
   * loading, and a fallback snippet rendered when the image errors. Distinct
   * from `Avatar`: this component does not render initials and has no concept
   * of a person's identity.
   *
   * `alt` is required with no default — consumers must make the
   * decorative-vs-meaningful choice explicitly. Pass `alt=""` for decorative
   * images.
   *
   * For above-the-fold hero images, override `loading="eager"` and pass
   * `fetchpriority="high"` (forwarded via rest props) so the browser
   * prioritizes the Largest Contentful Paint resource.
   */
  export type ImageProps = Omit<
    HTMLImgAttributes,
    'alt' | 'src' | 'width' | 'height' | 'loading' | 'decoding' | 'onload' | 'onerror'
  > & {
    /** Image source URL. */
    src: string;
    /**
     * Alternative text. Required with no default — pass `alt=""` explicitly for
     * decorative images so the choice is intentional, not silent.
     */
    alt: string;
    /** Native pixel width. */
    width?: number;
    /** Native pixel height. */
    height?: number;
    /**
     * CSS aspect-ratio applied to the wrapper (e.g. `'16 / 9'`) so layout is
     * stable while the image loads.
     */
    ratio?: string;
    /** Loading strategy. Default `lazy`. Override to `eager` for above-the-fold images. */
    loading?: 'lazy' | 'eager';
    /** Decoding hint. Default `async`. */
    decoding?: 'async' | 'sync' | 'auto';
    /**
     * Low-resolution image source (typically a base64 data URI) shown as a
     * pixelated background while the main image loads. Fades out once the
     * `<img>` fires `load`.
     */
    placeholder?: string;
    /** Additional class names merged with `.cinder-image`. */
    class?: string;
    /** Rendered in place of the `<img>` when it fails to load. */
    fallback?: Snippet;
    /** Forwarded after internal state updates. */
    onload?: (event: Event) => void;
    /** Forwarded after internal state updates. */
    onerror?: (event: Event) => void;
  };
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';

  let {
    src,
    alt,
    width,
    height,
    ratio,
    loading = 'lazy',
    decoding = 'async',
    placeholder,
    class: className,
    fallback,
    onload,
    onerror,
    ...rest
  }: ImageProps = $props();

  // Track which src has loaded or errored so derived booleans reset
  // synchronously when src changes — no $effect required.
  let loadedSource = $state<string | null>(null);
  let erroredSource = $state<string | null>(null);

  const loaded = $derived(loadedSource === src);
  const errored = $derived(erroredSource === src);
  const showFallback = $derived(errored && fallback !== undefined);

  function handleLoad(event: Event) {
    loadedSource = src;
    onload?.(event);
  }

  function handleError(event: Event) {
    erroredSource = src;
    onerror?.(event);
  }

  // Cached/SSR-hydrated images may already be complete before the load
  // handler is attached. Detect that case via an attachment that fires
  // when the element mounts, and treat it as loaded.
  function detectCached(node: HTMLImageElement) {
    if (node.complete && node.naturalWidth > 0) {
      loadedSource = src;
    }
  }

  // Stop emitting the inline background-image once the real image has loaded
  // (or errored) so the placeholder doesn't leak behind a transparent image
  // or a fallback snippet.
  const cssUrl = $derived(
    placeholder && !loaded && !errored ? buildCssUrl(placeholder) : undefined,
  );

  // Decorative images (alt="") should stay invisible to assistive tech even
  // when the fallback renders — otherwise we'd announce an unnamed image-like
  // region. Meaningful images keep their accessible name via role + label.
  const fallbackRole = $derived(showFallback && alt !== '' ? 'img' : undefined);
  const fallbackLabel = $derived(showFallback && alt !== '' ? alt : undefined);
  const fallbackHidden = $derived(showFallback && alt === '' ? true : undefined);

  function buildCssUrl(value: string): string {
    // Quote and escape the URL so values containing parens, spaces, or quotes
    // remain valid CSS — works for both plain URLs and data: URIs.
    const escaped = value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
    return `url("${escaped}")`;
  }
</script>

<div
  class={cn('cinder-image', className)}
  data-cinder-loaded={loaded ? '' : undefined}
  data-cinder-errored={errored ? '' : undefined}
  data-cinder-fallback={showFallback ? '' : undefined}
  role={fallbackRole}
  aria-label={fallbackLabel}
  aria-hidden={fallbackHidden}
  style:aspect-ratio={ratio}
  style:background-image={cssUrl}
>
  {#if showFallback}
    {@render fallback?.()}
  {:else}
    <img
      class="cinder-image__img"
      {src}
      {alt}
      {width}
      {height}
      {loading}
      {decoding}
      onload={handleLoad}
      onerror={handleError}
      {@attach detectCached}
      {...rest}
    />
  {/if}
</div>
