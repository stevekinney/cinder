<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Compact non-interactive label that annotates an adjacent element with a short status, count, or category.
   * @tag billing
   * @tag label
   * @tag indicator
   * @tag subscription
   * @useWhen Annotating a value with a short status word like "new" or "beta".
   * @useWhen Displaying a numeric count next to an icon or title.
   * @useWhen Displaying the billing state of a subscription in a dashboard, invoice list, or account settings page.
   * @useWhen Annotating a plan name, customer row, or invoice line with its current payment lifecycle state.
   * @avoidWhen The label must be interactive or removable — use chip instead.
   * @avoidWhen Showing only a colored dot for presence — use status-dot instead.
   * @related chip, status-dot
   */
  export type { BadgeProps, BadgeSize, BadgeVariant } from './badge.types.ts';
</script>

<script lang="ts">
  import { classNames } from '../../utilities/class-names.ts';

  import type { BadgeProps, BadgeSubscriptionState, BadgeVariant } from './badge.types.ts';

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

  const subscriptionStateIconPaths: Record<BadgeSubscriptionState, string[]> = {
    active: ['M21.801 10A10 10 0 1 1 17 3.335', 'm9 11 3 3L22 4'],
    trialing: ['M12 6v6l4 2', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'],
    'past-due': [
      'm21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z',
      'M12 9v4',
      'M12 17h.01',
    ],
    canceled: ['M15 9 9 15', 'M9 9l6 6', 'M22 12A10 10 0 1 1 12 2a10 10 0 0 1 10 10Z'],
    expired: [
      'M8 2v4',
      'M16 2v4',
      'M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8',
      'M3 10h18',
      'm17 14-5-5',
      'm12 14 5 5',
    ],
    refunded: ['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5'],
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
  const resolvedSubscriptionIconPaths = $derived(
    subscriptionState === undefined ? undefined : subscriptionStateIconPaths[subscriptionState],
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
    {#if resolvedSubscriptionIconPaths}
      <svg
        class="icon-sm"
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        {#each resolvedSubscriptionIconPaths as iconPath (iconPath)}
          <path d={iconPath}></path>
        {/each}
      </svg>
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
