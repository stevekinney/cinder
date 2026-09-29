/**
 * Status badge mapping (Track B, plan §10.1 status badge system; design
 * "Schedules" screens: paused/active/cancelled badges). Pure lookup — no DOM.
 */
import type { ScheduleStatus } from '@lostgradient/weft';

import type { BadgeVariant } from '@lostgradient/cinder';

export interface ScheduleStatusDescriptor {
  readonly variant: BadgeVariant;
  readonly icon: string;
  readonly label: string;
}

const SCHEDULE_STATUS: Readonly<Record<ScheduleStatus, ScheduleStatusDescriptor>> = {
  active: { variant: 'success', icon: 'play', label: 'Active' },
  paused: { variant: 'neutral', icon: 'pause', label: 'Paused' },
  cancelled: { variant: 'neutral', icon: 'circle-x', label: 'Cancelled' },
};

export function scheduleStatusDescriptor(status: ScheduleStatus): ScheduleStatusDescriptor {
  return SCHEDULE_STATUS[status];
}

/** `warning` (red per design) when a schedule has missed fires, `neutral` otherwise (plan §9.3: "missed-fires count red >0"). */
export function missedFireBadgeVariant(missedFireCount: number): BadgeVariant {
  return missedFireCount > 0 ? 'warning' : 'neutral';
}
