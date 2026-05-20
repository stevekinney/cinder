<script lang="ts" module>
  export type { AvatarProps, AvatarShape, AvatarSize } from './avatar.types.ts';
</script>

<script lang="ts">
  import type { AvatarProps } from './avatar.types.ts';
  import { cn } from '../../utilities/class-names.ts';
  import VisuallyHidden from '../visually-hidden/visually-hidden.svelte';

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
