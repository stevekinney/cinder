/**
 * Canonical timestamps, defaults, and the clock-rollback rule (DR-2 normative handoff,
 * "Identity, schema, and validation").
 *
 * The host may supply an ID factory and clock to action functions; defaults use
 * `crypto.randomUUID()` and canonical UTC ISO timestamps, generated only at the user-action
 * boundary. Neither the defaults nor a supplied factory ever runs during rendering, validation,
 * hashing, or export.
 *
 * @module
 */

import type { DiffReviewClock, DiffReviewIdFactory } from './types.js';

/** Millisecond-precision UTC ISO-8601, e.g. `2026-01-01T00:00:00.000Z`. */
const CANONICAL_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export const defaultDiffReviewClock: DiffReviewClock = () => new Date().toISOString();

export const defaultDiffReviewIdFactory: DiffReviewIdFactory = () => crypto.randomUUID();

/**
 * A timestamp is canonical when it matches the exact millisecond-precision UTC shape AND
 * round-trips through `Date` unchanged — this also rejects calendar dates that look
 * shape-correct but do not exist (e.g. February 30th), which `Date` silently rolls forward.
 */
export function isCanonicalDiffReviewTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!CANONICAL_TIMESTAMP_PATTERN.test(value)) return false;
  return new Date(value).toISOString() === value;
}

/**
 * The clock-rollback rule: an update timestamp is the later of the record's previous timestamp
 * and the clock's current reading, compared lexically (safe because both are the same canonical,
 * zero-padded, fixed-width shape). A clock that has rolled backward can never move a record's
 * timestamp earlier than it already was.
 */
export function nextDiffReviewUpdatedAt(previousUpdatedAt: string, clockReading: string): string {
  return clockReading > previousUpdatedAt ? clockReading : previousUpdatedAt;
}
