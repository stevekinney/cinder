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
  import { classNames } from '../../utilities/class-names.ts';
  import Meter from '../meter/index.ts';

  import type { QuotaMeterProps } from './quota-meter.types.ts';

  let {
    used = 0,
    limit = 100,
    resetsAt,
    unlimited = false,
    label = 'Quota',
    children,
    class: customClassName,
    ...rest
  }: QuotaMeterProps = $props();
  const valueText = $derived(
    unlimited
      ? `${used} used, unlimited`
      : `${used} of ${limit} used${resetsAt ? `, resets ${new Date(resetsAt).toLocaleDateString()}` : ''}`,
  );
</script>

<div class={classNames('cinder-quota-meter', customClassName)} {...rest}>
  <Meter
    value={used}
    max={unlimited ? Math.max(used, 1) : limit}
    ariaLabel={label}
    ariaValueText={valueText}
  />{#if children}{@render children()}{/if}
</div>
