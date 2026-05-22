export type HourCycle = 'h11' | 'h12' | 'h23' | 'h24';

export type TimeParts = {
  hours: number;
  minutes: number;
  seconds: number;
};

const TIME_PATTERN = /^(?<hours>\d{2}):(?<minutes>\d{2})(?::(?<seconds>\d{2}))?$/;

export function parseTimeString(value: string): TimeParts | null {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) return null;

  const match = TIME_PATTERN.exec(trimmedValue);
  if (!match?.groups) return null;

  const hours = Number(match.groups['hours']);
  const minutes = Number(match.groups['minutes']);
  const seconds = Number(match.groups['seconds'] ?? '0');

  if (!Number.isInteger(hours) || hours < 0 || hours > 23) return null;
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) return null;
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 59) return null;

  return { hours, minutes, seconds };
}

export function serializeTimeParts(parts: TimeParts, includeSeconds: boolean): string {
  const hours = String(parts.hours).padStart(2, '0');
  const minutes = String(parts.minutes).padStart(2, '0');
  const seconds = String(parts.seconds).padStart(2, '0');

  return includeSeconds ? `${hours}:${minutes}:${seconds}` : `${hours}:${minutes}`;
}

export function compareTimeParts(left: TimeParts, right: TimeParts): number {
  const leftTotalSeconds = left.hours * 3600 + left.minutes * 60 + left.seconds;
  const rightTotalSeconds = right.hours * 3600 + right.minutes * 60 + right.seconds;

  return leftTotalSeconds - rightTotalSeconds;
}

export function isTimePartsInRange(
  value: TimeParts,
  min?: TimeParts | null,
  max?: TimeParts | null,
): boolean {
  if (min && compareTimeParts(value, min) < 0) return false;
  if (max && compareTimeParts(value, max) > 0) return false;
  return true;
}

export function normalizeTimeString(value: string, includeSeconds: boolean): string | null {
  const parsedValue = parseTimeString(value);
  if (!parsedValue) return null;
  return serializeTimeParts(parsedValue, includeSeconds);
}

export function resolveHourCycle(
  explicitHourCycle: HourCycle | undefined,
  locale: string | undefined,
): HourCycle {
  if (explicitHourCycle) return explicitHourCycle;

  try {
    const resolvedHourCycle = new Intl.DateTimeFormat(locale, {
      hour: 'numeric',
    }).resolvedOptions().hourCycle;

    if (
      resolvedHourCycle === 'h11' ||
      resolvedHourCycle === 'h12' ||
      resolvedHourCycle === 'h23' ||
      resolvedHourCycle === 'h24'
    ) {
      return resolvedHourCycle;
    }
  } catch {
    // Fall through to the default 12-hour cycle below.
  }

  return 'h12';
}

export function minuteStepFromSeconds(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 1;
  if (step < 60 || step % 60 !== 0) return 1;
  return Math.max(1, Math.min(60, Math.trunc(step / 60)));
}

export function secondStepFromSeconds(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 1;
  if (step >= 60) return 60;
  if (60 % step !== 0) return 1;
  return Math.trunc(step);
}

export function rangeValues(step: number, maximum: number): number[] {
  const normalizedStep = Math.max(1, step);
  const values: number[] = [];

  for (let value = 0; value <= maximum; value += normalizedStep) {
    values.push(value);
  }

  if (values.at(-1) !== maximum && maximum === 59) {
    return values;
  }

  return values;
}

export function displayHourFromTwentyFourHour(
  hours: number,
  hourCycle: HourCycle,
): { hour: number; period: 'AM' | 'PM' | null } {
  if (hourCycle === 'h23' || hourCycle === 'h24') {
    return { hour: hours, period: null };
  }

  if (hours === 0) return { hour: 12, period: 'AM' };
  if (hours < 12) return { hour: hours, period: 'AM' };
  if (hours === 12) return { hour: 12, period: 'PM' };
  return { hour: hours - 12, period: 'PM' };
}

export function twentyFourHourFromDisplayHour(hour: number, period: 'AM' | 'PM'): number {
  if (period === 'AM') {
    return hour === 12 ? 0 : hour;
  }

  return hour === 12 ? 12 : hour + 12;
}
