<script lang="ts" module>
  export type { ImageProps } from './image.types.ts';
</script>

<script lang="ts">
  import type { ImageProps } from './image.types.ts';
  import { cn } from '../../utilities/class-names.ts';

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
