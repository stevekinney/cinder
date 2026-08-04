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
  import PersonByline from '../_internal/person-byline.svelte';
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
</script>

<svelte:element
  this={as}
  class={classNames('cinder-_section-skeleton', 'cinder-testimonial-section', className)}
  data-cinder-layout={layout}
  data-cinder-columns={String(columns)}
  {...rest}
>
  <Container {maxWidth}>
    <div class="cinder-_section-skeleton__inner cinder-testimonial-section__inner">
      {#if title || description}
        <header class="cinder-_section-skeleton__header cinder-testimonial-section__header">
          {#if title}
            <h2 class="cinder-_section-skeleton__title cinder-testimonial-section__title">{title}</h2>
          {/if}
          {#if description}
            <p
              class="cinder-_section-skeleton__description cinder-testimonial-section__description"
            >
              {description}
            </p>
          {/if}
        </header>
      {/if}

      <ul class="cinder-_section-skeleton__list cinder-testimonial-section__list">
        {#each testimonials as item, index (`${item.name}-${index}`)}
          <li class="cinder-testimonial-section__item">
            <Card>
              <blockquote class="cinder-testimonial-section__quote">“{item.quote}”</blockquote>
              <div class="cinder-testimonial-section__person">
                <PersonByline
                  name={item.name}
                  role={[item.role, item.company].filter(Boolean).join(' · ')}
                  avatarSrc={item.avatarSrc}
                />
              </div>
            </Card>
          </li>
        {/each}
      </ul>
    </div>
  </Container>
</svelte:element>
