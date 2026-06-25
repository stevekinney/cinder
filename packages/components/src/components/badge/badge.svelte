<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Compact non-interactive label that annotates an adjacent element with a short status, count, or category.
   * @tag label
   * @tag indicator
   * @useWhen Annotating a value with a short status word like "new" or "beta".
   * @useWhen Displaying a numeric count next to an icon or title.
   * @avoidWhen The label must be interactive or removable — use chip instead.
   * @avoidWhen Showing only a colored dot for presence — use status-dot instead.
   * @related chip, status-dot
   */
  export type { BadgeProps, BadgeSize, BadgeVariant } from './badge.types.ts';
</script>

<script lang="ts">
  import CalendarX from 'lucide-svelte/icons/calendar-x';
  import CircleCheck from 'lucide-svelte/icons/circle-check';
  import CircleX from 'lucide-svelte/icons/circle-x';
  import Clock from 'lucide-svelte/icons/clock';
  import RotateCcw from 'lucide-svelte/icons/rotate-ccw';
  import TriangleAlert from 'lucide-svelte/icons/triangle-alert';

  import { classNames } from '../../utilities/class-names.ts';

  import type { BadgeProps, BadgeSubscriptionState, BadgeVariant } from './badge.types.ts';

  type IconComponent = typeof CircleCheck;

  type SubscriptionStateConfiguration = {
    variant: BadgeVariant;
    icon: IconComponent;
    label: string;
  };

  const subscriptionStateConfigurations: Record<
    BadgeSubscriptionState,
    SubscriptionStateConfiguration
  > = {
    active: { variant: 'success', icon: CircleCheck, label: 'Active' },
    trialing: { variant: 'info', icon: Clock, label: 'Trialing' },
    'past-due': { variant: 'warning', icon: TriangleAlert, label: 'Past due' },
    canceled: { variant: 'neutral', icon: CircleX, label: 'Canceled' },
    expired: { variant: 'danger', icon: CalendarX, label: 'Expired' },
    refunded: { variant: 'neutral', icon: RotateCcw, label: 'Refunded' },
  };

  let {
    variant = 'neutral',
    size = 'md',
    mono = false,
    subscriptionState,
    class: customClassName,
    children,
    ...rest
  }: BadgeProps = $props();

  const subscriptionStateConfiguration = $derived(
    subscriptionState === undefined
      ? undefined
      : subscriptionStateConfigurations[subscriptionState],
  );
  const resolvedVariant = $derived(subscriptionStateConfiguration?.variant ?? variant);
  const SubscriptionIcon = $derived(subscriptionStateConfiguration?.icon);
</script>

<span
  class={classNames('cinder-badge', customClassName)}
  data-cinder-variant={resolvedVariant}
  data-cinder-size={size}
  data-cinder-mono={mono ? '' : undefined}
  data-cinder-subscription-state={subscriptionState}
  {...rest}
>
  {#if subscriptionStateConfiguration}
    {#if SubscriptionIcon}
      <SubscriptionIcon class="icon-sm" aria-hidden="true" />
    {/if}
    {subscriptionStateConfiguration.label}
  {:else}
    {@render children?.()}
  {/if}
</span>
