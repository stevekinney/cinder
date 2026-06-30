<script lang="ts" module>
  /**
   * @cinder
   * @category domain
   * @status stable
   * @purpose Pricing comparison section that lays out multiple plans using the existing PricingCard primitive.
   * @tag marketing
   * @tag pricing
   * @tag plans
   * @useWhen Presenting tiered subscription plans with features and action buttons.
   * @useWhen Highlighting a recommended plan while still allowing side-by-side comparison.
   * @avoidWhen Showing generic metrics without plan selection controls. | stats-section
   * @avoidWhen Rendering a single standalone plan card outside of a section context. | pricing-card
   * @related pricing-card, stats-section, cta-section, container
   */
  export type { PricingSectionPlan, PricingSectionProps } from './pricing-section.types.ts';
</script>

<script lang="ts">
  import Container from '../container/container.svelte';
  import PricingCard from '../pricing-card/pricing-card.svelte';
  import { classNames } from '../../utilities/class-names.ts';

  import type { PricingSectionProps } from './pricing-section.types.ts';

  let {
    as = 'section',
    title,
    description,
    plans,
    columns = 3,
    onPlanSelect,
    maxWidth = 'wide',
    class: className,
    ...rest
  }: PricingSectionProps = $props();

  function optionalPlanProps(plan: PricingSectionProps['plans'][number]): {
    caveat?: string;
    selected?: boolean;
  } {
    return {
      ...(plan.caveat ? { caveat: plan.caveat } : {}),
      ...(plan.selected !== undefined ? { selected: plan.selected } : {}),
    };
  }
</script>

<svelte:element
  this={as}
  class={classNames('cinder-pricing-section', className)}
  data-cinder-columns={String(columns)}
  {...rest}
>
  <Container {maxWidth}>
    <div class="cinder-pricing-section__inner">
      {#if title}
        <header class="cinder-pricing-section__header">
          <h2 class="cinder-pricing-section__title">{title}</h2>
          {#if description}
            <p class="cinder-pricing-section__description">{description}</p>
          {/if}
        </header>
      {/if}

      <ul class="cinder-pricing-section__list">
        {#each plans as plan, index (`${plan.name}-${index}`)}
          <li class="cinder-pricing-section__item">
            <PricingCard
              name={plan.name}
              price={plan.price}
              features={plan.features}
              cta={plan.cta}
              {...optionalPlanProps(plan)}
              onselect={() => {
                onPlanSelect?.(plan, index);
              }}
            />
          </li>
        {/each}
      </ul>
    </div>
  </Container>
</svelte:element>
