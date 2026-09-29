/**
 * Cadence formatting + `ScheduleValue` ⇄ wire-spec conversion (Track B, plan
 * §9.3, design "Schedules" screens: "human-readable" cadence, e.g. "Every 5
 * minutes"). Pure logic, no DOM — colocated `bun test` coverage.
 *
 * `describeCadence()` is a bounded cron humanizer covering the recurrence
 * shapes this console's own `ScheduleBuilder` presets produce (every-N,
 * daily, weekly-on-a-day, monthly-on-a-day) plus fixed intervals. It is
 * deliberately not exhaustive — no external cron-humanizer dependency is
 * pulled in for the bundle-size budget (plan §12) — an expression outside
 * the recognized shapes falls back to `Cron · <expression>` rather than
 * guessing.
 */
import type { ScheduleIntervalUnit, ScheduleValue } from '@lostgradient/cinder';

import type { ScheduleSpec } from '@lostgradient/weft';

/** A schedule's persisted cadence, mutually exclusive per `ScheduleSummary`/`ScheduleState`. */
export interface ScheduleCadence {
  readonly cronExpression?: string;
  readonly intervalMs?: number;
}

const WEEKDAY_NAMES = [
  'Sundays',
  'Mondays',
  'Tuesdays',
  'Wednesdays',
  'Thursdays',
  'Fridays',
  'Saturdays',
];
const WEEKDAY_ALIASES: Readonly<Record<string, number>> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

type CronField =
  | { readonly kind: 'wildcard' }
  | { readonly kind: 'exact'; readonly value: number }
  | { readonly kind: 'step'; readonly step: number }
  | { readonly kind: 'other' };

function parseCronField(raw: string): CronField {
  if (raw === '*') return { kind: 'wildcard' };

  const stepMatch = /^\*\/(\d+)$/.exec(raw);
  if (stepMatch?.[1] !== undefined) return { kind: 'step', step: Number(stepMatch[1]) };

  if (/^\d+$/.test(raw)) return { kind: 'exact', value: Number(raw) };

  const alias = WEEKDAY_ALIASES[raw.toLowerCase()];
  if (alias !== undefined) return { kind: 'exact', value: alias };

  return { kind: 'other' };
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** `1, 'minute'` → `"minute"`; `5, 'minute'` → `"5 minutes"` — matches the design reference's "Every hour" / "Every 5 minutes" convention (no bare "1" prefix). */
function countedUnit(count: number, unit: string): string {
  return count === 1 ? unit : `${count} ${unit}s`;
}

/** Splits a 5-field cron expression, tolerating extra internal whitespace. */
function splitCronFields(expression: string): readonly string[] | null {
  const fields = expression.trim().split(/\s+/);
  return fields.length === 5 ? fields : null;
}

interface ParsedCronFields {
  readonly minute: CronField;
  readonly hour: CronField;
  readonly dom: CronField;
  readonly month: CronField;
  readonly dow: CronField;
}

function describeMinuteStepDaily(minute: CronField, hour: CronField): string | null {
  if (minute.kind !== 'step' || hour.kind !== 'wildcard') return null;
  return `Every ${countedUnit(minute.step, 'minute')}`;
}

function describeHourStepDaily(minute: CronField, hour: CronField): string | null {
  if (hour.kind !== 'step') return null;
  if (minute.kind !== 'exact' || minute.value !== 0) return null;
  return `Every ${countedUnit(hour.step, 'hour')}`;
}

/** Minute pinned, hour wildcard (e.g. `0 * * * *`) — fires once per hour. */
function describeHourlyAtMinute(minute: CronField, hour: CronField): string | null {
  if (minute.kind !== 'exact' || hour.kind !== 'wildcard') return null;
  return minute.value === 0 ? 'Every hour' : `Every hour at :${pad2(minute.value)}`;
}

function describeFixedDailyTime(minute: CronField, hour: CronField): string | null {
  if (minute.kind !== 'exact' || hour.kind !== 'exact') return null;
  return `Every day at ${pad2(hour.value)}:${pad2(minute.value)}`;
}

/** The "fires every day (or every N minutes/hours within a day)" shapes — day-of-month, month, and day-of-week all wildcard. */
function describeDailyShape(fields: ParsedCronFields): string | null {
  const { minute, hour } = fields;
  return (
    describeMinuteStepDaily(minute, hour) ??
    describeHourStepDaily(minute, hour) ??
    describeHourlyAtMinute(minute, hour) ??
    describeFixedDailyTime(minute, hour)
  );
}

/** "Fires on one weekday" — day-of-month and month wildcard, day-of-week pinned to a single 0–6 value. */
function describeWeeklyShape(fields: ParsedCronFields): string | null {
  const { minute, hour, dow } = fields;
  if (dow.kind !== 'exact' || dow.value < 0 || dow.value > 6) return null;
  if (minute.kind !== 'exact' || hour.kind !== 'exact') return null;
  const weekday = WEEKDAY_NAMES[dow.value];
  return `${weekday} at ${pad2(hour.value)}:${pad2(minute.value)}`;
}

/** "Fires on one day-of-month" — month and day-of-week wildcard, day-of-month pinned. */
function describeMonthlyShape(fields: ParsedCronFields): string | null {
  const { minute, hour, dom, month, dow } = fields;
  if (dom.kind !== 'exact' || month.kind !== 'wildcard' || dow.kind !== 'wildcard') return null;
  if (minute.kind !== 'exact' || hour.kind !== 'exact') return null;
  return `Monthly on day ${dom.value} at ${pad2(hour.value)}:${pad2(minute.value)}`;
}

function parseCronFields(fields: readonly string[]): ParsedCronFields {
  const [minuteRaw, hourRaw, domRaw, monthRaw, dowRaw] = fields;
  return {
    minute: parseCronField(minuteRaw ?? ''),
    hour: parseCronField(hourRaw ?? ''),
    dom: parseCronField(domRaw ?? ''),
    month: parseCronField(monthRaw ?? ''),
    dow: parseCronField(dowRaw ?? ''),
  };
}

/** Humanizes a cron expression, falling back to `Cron · <expression>` for shapes outside the bounded set (module doc). */
export function describeCronExpression(expression: string): string {
  const rawFields = splitCronFields(expression);
  if (!rawFields) return `Cron · ${expression}`;

  const fields = parseCronFields(rawFields);
  const domAndMonthWildcard = fields.dom.kind === 'wildcard' && fields.month.kind === 'wildcard';

  if (domAndMonthWildcard && fields.dow.kind === 'wildcard') {
    const daily = describeDailyShape(fields);
    if (daily) return daily;
  }

  if (domAndMonthWildcard) {
    const weekly = describeWeeklyShape(fields);
    if (weekly) return weekly;
  }

  const monthly = describeMonthlyShape(fields);
  if (monthly) return monthly;

  return `Cron · ${expression}`;
}

const INTERVAL_UNIT_MS: readonly { readonly ms: number; readonly unit: string }[] = [
  { ms: 7 * 86_400_000, unit: 'week' },
  { ms: 86_400_000, unit: 'day' },
  { ms: 3_600_000, unit: 'hour' },
  { ms: 60_000, unit: 'minute' },
  { ms: 1_000, unit: 'second' },
];

/** Humanizes a fixed-interval cadence, reducing to the largest whole unit that evenly divides `intervalMs`. */
export function describeIntervalMs(intervalMs: number): string {
  for (const { ms, unit } of INTERVAL_UNIT_MS) {
    if (intervalMs % ms === 0) {
      return `Every ${countedUnit(intervalMs / ms, unit)}`;
    }
  }
  return `Every ${intervalMs}ms`;
}

/** Human-readable cadence for a schedule list/detail row (plan §9.3: "human-readable" cadence). */
export function describeCadence(cadence: ScheduleCadence): string {
  if (cadence.intervalMs !== undefined) return describeIntervalMs(cadence.intervalMs);
  if (cadence.cronExpression !== undefined) return describeCronExpression(cadence.cronExpression);
  return 'Unknown cadence';
}

const CINDER_INTERVAL_UNIT_MS: Readonly<Record<ScheduleIntervalUnit, number>> = {
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
  weeks: 7 * 86_400_000,
};

/**
 * Converts a Cinder `ScheduleBuilder` value into the wire fields Weft's
 * `weft.schedules.create`/`weft.schedules.update` operations accept
 * (`cronExpression` | `every`). Interval mode always resolves to a
 * millisecond NUMBER rather than a duration string — Cinder's `unit: 'weeks'`
 * has no equivalent in Weft's `Duration` string grammar (`ms|s|m|h|d` only;
 * verified against `weft/src/core/scheduler/duration.ts`), so emitting
 * milliseconds sidesteps that gap entirely rather than approximating weeks
 * as `"7d"` × every.
 */
export function scheduleValueToWireSpec(value: ScheduleValue): ScheduleSpec {
  if (value.mode === 'cron') return { cron: value.expression };
  return { every: value.every * CINDER_INTERVAL_UNIT_MS[value.unit] };
}

type IntervalScheduleValue = Extract<ScheduleValue, { mode: 'interval' }>;

/** Reduces a millisecond interval to the largest whole Cinder-supported unit (minutes/hours/days/weeks) that evenly divides it, falling back to minutes (rounded up) for a non-dividing value. */
export function intervalMsToScheduleValue(intervalMs: number): IntervalScheduleValue {
  if (intervalMs % CINDER_INTERVAL_UNIT_MS.weeks === 0) {
    return { mode: 'interval', every: intervalMs / CINDER_INTERVAL_UNIT_MS.weeks, unit: 'weeks' };
  }
  if (intervalMs % CINDER_INTERVAL_UNIT_MS.days === 0) {
    return { mode: 'interval', every: intervalMs / CINDER_INTERVAL_UNIT_MS.days, unit: 'days' };
  }
  if (intervalMs % CINDER_INTERVAL_UNIT_MS.hours === 0) {
    return { mode: 'interval', every: intervalMs / CINDER_INTERVAL_UNIT_MS.hours, unit: 'hours' };
  }
  return {
    mode: 'interval',
    every: Math.max(1, Math.round(intervalMs / CINDER_INTERVAL_UNIT_MS.minutes)),
    unit: 'minutes',
  };
}

/** Rehydrates a persisted schedule's cadence into a `ScheduleValue` for the edit drawer's `ScheduleBuilder`. */
export function cadenceToScheduleValue(cadence: ScheduleCadence): ScheduleValue {
  if (cadence.cronExpression !== undefined)
    return { mode: 'cron', expression: cadence.cronExpression };
  if (cadence.intervalMs !== undefined) return intervalMsToScheduleValue(cadence.intervalMs);
  return { mode: 'interval', every: 15, unit: 'minutes' };
}
