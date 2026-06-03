<script lang="ts" module>
  /**
   * @cinder
   * @category layout
   * @status stable
   * @purpose Surface container that groups related content with optional header, title, description, and footer regions.
   * @tag layout
   * @tag container
   * @useWhen Grouping a self-contained unit of content such as a summary, preview, or settings panel.
   * @useWhen Composing a list of comparable items where each needs its own framed region.
   * @avoidWhen Rendering a bare visual surface without slotted regions — use surface instead.
   * @avoidWhen Presenting a single key metric — use stat or stat-group instead.
   * @related surface, stat, stacked-list-item, section-heading
   */
  export type { CardHeadingLevel, CardProps, CardTone, CardVariant } from './card.types.ts';
</script>

<script lang="ts">
  import type { CardProps } from './card.types.ts';
  import { cn } from '../../utilities/class-names.ts';

  let {
    class: className,
    children,
    header,
    title,
    headingLevel = 3,
    description,
    footer,
    variant = 'card',
    bodyTone = 'default',
    footerTone = 'default',
    edgeToEdgeOnMobile = false,
    ...rest
  }: CardProps = $props();

  // Coerce + clamp at runtime: a consumer can pass 0, 7, NaN, or a non-numeric
  // value (JS callers, schema-driven usage). Building `h${headingLevel}` directly
  // would emit invalid markup like <h0>/<hNaN>. Matches EmptyState's heading clamp.
  const resolvedHeadingLevel = $derived(
    Number.isFinite(Math.trunc(Number(headingLevel)))
      ? Math.min(6, Math.max(1, Math.trunc(Number(headingLevel))))
      : 3,
  );
  const titleTag = $derived(`h${resolvedHeadingLevel}` as const);
</script>

<div
  class={cn('cinder-card', className)}
  data-cinder-variant={variant}
  data-cinder-edge-to-edge-mobile={edgeToEdgeOnMobile ? '' : undefined}
  {...rest}
>
  {#if header}
    <div class="cinder-card__header">
      {@render header()}
    </div>
  {:else if title}
    <div class="cinder-card__header">
      <svelte:element this={titleTag} class="cinder-card__title">{title}</svelte:element>
      {#if description}
        <p class="cinder-card__description">{description}</p>
      {/if}
    </div>
  {/if}

  <div class="cinder-card__body" data-cinder-tone={bodyTone}>
    {@render children()}
  </div>

  {#if footer}
    <div class="cinder-card__footer" data-cinder-tone={footerTone}>
      {@render footer()}
    </div>
  {/if}
</div>
