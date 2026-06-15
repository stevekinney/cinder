<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status alpha
   * @purpose Opinionated Badge variant that communicates billing subscription states with a standardized tone, icon, and human-readable label.
   * @tag billing
   * @tag subscription
   * @tag status
   * @useWhen Displaying the billing state of a subscription in a dashboard, invoice list, or account settings page.
   * @useWhen Annotating a plan name, customer row, or invoice line with its current payment lifecycle state.
   * @avoidWhen The subscription state is not one of the six recognized values — use Badge directly with a custom label instead.
   * @avoidWhen You need an interactive control that lets users change the state — use a Button or Select.
   * @related badge, status-dot, chip
   */
  export type { SubscriptionBadgeProps, SubscriptionState } from './subscription-badge.types.ts';
</script>

<script lang="ts">
  import CircleCheck from 'lucide-svelte/icons/circle-check';
  import Clock from 'lucide-svelte/icons/clock';
  import TriangleAlert from 'lucide-svelte/icons/triangle-alert';
  import CircleX from 'lucide-svelte/icons/circle-x';
  import CalendarX from 'lucide-svelte/icons/calendar-x';
  import RotateCcw from 'lucide-svelte/icons/rotate-ccw';

  import Badge from '../badge/badge.svelte';
  import type { BadgeVariant } from '../badge/badge.types.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import type { SubscriptionBadgeProps, SubscriptionState } from './subscription-badge.types.ts';

  // lucide-svelte ships its icons as Svelte component classes. Every lucide icon
  // shares one signature, so the config types its icon field as the type of a
  // single concrete icon rather than the Svelte 5 `Component` functional type,
  // which does not structurally match the class export under svelte-check.
  type IconComponent = typeof CircleCheck;

  interface StateConfig {
    tone: BadgeVariant;
    icon: IconComponent;
    label: string;
  }

  const STATE_CONFIG: Record<SubscriptionState, StateConfig> = {
    active: { tone: 'success', icon: CircleCheck, label: 'Active' },
    trialing: { tone: 'info', icon: Clock, label: 'Trialing' },
    'past-due': { tone: 'warning', icon: TriangleAlert, label: 'Past due' },
    canceled: { tone: 'neutral', icon: CircleX, label: 'Canceled' },
    expired: { tone: 'danger', icon: CalendarX, label: 'Expired' },
    refunded: { tone: 'neutral', icon: RotateCcw, label: 'Refunded' },
  };

  let { state, class: customClassName, ...rest }: SubscriptionBadgeProps = $props();

  const config = $derived(STATE_CONFIG[state]);
  const Icon = $derived(config.icon);
  const label = $derived(config.label);
  const tone = $derived(config.tone);
</script>

<Badge
  variant={tone}
  class={classNames('cinder-subscription-badge', customClassName)}
  data-cinder-state={state}
  {...rest}
>
  <Icon class="icon-sm" aria-hidden="true" />
  {label}
</Badge>
