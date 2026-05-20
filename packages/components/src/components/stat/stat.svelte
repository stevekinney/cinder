<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Single key metric with a label, formatted value, and optional change indicator that pairs into a stat-group dashboard tile.
   * @tag data-display
   * @tag metric
   * @useWhen Highlighting one important number such as revenue, signups, or error rate.
   * @useWhen Composing a dashboard tile alongside other Stat instances inside stat-group.
   * @avoidWhen Conveying status with a short label or icon — use badge instead.
   * @avoidWhen Showing tabular numeric breakdowns — use table or data-list instead.
   * @related stat-group, badge
   */
  export type { StatChange, StatChangeDirection, StatProps } from './stat.types.ts';
</script>

<script lang="ts">
  import type { StatProps } from './stat.types.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { formatNumber } from '../../utilities/format-number.ts';
  import { useId } from '../../utilities/use-id.ts';

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
  }: StatProps = $props();

  // useId() generates a stable counter-based suffix so two <Stat> components with
  // the same label on one page get distinct IDs. Pass an explicit `id` prop to
  // control the base when a specific value is required (e.g. for testing or server
  // rendering where instance order must be deterministic).
  const instanceId = useId('cinder-stat');
  const stableId = $derived(id ?? instanceId);
  const labelId = $derived(`${stableId}-label`);
  const valueId = $derived(`${stableId}-value`);

  const displayValue = $derived(
    typeof value === 'number' ? formatNumber(value, valueLocale, valueFormatOptions) : value,
  );

  const arrowGlyph = $derived(
    change?.direction === 'up' ? '↑' : change?.direction === 'down' ? '↓' : '→',
  );

  const changeAccessibleText = $derived.by(() => {
    if (!change) return '';
    if (change.ariaLabel) return change.ariaLabel;
    const suffix = change.description ? ` ${change.description}` : '';
    if (change.direction === 'up') return `increased by ${change.value}${suffix}`;
    if (change.direction === 'down') return `decreased by ${change.value}${suffix}`;
    return `no change, ${change.value}${suffix}`;
  });
</script>

<div
  {...rest}
  {id}
  class={classNames('cinder-stat', customClassName)}
  role="group"
  aria-labelledby={`${labelId} ${valueId}`}
  data-cinder-has-icon={icon ? '' : undefined}
>
  {#if icon}
    <span class="cinder-stat__icon" aria-hidden="true">{@render icon()}</span>
  {/if}
  <span id={labelId} class="cinder-stat__label">{label}</span>
  <span id={valueId} class="cinder-stat__value">{displayValue}</span>
  {#if change}
    <span class="cinder-stat__change" data-cinder-direction={change.direction}>
      <span class="cinder-sr-only">{changeAccessibleText}</span>
      <span class="cinder-stat__change-icon" aria-hidden="true">{arrowGlyph}</span>
      <span class="cinder-stat__change-value" aria-hidden="true">{change.value}</span>
      {#if change.description}
        <span class="cinder-stat__change-description" aria-hidden="true">{change.description}</span>
      {/if}
    </span>
  {/if}
</div>
