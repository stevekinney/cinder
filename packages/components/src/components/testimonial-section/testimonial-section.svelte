<script lang="ts" module>
  /**
   * @cinder
   * @category domain
   * @status stable
   * @purpose Customer quote section that renders one or more testimonials with author identity and optional role/company context.
   * @tag marketing
   * @tag testimonial
   * @tag social-proof
   * @useWhen Building a social-proof block with customer quotes and attributed people.
   * @useWhen Displaying one featured quote or a compact testimonial grid on landing pages.
   * @avoidWhen Listing product capabilities with icon + title + description rows. | feature-section
   * @avoidWhen Showing team roster information for your own company. | team-section
   * @related feature-section, team-section, avatar, card, container
   */
  export type {
    TestimonialSectionItem,
    TestimonialSectionLayout,
    TestimonialSectionProps,
  } from './testimonial-section.types.ts';
</script>

<script lang="ts">
  import Avatar from '../avatar/avatar.svelte';
  import Card from '../card/card.svelte';
  import Container from '../container/container.svelte';
  import { classNames } from '../../utilities/class-names.ts';

  import type { TestimonialSectionProps } from './testimonial-section.types.ts';

  let {
    as = 'section',
    title,
    description,
    testimonials,
    layout = 'grid',
    columns = 3,
    maxWidth = 'wide',
    class: className,
    ...rest
  }: TestimonialSectionProps = $props();

  function avatarProps(name: string, src: string | undefined): { name: string; src?: string } {
    return src ? { name, src } : { name };
  }
</script>

<svelte:element
  this={as}
  class={classNames('cinder-testimonial-section', className)}
  data-cinder-layout={layout}
  data-cinder-columns={String(columns)}
  {...rest}
>
  <Container {maxWidth}>
    <div class="cinder-testimonial-section__inner">
      {#if title}
        <header class="cinder-testimonial-section__header">
          <h2 class="cinder-testimonial-section__title">{title}</h2>
          {#if description}
            <p class="cinder-testimonial-section__description">{description}</p>
          {/if}
        </header>
      {/if}

      <ul class="cinder-testimonial-section__list">
        {#each testimonials as item, index (`${item.name}-${index}`)}
          <li class="cinder-testimonial-section__item">
            <Card>
              <blockquote class="cinder-testimonial-section__quote">“{item.quote}”</blockquote>
              <div class="cinder-testimonial-section__person">
                <Avatar {...avatarProps(item.name, item.avatarSrc)} size="sm" />
                <div class="cinder-testimonial-section__person-meta">
                  <p class="cinder-testimonial-section__name">{item.name}</p>
                  {#if item.role || item.company}
                    <p class="cinder-testimonial-section__role">
                      {[item.role, item.company].filter(Boolean).join(' · ')}
                    </p>
                  {/if}
                </div>
              </div>
            </Card>
          </li>
        {/each}
      </ul>
    </div>
  </Container>
</svelte:element>
