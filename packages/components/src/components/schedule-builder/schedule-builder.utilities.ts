import type { ScheduleIntervalUnit, ScheduleValue } from './schedule-builder.types.ts';

/** The interval units offered in the interval mode selector, in order. */
export const INTERVAL_UNITS: readonly ScheduleIntervalUnit[] = [
  'minutes',
  'hours',
  'days',
  'weeks',
];

/** Weekday chips for the weekly preset. `value` matches cron day-of-week (0 = Sunday). */
export const WEEKDAYS: readonly { value: number; short: string; long: string }[] = [
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
  { value: 6, short: 'Sat', long: 'Saturday' },
  { value: 0, short: 'Sun', long: 'Sunday' },
];

/** The five cron fields, in order, with their valid numeric ranges and hints. */
export const CRON_FIELDS: readonly {
  name: string;
  min: number;
  max: number;
  hint: string;
}[] = [
  { name: 'Minute', min: 0, max: 59, hint: '0–59' },
  { name: 'Hour', min: 0, max: 23, hint: '0–23' },
  { name: 'Day of month', min: 1, max: 31, hint: '1–31' },
  { name: 'Month', min: 1, max: 12, hint: '1–12' },
  { name: 'Day of week', min: 0, max: 6, hint: '0–6 (Sun–Sat)' },
];

/** The default value used when the consumer passes none. */
export function defaultScheduleValue(): ScheduleValue {
  return { mode: 'interval', every: 15, unit: 'minutes' };
}

/** Singularize an interval unit for "every 1 X" phrasing. */
function singularUnit(unit: ScheduleIntervalUnit): string {
  return unit.slice(0, -1);
}

/**
 * Validate a single cron field value against its field range. Accepts a
 * wildcard, a step, a range, a comma list, or a plain number. Returns an error
 * message when invalid, or `undefined` when the field is acceptable.
 */
export function validateCronField(rawValue: string, fieldIndex: number): string | undefined {
  const field = CRON_FIELDS[fieldIndex];
  if (!field) return 'Unknown field.';
  const value = rawValue.trim();
  if (value === '') return 'Required.';

  const inRange = (n: number): boolean => Number.isInteger(n) && n >= field.min && n <= field.max;

  // Comma-separated list: every part must be valid on its own.
  for (const part of value.split(',')) {
    const token = part.trim();
    if (token === '') return 'Empty list item.';

    // `*` or `*/step`
    if (token === '*') continue;
    const stepMatch = token.match(/^(\*|\d+-\d+)\/(\d+)$/);
    if (stepMatch) {
      const step = Number(stepMatch[2] ?? '');
      if (!Number.isInteger(step) || step <= 0) return 'Step must be a positive integer.';
      const rangeText = stepMatch[1] ?? '*';
      if (rangeText !== '*') {
        const [a, b] = rangeText.split('-').map(Number);
        if (a === undefined || b === undefined || !inRange(a) || !inRange(b) || a > b) {
          return `Range out of ${field.hint}.`;
        }
      }
      continue;
    }

    // Range `a-b`
    const rangeMatch = token.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const a = Number(rangeMatch[1]);
      const b = Number(rangeMatch[2]);
      if (!inRange(a) || !inRange(b)) return `Out of range (${field.hint}).`;
      if (a > b) return 'Range start is after its end.';
      continue;
    }

    // Plain number
    if (/^\d+$/.test(token)) {
      if (!inRange(Number(token))) return `Out of range (${field.hint}).`;
      continue;
    }

    return 'Not a valid cron token.';
  }

  return undefined;
}

/** Whether all five cron fields are individually valid. */
export function cronFieldsValid(fields: string[]): boolean {
  return (
    fields.length === 5 &&
    fields.every((value, index) => validateCronField(value, index) === undefined)
  );
}

/** Join five cron fields into a normalized single-space expression. */
export function joinCron(fields: string[]): string {
  return fields.map((field) => field.trim()).join(' ');
}

/** Split a cron expression into exactly five fields, padding with `*` if short. */
export function splitCron(expression: string): [string, string, string, string, string] {
  const parts = expression.trim().split(/\s+/).filter(Boolean);
  return [parts[0] ?? '*', parts[1] ?? '*', parts[2] ?? '*', parts[3] ?? '*', parts[4] ?? '*'];
}

/** Clamp/parse a `HH:MM` time string into `{ hour, minute }`, defaulting to 00:00. */
export function parseTime(time: string): { hour: number; minute: number } {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return { hour: 0, minute: 0 };
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return { hour, minute };
}

// ---------------------------------------------------------------------------
// Preset lowering — presets are sugar that lower to a cron or interval value.
// ---------------------------------------------------------------------------

/** "every N minutes/hours" → an interval value. */
export function lowerEveryN(every: number, unit: ScheduleIntervalUnit): ScheduleValue {
  const safeEvery = Number.isInteger(every) && every > 0 ? every : 1;
  return { mode: 'interval', every: safeEvery, unit };
}

/** "daily at HH:MM" → a cron value. */
export function lowerDailyAt(time: string): ScheduleValue {
  const { hour, minute } = parseTime(time);
  return { mode: 'cron', expression: `${minute} ${hour} * * *` };
}

/** "weekly on [days] at HH:MM" → a cron value. Empty days falls back to every day. */
export function lowerWeeklyAt(days: number[], time: string): ScheduleValue {
  const { hour, minute } = parseTime(time);
  const dow = days.length > 0 ? days.toSorted((a, b) => a - b).join(',') : '*';
  return { mode: 'cron', expression: `${minute} ${hour} * * ${dow}` };
}

/** "monthly on day N at HH:MM" → a cron value. */
export function lowerMonthlyOnDay(day: number, time: string): ScheduleValue {
  const { hour, minute } = parseTime(time);
  const safeDay = Math.min(31, Math.max(1, Math.trunc(day)));
  return { mode: 'cron', expression: `${minute} ${hour} ${safeDay} * *` };
}

// ---------------------------------------------------------------------------
// Cross-mode conversion — preserve intent losslessly where representable.
// ---------------------------------------------------------------------------

/** Convert any value into cron fields, so switching into cron mode is lossless. */
export function valueToCronFields(value: ScheduleValue): string[] {
  if (value.mode === 'cron') return splitCron(value.expression);
  switch (value.unit) {
    case 'minutes':
      return [`*/${value.every}`, '*', '*', '*', '*'];
    case 'hours':
      return ['0', `*/${value.every}`, '*', '*', '*'];
    case 'days':
      return ['0', '0', `*/${value.every}`, '*', '*'];
    case 'weeks':
      // Cron has no "every N weeks"; approximate as weekly on Sunday.
      return ['0', '0', '*', '*', '0'];
  }
}

/**
 * Recover an interval `{ every, unit }` from a value when representable, so
 * switching into interval mode is lossless for simple step patterns. Returns
 * `undefined` when the cron expression is not a pure interval.
 */
export function valueToInterval(
  value: ScheduleValue,
): { every: number; unit: ScheduleIntervalUnit } | undefined {
  if (value.mode === 'interval') return { every: value.every, unit: value.unit };
  const [minute, hour, dom, month, dow] = splitCron(value.expression);
  if (month !== '*' || dow !== '*') return undefined;
  const minuteStep = cronFieldStep(minute);
  if (minuteStep && hour === '*' && dom === '*') return { every: minuteStep, unit: 'minutes' };
  const hourStep = cronFieldStep(hour);
  if (hourStep && minute === '0' && dom === '*') return { every: hourStep, unit: 'hours' };
  const domStep = cronFieldStep(dom);
  if (domStep && minute === '0' && hour === '0') return { every: domStep, unit: 'days' };
  return undefined;
}

/** Extract the numeric step from a bare wildcard-step cron token, or `undefined`. */
function cronFieldStep(token: string): number | undefined {
  const match = token.match(/^\*\/(\d+)$/);
  return match ? Number(match[1]) : undefined;
}

// ---------------------------------------------------------------------------
// Plain-English summary — no date library required.
// ---------------------------------------------------------------------------

const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/** A concise, human-readable description of a recurrence value. */
export function describeValue(value: ScheduleValue): string {
  if (value.mode === 'interval') {
    return value.every === 1
      ? `Every ${singularUnit(value.unit)}`
      : `Every ${value.every} ${value.unit}`;
  }

  const [minute, hour, dom, month, dow] = splitCron(value.expression);
  const timeIsFixed = /^\d+$/.test(minute) && /^\d+$/.test(hour);
  const at = timeIsFixed ? ` at ${pad2(Number(hour))}:${pad2(Number(minute))}` : '';

  // Weekly: fixed day-of-week, wildcards elsewhere.
  if (dom === '*' && month === '*' && dow !== '*' && /^[\d,]+$/.test(dow)) {
    const names = dow
      .split(',')
      .map((d) => DOW_NAMES[Number(d) % 7])
      .join(', ');
    return `Weekly on ${names}${at}`;
  }
  // Monthly: fixed day-of-month.
  if (/^\d+$/.test(dom) && month === '*' && dow === '*') {
    return `Monthly on day ${dom}${at}`;
  }
  // Daily: wildcards on day fields, fixed time.
  if (dom === '*' && month === '*' && dow === '*' && timeIsFixed) {
    return `Daily${at}`;
  }
  return `Cron: ${joinCron([minute, hour, dom, month, dow])}`;
}
