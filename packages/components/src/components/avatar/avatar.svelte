<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Profile graphic that renders a user image with automatic initials fallback when the source is missing or fails to load.
   * @tag identity
   * @tag image
   * @useWhen Representing a person or account next to their name or activity.
   * @useWhen Displaying initials when no avatar image is available.
   * @avoidWhen Showing a small status or count indicator — use badge or status-dot instead.
   * @related badge, status-dot, image
   */
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

  // Track the specific URL that failed to load so a new src automatically
  // gets a fresh chance, while a repeated failed src stays hidden.
  let failedSource = $state<string | null>(null);

  const showImage = $derived(!!src && failedSource !== src);
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
        failedSource = src ?? null;
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
