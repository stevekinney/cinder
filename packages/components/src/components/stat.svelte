<script lang="ts" module>
  import type { HTMLAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';

  /** Direction of a stat change indicator. */
  export type StatChangeDirection = 'up' | 'down' | 'neutral';

  /** Data for the optional change indicator rendered below the stat value. */
  export type StatChange = {
    /** The change magnitude as a display string, e.g. "4.75%", "+$120", "12". */
    value: string;
    /** Direction of change — drives icon + color. */
    direction: StatChangeDirection;
    /** Optional visible description, e.g. "from last month". Rendered aria-hidden. */
    description?: string;
    /**
     * Optional fully-worded accessible label for the change indicator.
     * When omitted, a phrase is synthesized from `direction` + `value` (+ optional `description`).
     * When provided, used verbatim — the caller owns the full wording.
     */
    ariaLabel?: string;
  };

  export type StatProps = Omit<HTMLAttributes<HTMLDivElement>, 'class'> & {
    /** Short label describing the metric, e.g. "Monthly Revenue". */
    label: string;
    /** The statistic. Strings rendered verbatim; numbers formatted via formatNumber. */
    value: string | number;
    /** Optional change indicator with direction and accessible wording. */
    change?: StatChange;
    /** Optional leading icon snippet (decorative — wrapper is aria-hidden). */
    icon?: Snippet;
    /** Intl.NumberFormat options applied only when `value` is a number. */
    valueFormatOptions?: Intl.NumberFormatOptions;
    /** Locale forwarded to formatNumber (defaults to en-US). */
    valueLocale?: string;
    /** Additional class names merged with `.cinder-stat`. */
    class?: string;
  };
</script>

<script lang="ts">
  import { classNames } from '../utilities/class-names.ts';
  import { formatNumber } from '../utilities/format-number.ts';
  import { useId } from '../utilities/use-id.ts';

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
