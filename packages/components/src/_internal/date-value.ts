/**
 * Shared date/date-time value normalization for `date-picker` and
 * `date-range-field`.
 *
 * Both components maintain a controlled ISO-8601 local value string and need
 * identical validation/normalization: reject malformed or out-of-range date
 * parts (including leap-year handling), pad time parts to the component's
 * configured granularity, and truncate excess precision. Centralizing this
 * here means a correctness fix (e.g. a day-count edge case) applies to both
 * components at once instead of silently diverging between two copies.
 */

export type DateValueGranularity = 'day' | 'hour' | 'minute' | 'second';

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

function isValidDatePart(datePart: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return false;
  const [, rawYear, rawMonth, rawDay] = match;
  const year = Number(rawYear);
  const monthValue = Number(rawMonth);
  const day = Number(rawDay);
  return monthValue >= 1 && monthValue <= 12 && day >= 1 && day <= daysInMonth(year, monthValue);
}

function isValidTimePart(timePart: string): boolean {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(timePart);
  if (!match) return false;
  const [, rawHour, rawMinute, rawSecond = '00'] = match;
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  const second = Number(rawSecond);
  return hour <= 23 && minute <= 59 && second <= 59;
}

/**
 * Normalize a date or date-time value to the given granularity.
 *
 * Returns `undefined` when `value` is empty/undefined or does not parse to a
 * valid date (including leap-year-aware day-count validation). For
 * `granularity !== 'day'`, pads the time part to the granularity's precision
 * and truncates excess precision (e.g. a `second`-precision input value
 * passed with `granularity: 'day'` drops the time part entirely).
 */
export function normalizeDateValue(
  value: string | undefined,
  granularity: DateValueGranularity,
): string | undefined {
  if (!value) return undefined;
  const datePart = value.slice(0, 10);
  if (!isValidDatePart(datePart)) return undefined;
  if (granularity === 'day') return datePart;
  const timePart = value.length === 10 ? '00:00' : value[10] === 'T' ? value.slice(11) : undefined;
  if (!timePart || !isValidTimePart(timePart)) return undefined;
  const [rawHour = '00', rawMinute = '00', rawSecond = '00'] = timePart.split(':');
  const hour = rawHour.padStart(2, '0').slice(0, 2);
  const minute = rawMinute.padStart(2, '0').slice(0, 2);
  const second = rawSecond.padStart(2, '0').slice(0, 2);
  if (granularity === 'hour') return `${datePart}T${hour}:00`;
  if (granularity === 'minute') return `${datePart}T${hour}:${minute}`;
  return `${datePart}T${hour}:${minute}:${second}`;
}
