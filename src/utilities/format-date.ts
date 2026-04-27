const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const WEEK = 604_800_000;
const MONTH = 2_592_000_000;

function toDate(input: number | string | Date): Date {
  if (input instanceof Date) return input;
  if (typeof input === 'number') return new Date(input);
  return new Date(input);
}

/**
 * Format a date with explicit locale and time-zone control.
 *
 * Defaults to `en-US` and UTC so call sites stay deterministic across machines and CI shards.
 * Pass an `Intl.DateTimeFormatOptions` object to override the time zone or formatting.
 */
export function formatDate(
  date: Date | string | number,
  locale: string = 'en-US',
  options: Intl.DateTimeFormatOptions = { timeZone: 'UTC' },
): string {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(locale, options).format(d);
}

/** Format a date relative to now (e.g., "5m ago", "2h ago", "3d ago"). */
export function formatRelativeTime(input: number | string | Date): string {
  const date = toDate(input);
  const now = Date.now();
  const elapsed = now - date.getTime();

  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  if (elapsed < WEEK) return `${Math.floor(elapsed / DAY)}d ago`;
  if (elapsed < MONTH) return `${Math.floor(elapsed / WEEK)}w ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Format a timestamp for display. Returns "-" for null/undefined. */
export function formatTimestamp(input: number | string | Date | null | undefined): string {
  if (input === null || input === undefined) return '-';

  const date = toDate(input);

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}
