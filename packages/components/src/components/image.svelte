<script lang="ts" module>
  import type { HTMLImgAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';

  /**
   * Props for the Image component.
   *
   * A general-purpose `<img>` wrapper with `loading="lazy"` and `decoding="async"`
   * defaults, an aspect-ratio container, a blur-up placeholder for progressive
   * loading, and a fallback snippet rendered when the image errors. Distinct from
   * `Avatar`: this component does not render initials and has no concept of a
   * person's identity.
   *
   * `alt` is required with no default — consumers must make the
   * decorative-vs-meaningful choice explicitly. Pass `alt=""` for decorative
   * images.
   */
  export type ImageProps = Omit<HTMLImgAttributes, 'alt' | 'src' | 'loading' | 'decoding'> & {
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
     * stable while the image loads. Renders a wrapper element only when
     * provided (or when `placeholder` is set).
     */
    ratio?: string;
    /** Loading strategy. Default `lazy`. Override to `eager` for above-the-fold images. */
    loading?: 'lazy' | 'eager';
    /** Decoding hint. Default `async`. */
    decoding?: 'async' | 'sync' | 'auto';
    /**
     * Low-resolution image source (typically a base64 data URI) shown as a
     * pixelated background while the main image loads. Fades out via opacity
     * once the `<img>` fires `load`.
     */
    placeholder?: string;
    /** CSS `object-fit` for the `<img>`. Default `cover`. */
    objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
    /** Additional class names merged with `.cinder-image`. */
    class?: string;
    /** Rendered in place of the `<img>` when it fails to load. */
    fallback?: Snippet;
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
    objectFit = 'cover',
    class: className,
    fallback,
    ...rest
  }: ImageProps = $props();

  let loaded = $state(false);
  let errored = $state(false);

  // Reset load/error state whenever the source changes so a new src gets a
  // fresh chance to load and show its placeholder.
  $effect(() => {
    void src;
    loaded = false;
    errored = false;
  });

  const needsWrapper = $derived(ratio !== undefined || placeholder !== undefined);
  const showFallback = $derived(errored && fallback !== undefined);

  function handleLoad() {
    loaded = true;
  }

  function handleError() {
    errored = true;
  }
</script>

{#if needsWrapper}
  <div
    class={cn('cinder-image', className)}
    data-cinder-loaded={loaded ? '' : undefined}
    data-cinder-errored={errored ? '' : undefined}
    style:aspect-ratio={ratio}
    style:background-image={placeholder ? `url(${placeholder})` : undefined}
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
        style:object-fit={objectFit}
        onload={handleLoad}
        onerror={handleError}
        {...rest}
      />
    {/if}
  </div>
{:else if showFallback}
  {@render fallback?.()}
{:else}
  <img
    class={cn('cinder-image', className)}
    {src}
    {alt}
    {width}
    {height}
    {loading}
    {decoding}
    style:object-fit={objectFit}
    onload={handleLoad}
    onerror={handleError}
    {...rest}
  />
{/if}
