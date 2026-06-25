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
  import type CircleCheck from 'lucide-svelte/icons/circle-check';

  import { classNames } from '../../utilities/class-names.ts';

  import type { BadgeProps, BadgeSubscriptionState, BadgeVariant } from './badge.types.ts';

  type IconComponent = typeof CircleCheck;

  type SubscriptionStateConfiguration = {
    variant: BadgeVariant;
    label: string;
  };

  const subscriptionStateConfigurations: Record<
    BadgeSubscriptionState,
    SubscriptionStateConfiguration
  > = {
    active: { variant: 'success', label: 'Active' },
    trialing: { variant: 'info', label: 'Trialing' },
    'past-due': { variant: 'warning', label: 'Past due' },
    canceled: { variant: 'neutral', label: 'Canceled' },
    expired: { variant: 'danger', label: 'Expired' },
    refunded: { variant: 'neutral', label: 'Refunded' },
  };

  const subscriptionStateIconLoaders: Record<BadgeSubscriptionState, () => Promise<IconComponent>> =
    {
      active: () => import('lucide-svelte/icons/circle-check').then((module) => module.default),
      trialing: () => import('lucide-svelte/icons/clock').then((module) => module.default),
      'past-due': () =>
        import('lucide-svelte/icons/triangle-alert').then((module) => module.default),
      canceled: () => import('lucide-svelte/icons/circle-x').then((module) => module.default),
      expired: () => import('lucide-svelte/icons/calendar-x').then((module) => module.default),
      refunded: () => import('lucide-svelte/icons/rotate-ccw').then((module) => module.default),
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
  const subscriptionIconPromise = $derived(
    subscriptionState === undefined ? undefined : subscriptionStateIconLoaders[subscriptionState](),
  );
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
    {#if subscriptionIconPromise}
      {#await subscriptionIconPromise then SubscriptionIcon}
        <SubscriptionIcon class="icon-sm" aria-hidden="true" />
      {/await}
    {/if}
    {#if children}
      {@render children()}
    {:else}
      {subscriptionStateConfiguration.label}
    {/if}
  {:else}
    {@render children?.()}
  {/if}
</span>
