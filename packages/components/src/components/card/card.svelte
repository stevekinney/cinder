<script lang="ts" module>
  export type { CardProps, CardTone, CardVariant } from './card.types.ts';
</script>

<script lang="ts">
  import type { CardProps } from './card.types.ts';
  import { cn } from '../../utilities/class-names.ts';

  let {
    class: className,
    children,
    header,
    title,
    description,
    footer,
    variant = 'card',
    bodyTone = 'default',
    footerTone = 'default',
    edgeToEdgeOnMobile = false,
    ...rest
  }: CardProps = $props();
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
      <h3 class="cinder-card__title">{title}</h3>
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
