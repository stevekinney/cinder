<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';

  export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  export type AvatarShape = 'circle' | 'square';

  /**
   * Props for the Avatar component.
   *
   * Renders an image when `src` is supplied; falls back to initials computed
   * from `name` when the image is missing or fails to load. The `name` prop
   * is also used for the accessible name when no `alt` is supplied.
   */
  export type AvatarProps = HTMLAttributes<HTMLSpanElement> & {
    /** Image source. When omitted, the initials fallback renders. */
    src?: string;
    /** Alternative text for the image. Defaults to `name` when present. */
    alt?: string;
    /**
     * Display name used to compute initials when no image is available.
     * Also used as the default `alt` for the image.
     */
    name?: string;
    /** Size token. Default `md`. */
    size?: AvatarSize;
    /** Shape. Default `circle`. */
    shape?: AvatarShape;
    /** Additional class names merged with `.cinder-avatar`. */
    class?: string;
  };
</script>

<script lang="ts">
  import { cn } from '../utilities/class-names.ts';
  import VisuallyHidden from './visually-hidden/visually-hidden.svelte';

  let {
    src,
    alt,
    name,
    size = 'md',
    shape = 'circle',
    class: className,
    ...rest
  }: AvatarProps = $props();

  // Track image load failure so we can fall back to initials without the
  // consumer having to handle `onerror` themselves.
  let imageFailed = $state(false);
  $effect(() => {
    // Reset on src change so a new image gets a chance to load.
    void src;
    imageFailed = false;
  });

  const showImage = $derived(!!src && !imageFailed);
  const accessibleAlt = $derived(alt ?? name ?? '');

  const initials = $derived(computeInitials(name));

  function computeInitials(value: string | undefined): string {
    if (!value) return '';
    const parts = value.trim().split(/\s+/).slice(0, 2);
    return parts.map((part) => part.charAt(0).toUpperCase()).join('');
  }
</script>

<span
  class={cn('cinder-avatar', className)}
  data-cinder-size={size}
  data-cinder-shape={shape}
  {...rest}
>
  {#if showImage}
    <img
      class="cinder-avatar__image"
      {src}
      alt={accessibleAlt}
      onerror={() => {
        imageFailed = true;
      }}
    />
  {:else if initials}
    <span class="cinder-avatar__initials" aria-hidden={!!name && !alt}>{initials}</span>
    {#if accessibleAlt}
      <VisuallyHidden>{accessibleAlt}</VisuallyHidden>
    {/if}
  {:else}
    <!-- Fallback when neither image nor name is available. Render an empty
         neutral surface; consumers should always supply at least one. -->
    <span aria-hidden="true" class="cinder-avatar__placeholder"></span>
  {/if}
</span>
