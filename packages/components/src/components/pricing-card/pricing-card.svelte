<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status alpha
   * @purpose Presents a single pricing plan with its name, price, feature list, and a call-to-action button.
   * @tag pricing
   * @tag plan
   * @useWhen Letting users compare and select subscription tiers or product plans.
   * @useWhen Highlighting one tier as selected or recommended in a pricing comparison.
   * @avoidWhen Showing generic grouped content without a distinct price or CTA — use card instead.
   * @avoidWhen Displaying a single key metric in isolation — use stat or stat-group instead.
   * @related card, button, stat, stat-group
   */
  export type { PricingCardProps } from './pricing-card.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';
  import Button from '../button/button.svelte';
  import type { PricingCardProps } from './pricing-card.types.ts';

  let {
    name,
    price,
    features,
    cta,
    onselect,
    caveat,
    selected = false,
    class: className,
    ...rest
  }: PricingCardProps = $props();
</script>

<div
  class={classNames('cinder-pricing-card', className)}
  data-cinder-selected={selected ? '' : undefined}
  aria-current={selected ? 'true' : undefined}
  {...rest}
>
  <div class="cinder-pricing-card__header">
    <h3 class="cinder-pricing-card__name">{name}</h3>
    <p class="cinder-pricing-card__price">{price}</p>
  </div>

  <div class="cinder-pricing-card__body">
    <ul class="cinder-pricing-card__features">
      {#each features as feature, index (index)}
        <li class="cinder-pricing-card__feature">{feature}</li>
      {/each}
    </ul>

    {#if caveat}
      <p class="cinder-pricing-card__caveat" data-cinder-caveat="">{caveat}</p>
    {/if}
  </div>

  <div class="cinder-pricing-card__footer">
    <Button label={cta} variant={selected ? 'primary' : 'secondary'} fullWidth onclick={onselect} />
  </div>
</div>
