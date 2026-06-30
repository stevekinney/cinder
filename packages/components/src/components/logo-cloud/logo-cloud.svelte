<script lang="ts" module>
  /**
   * @cinder
   * @category domain
   * @status stable
   * @purpose Responsive logo grid for “trusted by” sections that display partner/customer brand marks.
   * @tag marketing
   * @tag logos
   * @tag social-proof
   * @useWhen Displaying customer or partner logos near pricing, hero, or testimonial content.
   * @useWhen Creating a compact proof strip that links out to partner pages or case studies.
   * @avoidWhen Presenting individual people with names and roles. | team-section
   * @avoidWhen Listing article content with headlines and excerpts. | blog-section
   * @related team-section, testimonial-section, blog-section, container, image
   */
  export type { LogoCloudItem, LogoCloudProps } from './logo-cloud.types.ts';
</script>

<script lang="ts">
  import Container from '../container/container.svelte';
  import { classNames } from '../../utilities/class-names.ts';

  import type { LogoCloudProps } from './logo-cloud.types.ts';

  let {
    as = 'section',
    title,
    description,
    logos,
    columns = 5,
    grayscale = true,
    maxWidth = 'wide',
    class: className,
    ...rest
  }: LogoCloudProps = $props();
</script>

<svelte:element
  this={as}
  class={classNames('cinder-logo-cloud', className)}
  data-cinder-columns={String(columns)}
  data-cinder-grayscale={grayscale ? '' : undefined}
  {...rest}
>
  <Container {maxWidth}>
    <div class="cinder-logo-cloud__inner">
      {#if title}
        <header class="cinder-logo-cloud__header">
          <h2 class="cinder-logo-cloud__title">{title}</h2>
          {#if description}
            <p class="cinder-logo-cloud__description">{description}</p>
          {/if}
        </header>
      {/if}

      <ul class="cinder-logo-cloud__list">
        {#each logos as logo, index (`${logo.name}-${index}`)}
          <li class="cinder-logo-cloud__item">
            {#if logo.href}
              <a href={logo.href} class="cinder-logo-cloud__link">
                <img
                  class="cinder-logo-cloud__image"
                  src={logo.src}
                  alt={logo.name}
                  loading="lazy"
                />
              </a>
            {:else}
              <img class="cinder-logo-cloud__image" src={logo.src} alt={logo.name} loading="lazy" />
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  </Container>
</svelte:element>
