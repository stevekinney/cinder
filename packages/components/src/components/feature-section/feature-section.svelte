<script lang="ts" module>
  /**
   * @cinder
   * @category domain
   * @status stable
   * @purpose Marketing section for highlighting product capabilities as a structured feature grid with optional side media.
   * @tag marketing
   * @tag features
   * @tag layout
   * @useWhen Showing a list of core benefits with concise title + description content.
   * @useWhen Pairing a feature list with a screenshot or product demo in a two-column split.
   * @avoidWhen Rendering customer quotes authored by people with avatars. | testimonial-section
   * @avoidWhen Presenting team-member profiles and social links. | team-section
   * @related hero-section, testimonial-section, team-section, card, container
   */
  export type {
    FeatureSectionItem,
    FeatureSectionLayout,
    FeatureSectionMediaPosition,
    FeatureSectionProps,
  } from './feature-section.types.ts';
</script>

<script lang="ts">
  import Container from '../container/container.svelte';
  import { classNames } from '../../utilities/class-names.ts';

  import type { FeatureSectionProps } from './feature-section.types.ts';

  let {
    as = 'section',
    title,
    description,
    items,
    layout = 'grid',
    columns = 3,
    mediaPosition = 'end',
    maxWidth = 'wide',
    media,
    class: className,
    children,
    ...rest
  }: FeatureSectionProps = $props();
</script>

<svelte:element
  this={as}
  class={classNames('cinder-feature-section', className)}
  data-cinder-layout={layout}
  data-cinder-columns={String(columns)}
  data-cinder-media-position={mediaPosition}
  data-cinder-has-media={media ? '' : undefined}
  {...rest}
>
  <Container {maxWidth}>
    <div class="cinder-feature-section__inner">
      <header class="cinder-feature-section__header">
        <h2 class="cinder-feature-section__title">{title}</h2>
        {#if description}
          <p class="cinder-feature-section__description">{description}</p>
        {/if}
        {#if children}
          <div class="cinder-feature-section__extra">{@render children()}</div>
        {/if}
      </header>

      <div class="cinder-feature-section__body">
        <ul class="cinder-feature-section__list">
          {#each items as item, index (`${item.title}-${index}`)}
            <li class="cinder-feature-section__item">
              {#if item.icon}
                <span class="cinder-feature-section__icon" aria-hidden="true">{item.icon}</span>
              {/if}
              <h3 class="cinder-feature-section__item-title">{item.title}</h3>
              <p class="cinder-feature-section__item-description">{item.description}</p>
            </li>
          {/each}
        </ul>

        {#if media}
          <aside class="cinder-feature-section__media">
            {@render media()}
          </aside>
        {/if}
      </div>
    </div>
  </Container>
</svelte:element>
