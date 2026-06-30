<script lang="ts" module>
  /**
   * @cinder
   * @category domain
   * @status stable
   * @purpose Landing-page hero scaffold with eyebrow, heading, supporting copy, CTA row, and optional media panel.
   * @tag marketing
   * @tag hero
   * @tag layout
   * @useWhen Building the first section of a marketing page where a primary message and call-to-action must stand out.
   * @useWhen Pairing conversion copy with a visual demo, screenshot, or illustration in a split layout.
   * @avoidWhen Presenting only a compact call-to-action strip between content sections. | cta-section
   * @avoidWhen Listing repeatable product benefits or cards — use a dedicated features grid instead. | feature-section
   * @related cta-section, feature-section, section-heading, container, button
   */
  export type {
    HeroSectionAlign,
    HeroSectionMediaPosition,
    HeroSectionProps,
  } from './hero-section.types.ts';
</script>

<script lang="ts">
  import Container from '../container/container.svelte';
  import { classNames } from '../../utilities/class-names.ts';

  import type { HeroSectionProps } from './hero-section.types.ts';

  let {
    as = 'section',
    eyebrow,
    title,
    description,
    align = 'start',
    mediaPosition = 'end',
    maxWidth = 'wide',
    actions,
    media,
    class: className,
    children,
    ...rest
  }: HeroSectionProps = $props();
</script>

<svelte:element
  this={as}
  class={classNames('cinder-hero-section', className)}
  data-cinder-align={align}
  data-cinder-media-position={mediaPosition}
  data-cinder-has-media={media ? '' : undefined}
  {...rest}
>
  <Container {maxWidth}>
    <div class="cinder-hero-section__inner">
      <div class="cinder-hero-section__content">
        {#if eyebrow}
          <p class="cinder-hero-section__eyebrow">{eyebrow}</p>
        {/if}
        <h2 class="cinder-hero-section__title">{title}</h2>
        {#if description}
          <p class="cinder-hero-section__description">{description}</p>
        {/if}
        {#if actions}
          <div class="cinder-hero-section__actions">
            {@render actions()}
          </div>
        {/if}
        {#if children}
          <div class="cinder-hero-section__extra">
            {@render children()}
          </div>
        {/if}
      </div>
      {#if media}
        <div class="cinder-hero-section__media">
          {@render media()}
        </div>
      {/if}
    </div>
  </Container>
</svelte:element>
