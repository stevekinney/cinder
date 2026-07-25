<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Single key metric with a label, formatted value, and optional change indicator that pairs into a statistic-group dashboard tile.
   * @tag data-display
   * @tag metric
   * @useWhen Highlighting one important number such as revenue, signups, or error rate.
   * @useWhen Composing a dashboard tile alongside other Statistic instances inside statistic-group.
   * @avoidWhen Conveying status with a short label or icon — use badge instead.
   * @avoidWhen Showing tabular numeric breakdowns — use table or data-list instead.
   * @related statistic-group, badge
   */
  export type {
    StatisticChange,
    StatisticChangeDirection,
    StatisticProps,
  } from './statistic.types.ts';
</script>

<script lang="ts">
  import type { StatisticProps } from './statistic.types.ts';
  import { getLocaleContext } from '../../_internal/locale-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { formatNumber } from '../../utilities/format-number.ts';

  // $props.id() returns a framework-managed, SSR-stable id unique to this component
  // instance. Pass an explicit `id` prop to control the base when a specific value
  // is required (e.g. for testing or when a stable server-rendered id is needed).
  const generatedId = $props.id();

  let {
    label,
    value,
    change,
    icon,
    valueFormatOptions,
    valueLocale,
    class: customClassName,
    id,
    ...rest
  }: StatisticProps = $props();

  const localeContext = getLocaleContext();

  const stableId = $derived(id ?? generatedId);
  const labelId = $derived(`${stableId}-label`);
  const valueId = $derived(`${stableId}-value`);

  const displayValue = $derived(
    typeof value === 'number'
      ? formatNumber(value, valueLocale ?? localeContext?.locale, valueFormatOptions)
      : value,
  );

  const arrowGlyph = $derived(
    change?.direction === 'up' ? '↑' : change?.direction === 'down' ? '↓' : '→',
  );

  const changeAccessibleText = $derived.by(() => {
    if (!change) return '';
    if (change.label) return change.label;
    const suffix = change.description ? ` ${change.description}` : '';
    if (change.direction === 'up') return `increased by ${change.value}${suffix}`;
    if (change.direction === 'down') return `decreased by ${change.value}${suffix}`;
    return `no change, ${change.value}${suffix}`;
  });
</script>

<div
  {...rest}
  {id}
  class={classNames('cinder-statistic', customClassName)}
  role="group"
  aria-labelledby={`${labelId} ${valueId}`}
  data-cinder-has-icon={icon ? '' : undefined}
>
  {#if icon}
    <span class="cinder-statistic__icon" aria-hidden="true">{@render icon()}</span>
  {/if}
  <span id={labelId} class="cinder-statistic__label">{label}</span>
  <span id={valueId} class="cinder-statistic__value">{displayValue}</span>
  {#if change}
    <span class="cinder-statistic__change" data-cinder-direction={change.direction}>
      <span class="cinder-sr-only">{changeAccessibleText}</span>
      <span class="cinder-statistic__change-icon" aria-hidden="true">{arrowGlyph}</span>
      <span class="cinder-statistic__change-value" aria-hidden="true">{change.value}</span>
      {#if change.description}
        <span class="cinder-statistic__change-description" aria-hidden="true"
          >{change.description}</span
        >
      {/if}
    </span>
  {/if}
</div>
