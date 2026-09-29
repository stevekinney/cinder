/**
 * Formatting helpers (plan §4, §10.8, T1.3): id truncation, durations,
 * bytes, relative time. Frozen after the Phase 1 Foundation gate — see
 * PROJECT-BRIEF "Shared contracts".
 *
 * `computeNextFires` (the `cron-parser`-backed callback injected into
 * Cinder's `ScheduleBuilder`, plan §7.1) lives in `./cron-preview.ts`, not
 * here — split out as a T1.6 integration fix (reported per PROJECT-BRIEF's
 * "small integration bugs in `src/lib/**`" allowance) after it was found to
 * pull the entire `cron-parser` dependency into every consumer of these
 * otherwise-tiny generic formatters, including shell chrome that has
 * nothing to do with schedules. Import `computeNextFires` from
 * `./cron-preview.ts` directly.
 */

/**
 * Truncates a high-cardinality id to `first8…last4` for display (plan §10.8).
 * IDs shorter than 13 characters (8 + 1 ellipsis + 4) are returned unchanged
 * — there is nothing useful to hide.
 */
export function truncateId(id: string): string {
  if (id.length <= 13) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

const DURATION_UNITS: readonly { readonly ms: number; readonly label: string }[] = [
  { ms: 86_400_000, label: 'd' },
  { ms: 3_600_000, label: 'h' },
  { ms: 60_000, label: 'm' },
  { ms: 1_000, label: 's' },
];

/**
 * Formats a millisecond duration as a compact human string, e.g. `1h 20m`,
 * `45s`, `500ms`. Shows at most two significant units.
 */
export function formatDuration(milliseconds: number): string {
  const absolute = Math.abs(milliseconds);
  if (absolute < 1_000) return `${Math.round(milliseconds)}ms`;

  const sign = milliseconds < 0 ? '-' : '';
  const parts: string[] = [];
  let remaining = absolute;

  for (const { ms, label } of DURATION_UNITS) {
    if (remaining < ms) continue;
    const value = Math.floor(remaining / ms);
    remaining -= value * ms;
    parts.push(`${value}${label}`);
    if (parts.length === 2) break;
  }

  return sign + (parts.length > 0 ? parts.join(' ') : '0s');
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** Formats a byte count as e.g. `1.2 KB`, `340 B`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = value >= 10 ? 0 : 1;
  return `${value.toFixed(precision)} ${BYTE_UNITS[unitIndex]}`;
}

/**
 * Formats a timestamp relative to `now` as e.g. `2m ago`, `in 3h`, `just now`.
 */
export function formatRelativeTime(timestampMs: number, now: number = Date.now()): string {
  const deltaMs = timestampMs - now;
  const absolute = Math.abs(deltaMs);
  if (absolute < 5_000) return 'just now';

  const suffix = deltaMs < 0 ? 'ago' : undefined;
  const prefix = deltaMs > 0 ? 'in' : undefined;
  const magnitude = formatDuration(absolute).split(' ')[0] ?? formatDuration(absolute);

  return suffix ? `${magnitude} ${suffix}` : `${prefix} ${magnitude}`;
}
