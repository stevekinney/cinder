import type { FleetEventFrame } from '../lib/live-source/fleet-event-source.svelte.ts';
import { numberField, stringField, workflowBody, workflowHref } from './notification-format.ts';

type NotificationRule = {
  readonly tier: 'critical' | 'warning' | 'info';
  readonly icon: string;
  readonly title: (frame: FleetEventFrame) => string;
  readonly body: (frame: FleetEventFrame) => string;
  readonly href: (frame: FleetEventFrame) => string;
};

/** Every client-visible fleet event kind mapped to its notification treatment. */
export const NOTIFICATION_RULES: Readonly<Record<string, NotificationRule>> = {
  'alert:fired': {
    tier: 'critical',
    icon: 'siren',
    title: () => 'Alert fired',
    body: (frame) => stringField(frame.payload, 'name') ?? 'An alert condition is firing',
    href: () => '/system',
  },
  'task:dead-lettered': {
    tier: 'critical',
    icon: 'circle-x',
    title: (frame) =>
      `Task dead-lettered · ${stringField(frame.payload, 'activityName') ?? 'activity'}`,
    body: (frame) => workflowBody(frame, 'Retries exhausted'),
    href: workflowHref,
  },
  'schedule:missed-fire': {
    tier: 'warning',
    icon: 'calendar-x',
    title: () => 'Schedule missed fire',
    body: (frame) => {
      const missed = numberField(frame.payload, 'missedCount');
      return missed !== undefined
        ? `${missed} scheduled tick${missed === 1 ? '' : 's'} skipped`
        : 'A scheduled tick was skipped';
    },
    href: () => '/schedules',
  },
  'constraint:violated': {
    tier: 'warning',
    icon: 'shield-alert',
    title: (frame) =>
      `Constraint violated · ${stringField(frame.payload, 'constraint') ?? 'unnamed'}`,
    body: (frame) => workflowBody(frame, 'A workflow exceeded a configured constraint'),
    href: workflowHref,
  },
  'checkpoint:size-warning': {
    tier: 'warning',
    icon: 'database',
    title: () => 'Checkpoint size warning',
    body: (frame) => workflowBody(frame, 'A checkpoint is approaching the size limit'),
    href: workflowHref,
  },
  'human-review:requested': {
    tier: 'info',
    icon: 'user-check',
    title: (frame) =>
      `Human review requested · ${stringField(frame.payload, 'reviewType') ?? 'review'}`,
    body: (frame) => workflowBody(frame, 'Waiting on reviewers'),
    href: () => '/reviews',
  },
  'alert:resolved': {
    tier: 'info',
    icon: 'check-check',
    title: () => 'Alert resolved',
    body: (frame) => stringField(frame.payload, 'name') ?? 'A firing alert has resolved',
    href: () => '/system',
  },
  'worker:connected': {
    tier: 'info',
    icon: 'plug',
    title: () => 'Worker connected',
    body: (frame) => stringField(frame.payload, 'id') ?? 'A worker joined the fleet',
    href: () => '/workers',
  },
  'worker:disconnected': {
    tier: 'warning',
    icon: 'plug-zap',
    title: () => 'Worker disconnected',
    body: (frame) => stringField(frame.payload, 'id') ?? 'A worker left the fleet',
    href: () => '/workers',
  },
  'workflow:started': {
    tier: 'info',
    icon: 'play',
    title: () => 'Workflow started',
    body: (frame) => workflowBody(frame, 'A workflow started'),
    href: workflowHref,
  },
  'workflow:completed': {
    tier: 'info',
    icon: 'circle-check',
    title: () => 'Workflow completed',
    body: (frame) => workflowBody(frame, 'A workflow completed'),
    href: workflowHref,
  },
  'workflow:failed': {
    tier: 'warning',
    icon: 'circle-x',
    title: () => 'Workflow failed',
    body: (frame) => workflowBody(frame, 'A workflow failed'),
    href: workflowHref,
  },
  'workflow:cancelled': {
    tier: 'warning',
    icon: 'ban',
    title: () => 'Workflow cancelled',
    body: (frame) => workflowBody(frame, 'A workflow was cancelled'),
    href: workflowHref,
  },
  'workflow:timed-out': {
    tier: 'warning',
    icon: 'clock-alert',
    title: () => 'Workflow timed out',
    body: (frame) => workflowBody(frame, 'A workflow exceeded its execution deadline'),
    href: workflowHref,
  },
  'workflow:resumed': {
    tier: 'info',
    icon: 'play',
    title: () => 'Workflow resumed',
    body: (frame) => workflowBody(frame, 'A workflow resumed'),
    href: workflowHref,
  },
  'workflow:suspended': {
    tier: 'info',
    icon: 'pause',
    title: () => 'Workflow suspended',
    body: (frame) => workflowBody(frame, 'A workflow was suspended'),
    href: workflowHref,
  },
  'workflow:teardown': {
    tier: 'info',
    icon: 'trash-2',
    title: () => 'Workflow torn down',
    body: (frame) => workflowBody(frame, 'A finalizer ran for a terminal workflow'),
    href: workflowHref,
  },
  'activity:started': {
    tier: 'info',
    icon: 'play',
    title: (frame) =>
      `Activity started · ${stringField(frame.payload, 'activityName') ?? 'activity'}`,
    body: (frame) => workflowBody(frame, 'An activity started'),
    href: workflowHref,
  },
  'activity:completed': {
    tier: 'info',
    icon: 'circle-check',
    title: (frame) =>
      `Activity completed · ${stringField(frame.payload, 'activityName') ?? 'activity'}`,
    body: (frame) => workflowBody(frame, 'An activity completed'),
    href: workflowHref,
  },
  'activity:failed': {
    tier: 'warning',
    icon: 'circle-x',
    title: (frame) =>
      `Activity failed · ${stringField(frame.payload, 'activityName') ?? 'activity'}`,
    body: (frame) => workflowBody(frame, 'An activity failed'),
    href: workflowHref,
  },
  'activity:async-pending': {
    tier: 'info',
    icon: 'clock',
    title: (frame) =>
      `Awaiting external completion · ${stringField(frame.payload, 'activityName') ?? 'activity'}`,
    body: (frame) => workflowBody(frame, 'An activity is waiting on an external completion'),
    href: workflowHref,
  },
  'signal:received': {
    tier: 'info',
    icon: 'radio',
    title: (frame) => `Signal received · ${stringField(frame.payload, 'name') ?? 'signal'}`,
    body: (frame) => workflowBody(frame, 'A workflow received a signal'),
    href: workflowHref,
  },
  'signal:delivered': {
    tier: 'info',
    icon: 'radio',
    title: (frame) => `Signal delivered · ${stringField(frame.payload, 'name') ?? 'signal'}`,
    body: (frame) => workflowBody(frame, 'A queued signal was delivered'),
    href: workflowHref,
  },
  'attributes:changed': {
    tier: 'info',
    icon: 'tag',
    title: () => 'Attributes changed',
    body: (frame) => workflowBody(frame, 'A workflow updated its search attributes'),
    href: workflowHref,
  },
  'update:received': {
    tier: 'info',
    icon: 'pencil',
    title: (frame) => `Update received · ${stringField(frame.payload, 'name') ?? 'update'}`,
    body: (frame) => workflowBody(frame, 'A workflow received an update'),
    href: workflowHref,
  },
  'update:completed': {
    tier: 'info',
    icon: 'file-check',
    title: (frame) => `Update completed · ${stringField(frame.payload, 'name') ?? 'update'}`,
    body: (frame) => workflowBody(frame, 'A pending update settled'),
    href: workflowHref,
  },
  'schedule:fired': {
    tier: 'info',
    icon: 'calendar-clock',
    title: () => 'Schedule fired',
    body: (frame) => workflowBody(frame, 'A schedule launched a run'),
    href: workflowHref,
  },
  'development:warning': {
    tier: 'warning',
    icon: 'triangle-alert',
    title: () => 'Development warning',
    body: (frame) => stringField(frame.payload, 'message') ?? 'A development-mode diagnostic fired',
    href: () => '/system',
  },
  'cleanup:warning': {
    tier: 'warning',
    icon: 'triangle-alert',
    title: () => 'Cleanup warning',
    body: (frame) =>
      stringField(frame.payload, 'message') ?? 'A retention cleanup pass reported a warning',
    href: () => '/system',
  },
  'storage:size-reported': {
    tier: 'warning',
    icon: 'hard-drive',
    title: () => 'Storage size warning',
    body: (frame) =>
      stringField(frame.payload, 'message') ?? 'Storage usage crossed a reporting threshold',
    href: () => '/storage',
  },
  'human-review:completed': {
    tier: 'info',
    icon: 'circle-check',
    title: () => 'Review completed',
    body: (frame) => workflowBody(frame, 'A human review was decided'),
    href: () => '/reviews',
  },
};
