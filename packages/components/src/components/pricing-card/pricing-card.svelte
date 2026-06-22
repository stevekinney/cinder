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
  import { devWarn } from '../../utilities/dev-warn.ts';
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

  // Deduplicate features by value (first occurrence wins) so the keyed {#each}
  // never receives duplicate keys and Svelte cannot throw each_key_duplicate.
  // A dev warning is emitted when duplicates are found so the data author can fix
  // their input, but the component continues to render the deduplicated list.
  const renderableFeatures = $derived.by(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    let hasDuplicates = false;
    for (const feature of features) {
      if (seen.has(feature)) {
        hasDuplicates = true;
      } else {
        seen.add(feature);
        result.push(feature);
      }
    }
    if (hasDuplicates) {
      devWarn(
        '[cinder/PricingCard] Duplicate feature values detected. Each feature must be unique when used as a list key. Duplicates were removed; only the first occurrence of each value is shown.',
      );
    }
    return result;
  });
</script>

<div
  class={classNames('cinder-pricing-card', className)}
  data-cinder-selected={selected ? '' : undefined}
  aria-current={selected ? 'true' : undefined}
  {...rest}
>
  <div class="cinder-pricing-card__header">
    <div class="cinder-pricing-card__heading-row">
      <h3 class="cinder-pricing-card__name">{name}</h3>
      <!-- A visible, non-color cue for the selected plan: the accent border and
           CTA tint alone would not be perceivable to a colour-blind sighted
           user (WCAG 1.4.1), so the selected state also carries explicit text. -->
      {#if selected}
        <span class="cinder-pricing-card__selected-flag">Selected</span>
      {/if}
    </div>
    <p class="cinder-pricing-card__price">{price}</p>
  </div>

  <div class="cinder-pricing-card__body">
    <ul class="cinder-pricing-card__features">
      {#each renderableFeatures as feature (feature)}
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
