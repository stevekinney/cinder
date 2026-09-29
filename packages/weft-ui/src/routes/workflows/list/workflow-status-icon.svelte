<script lang="ts">
  /** Renders the lucide icon named by a `WorkflowStatusBadgeIcon` (plan §10.1). Split out of `workflow-status-badge.ts` because that module stays a plain, framework-free `.ts` file per the console's logic/UI split. */
  import { Ban, CircleCheck, CircleX, Clock, Pause, Play, TimerOff } from 'lucide-svelte';

  import type { WorkflowStatusBadgeIcon } from './workflow-status-badge.ts';

  interface WorkflowStatusIconProps {
    icon: WorkflowStatusBadgeIcon;
  }

  let { icon }: WorkflowStatusIconProps = $props();

  const ICONS = {
    play: Play,
    clock: Clock,
    pause: Pause,
    'circle-x': CircleX,
    'timer-off': TimerOff,
    'circle-check': CircleCheck,
    ban: Ban,
  } as const satisfies Record<WorkflowStatusBadgeIcon, unknown>;

  const Icon = $derived(ICONS[icon]);
</script>

<Icon aria-hidden="true" size={11} />
