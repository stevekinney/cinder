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
  import { resolveChartTheme } from '../../_internal/chart/chart-utilities.ts';
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
    theme,
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

  /**
   * Statistic is page text, not chart glyphs, so it cannot take
   * `resolveChartTheme`'s unthemed defaults as-is: that returns
   * `currentColor` for `foreground` and `muted`, and this component writes
   * both as INLINE custom properties, so the `var(--_cinder-chart-*, …)`
   * fallbacks in `statistic.css` can never apply. An unthemed Statistic
   * therefore painted its label, icon, and change description at full text
   * colour — visually identical to the value, with the muted hierarchy gone.
   *
   * The chart components absorb the same `currentColor` default with a
   * compensating `opacity` on their tick labels; that is the wrong tool for
   * text, which has to clear the 4.5:1 AA floor rather than land wherever a
   * multiplier puts it.
   *
   * So the substitution is all-or-nothing on `theme`'s presence, NOT
   * per-field: with no theme at all, both colours come from the
   * contrast-tuned text tokens (restoring the pre-#1248 hierarchy); with any
   * theme, `resolveChartTheme` is used untouched so omitted fields still
   * inherit `currentColor` as the partial-theme contract documents. A
   * per-field fallback would put the app's `--cinder-text-muted` on a caller's
   * custom dark panel. A surface that colours its own text through an
   * ancestor and wants the Statistic to follow can say so explicitly with
   * `theme={{ foreground: 'currentColor', muted: 'currentColor' }}`.
   */
  const resolvedTheme = $derived(
    theme
      ? // A supplied theme — even a partial one — keeps `resolveChartTheme`'s
        // `currentColor` inheritance for the fields it omits, per the documented
        // partial-theme contract. Substituting the global text tokens here would
        // break exactly the case the contract exists for: a caller passing
        // `{ foreground: 'white', background: 'black' }` for a dark panel would
        // get the app's dark `--cinder-text-muted` label on that black surface.
        resolveChartTheme(theme)
      : {
          ...resolveChartTheme(undefined),
          foreground: 'var(--cinder-text)',
          muted: 'var(--cinder-text-muted)',
        },
  );
</script>

<div
  {...rest}
  {id}
  class={classNames('cinder-statistic', customClassName)}
  role="group"
  aria-labelledby={`${labelId} ${valueId}`}
  data-cinder-has-icon={icon ? '' : undefined}
  style:--_cinder-chart-foreground={resolvedTheme.foreground}
  style:--_cinder-chart-muted={resolvedTheme.muted}
  style:--_cinder-chart-background={resolvedTheme.background}
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
