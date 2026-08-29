<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status beta
   * @purpose Meter composition for quota usage with reset and unlimited states.
   * @tag quota-meter
   * @useWhen Showing usage against a plan or account limit.
   * @avoidWhen Showing task completion.
   * @rationale Nearest alternative: Meter — QuotaMeter adds quota-specific accessible value text.
   */
  export type { QuotaMeterProps } from './quota-meter.types.ts';
</script>

<script lang="ts">
  import { getLocaleContext } from '../../_internal/locale-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import Meter from '@lostgradient/cinder/meter';

  import type { QuotaMeterProps } from './quota-meter.types.ts';

  let {
    used = 0,
    limit = 100,
    resetsAt,
    locale,
    timeZone = 'UTC',
    unlimited = false,
    label = 'Quota',
    children,
    class: customClassName,
    ...rest
  }: QuotaMeterProps = $props();
  const localeContext = getLocaleContext();
  let hasMounted = $state(false);
  $effect(() => {
    hasMounted = true;
  });
  const resolvedLocale = $derived(
    locale ?? localeContext?.locale ?? (hasMounted ? navigator.language : 'en-US'),
  );
  const effectiveUsed = $derived(Number.isFinite(used) ? Math.max(0, used) : 0);
  const parsedResetDate = $derived(resetsAt === undefined ? undefined : new Date(resetsAt));
  const effectiveLimit = $derived(Number.isFinite(limit) && limit > 0 ? limit : 100);
  const resetDate = $derived(
    parsedResetDate && !Number.isNaN(parsedResetDate.getTime())
      ? new Intl.DateTimeFormat(resolvedLocale, { dateStyle: 'medium', timeZone }).format(
          parsedResetDate,
        )
      : undefined,
  );
  const valueText = $derived(
    unlimited
      ? `${effectiveUsed} used, unlimited`
      : `${effectiveUsed} of ${effectiveLimit} used${resetDate ? `, resets ${resetDate}` : ''}`,
  );
</script>

<div class={classNames('cinder-quota-meter', customClassName)} {...rest}>
  <Meter
    {...unlimited ? { verdict: { level: 'unknown' as const, label: valueText } } : {}}
    value={effectiveUsed}
    max={effectiveLimit}
    ariaLabel={label}
    ariaValueText={valueText}
  />{#if children}{@render children()}{/if}
</div>
