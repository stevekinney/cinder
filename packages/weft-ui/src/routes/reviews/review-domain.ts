/**
 * Pure review-domain logic (Track D, plan §9.5, Appendix A "Reviews"). No
 * DOM, no Svelte, no network — everything here is a plain function over
 * `@lostgradient/weft`'s `ReviewListEntry`/`PendingReviewEntry`/
 * `CompletedReviewEntry` shapes so it can be `bun test`ed without a
 * component harness (plan §11.1).
 *
 * ## The "timed out" tab is a client-side derivation, not a server status
 *
 * `ReviewStatus` is only `'pending' | 'completed'` — weft has no third wire
 * status. Verified against `weft/src/core/engine/reviews.ts`
 * `handleReviewEscalationTimer`: when a review's `timeout` deadline elapses,
 * the engine's OWN durable timer (scheduled at `createReview` time,
 * processed on the scheduler's normal poll cadence — not instantaneously at
 * the millisecond the deadline passes) deletes the pending review record and
 * fails the workflow with a `ReviewTimeoutError`. Until that timer actually
 * fires, a review whose deadline has already passed by wall-clock time is
 * still sitting in storage with `status: 'pending'`. The design reference's
 * "Timed out" tab (`design/Weft UI.dc.html` `revStateBtns`) is exactly
 * that window: `isReviewTimedOut()` below reclassifies a `pending` entry
 * whose `createdAt + timeout` has already elapsed, entirely client-side —
 * it never claims the review has actually resolved, only that a decision
 * submitted now may race the server's own cleanup (hence the design's
 * banner copy: "this review can no longer be decided").
 *
 */
import type {
  CompletedReviewEntry,
  PendingReviewEntry,
  ReviewDecision,
  ReviewListEntry,
} from '@lostgradient/weft';

import { formatDuration } from '../../lib/format/index.ts';

/** Reactive query properties consumed by the review views. */
export interface ReviewQuery<Entry> {
  readonly data: Entry | undefined;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly error: unknown;
  readonly refetch: () => void | Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Status narrowing (client.listReviews({status}) returns the ReviewListEntry
// union at the type level regardless of the filter — the server guarantees
// every item matches at runtime, but nothing narrows the TYPE for a given
// filter. These filter defensively rather than casting.)
// ---------------------------------------------------------------------------

export function pendingEntriesOnly(entries: readonly ReviewListEntry[]): PendingReviewEntry[] {
  return entries.filter((entry): entry is PendingReviewEntry => entry.status === 'pending');
}

export function completedEntriesOnly(entries: readonly ReviewListEntry[]): CompletedReviewEntry[] {
  return entries.filter((entry): entry is CompletedReviewEntry => entry.status === 'completed');
}

// ---------------------------------------------------------------------------
// Deadlines and countdowns
// ---------------------------------------------------------------------------

/** Fraction of the review window remaining at/below which the countdown reads as urgent (plan §9.5: "countdown red when <20% remaining"). */
const URGENT_REMAINING_FRACTION = 0.2;

export interface ReviewDeadline {
  /** `false` when the review has no `timeout` (an effectively unbounded review) — every other field is a fixed placeholder in that case. */
  readonly hasDeadline: boolean;
  /** Milliseconds until the deadline; negative once elapsed. */
  readonly remainingMs: number;
  /** `true` once `remainingMs <= 0`. */
  readonly isTimedOut: boolean;
  /** `true` when still pending but under `URGENT_REMAINING_FRACTION` of the window remains. */
  readonly isUrgent: boolean;
}

const NO_DEADLINE: ReviewDeadline = {
  hasDeadline: false,
  remainingMs: Number.POSITIVE_INFINITY,
  isTimedOut: false,
  isUrgent: false,
};

/** Computes the deadline state for a pending entry's `createdAt`/`timeout` pair as of `now`. */
export function reviewDeadline(
  entry: Pick<PendingReviewEntry, 'createdAt' | 'timeout'>,
  now: number,
): ReviewDeadline {
  if (entry.timeout === undefined) return NO_DEADLINE;

  const remainingMs = entry.createdAt + entry.timeout - now;
  const isTimedOut = remainingMs <= 0;
  const isUrgent = !isTimedOut && remainingMs <= entry.timeout * URGENT_REMAINING_FRACTION;
  return { hasDeadline: true, remainingMs, isTimedOut, isUrgent };
}

/** `true` for a pending entry whose deadline has elapsed client-side (module doc). */
export function isReviewTimedOut(
  entry: Pick<PendingReviewEntry, 'createdAt' | 'timeout'>,
  now: number,
): boolean {
  return reviewDeadline(entry, now).isTimedOut;
}

/** Sentence-case countdown label, e.g. "18m left" / "Timed out" (plan §10.10 copy voice: specific numbers, no emoji). */
export function formatReviewCountdown(deadline: ReviewDeadline): string {
  if (!deadline.hasDeadline) return 'No deadline';
  if (deadline.isTimedOut) return 'Timed out';
  return `${formatDuration(deadline.remainingMs)} left`;
}

// ---------------------------------------------------------------------------
// Pending-list partitioning (plan §9.5 tri-state: Pending / Decided / Timed out)
// ---------------------------------------------------------------------------

export type ReviewInboxState = 'pending' | 'completed' | 'timeout';

/** Splits the raw `status: 'pending'` list into the two client-visible buckets the Inbox tri-state needs — `'pending'` never includes an already-timed-out entry. */
export function partitionPendingReviews(
  entries: readonly PendingReviewEntry[],
  now: number,
): {
  readonly pending: readonly PendingReviewEntry[];
  readonly timedOut: readonly PendingReviewEntry[];
} {
  const pending: PendingReviewEntry[] = [];
  const timedOut: PendingReviewEntry[] = [];
  for (const entry of entries) {
    (isReviewTimedOut(entry, now) ? timedOut : pending).push(entry);
  }
  return { pending, timedOut };
}

// ---------------------------------------------------------------------------
// Sectioned artifacts and partial decisions
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Extracts a review's named sections when it was created in "sectioned"
 * shape: `artifact` is a plain object with a `sections` field that is
 * itself a non-empty plain object (`fixtures/reviews.ts`'s `content-review`
 * specimen: `{ documentTitle, sections: { headline, body, callToAction } }`).
 * `sections` is a console-local convention layered on top of weft's
 * `artifact: unknown` — weft has no schema for it — so this only recognizes
 * that one shape; anything else (a bare string, an array, an object without
 * `sections`) is "unsectioned" and rendered as a single artifact block.
 */
export function extractReviewSections(artifact: unknown): Record<string, unknown> | null {
  if (!isPlainObject(artifact)) return null;
  const sections = artifact['sections'];
  if (!isPlainObject(sections)) return null;
  return Object.keys(sections).length > 0 ? sections : null;
}

/** Top-level `artifact` keys other than `sections` — rendered as review metadata above the section list (e.g. `documentTitle`). */
export function extractReviewMetadataEntries(artifact: unknown): Array<[string, unknown]> {
  if (!isPlainObject(artifact)) return [];
  return Object.entries(artifact).filter(([key]) => key !== 'sections');
}

export type SectionDecision = 'approved' | 'rejected';

/**
 * Suggests an overall `ReviewDecision` from a set of per-section decisions —
 * "suggested from sections but never locked" (plan §9.5): the caller always
 * remains free to override before submit. All sections approved → approve;
 * any rejection → needs-changes (matches the design reference's mixed-outcome
 * specimen, `fixtures/reviews.ts`'s completed run: mixed approve/reject →
 * `needs-changes`, not `rejected` — a partial rejection reads as "revise",
 * not "refuse outright"). An empty/undecided set has nothing to suggest.
 */
export function suggestOverallDecision(
  sectionDecisions: ReadonlyMap<string, SectionDecision>,
): ReviewDecision | null {
  if (sectionDecisions.size === 0) return null;
  const values = [...sectionDecisions.values()];
  return values.every((decision) => decision === 'approved') ? 'approved' : 'needs-changes';
}

// ---------------------------------------------------------------------------
// Artifact rendering dispatch (plan §9.5: "Artifact rendering by structure")
// ---------------------------------------------------------------------------

export type ArtifactRenderKind =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'markdown'; readonly markdown: string }
  | { readonly kind: 'image'; readonly imageUrl: string }
  | { readonly kind: 'html'; readonly html: string }
  | { readonly kind: 'inspector'; readonly value: unknown };

/**
 * Classifies one artifact/section value into its rendering treatment (plan
 * §9.5: "string→text, markdown→`@lostgradient/markdown`,
 * imageUrl/htmlContent keys→media, else PayloadInspector with humanized
 * keys"). Dispatch is by STRUCTURE — a bare string is always plain text; a
 * `markdown`/`imageUrl`/`htmlContent` KEY on an object is what selects the
 * richer treatments, never content-sniffing a string for markdown syntax
 * (an artifact author opts in explicitly by key, matching how
 * `imageUrl`/`htmlContent` are necessarily key-driven — there is no
 * "detect an image" heuristic for a bare string).
 */
export function classifyArtifactValue(value: unknown): ArtifactRenderKind {
  if (typeof value === 'string') return { kind: 'text', text: value };

  if (isPlainObject(value)) {
    const markdown = value['markdown'];
    if (typeof markdown === 'string') return { kind: 'markdown', markdown };

    const imageUrl = value['imageUrl'];
    if (typeof imageUrl === 'string') return { kind: 'image', imageUrl };

    const htmlContent = value['htmlContent'];
    if (typeof htmlContent === 'string') return { kind: 'html', html: htmlContent };
  }

  return { kind: 'inspector', value };
}

// ---------------------------------------------------------------------------
// Key humanization (plan §9.5: "PayloadInspector with humanized keys")
// ---------------------------------------------------------------------------

/**
 * Turns a `camelCase`/`snake_case`/`kebab-case` object key into a sentence-
 * case label — `callToAction` → "Call to action", `annual_value` →
 * "Annual value". Shallow (top-level keys only): `PayloadInspector` owns
 * rendering of nested structure once past the first level, and re-labeling
 * every depth would fight its own tree/summary rendering.
 */
export function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  if (spaced.length === 0) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Shallow-maps an object's top-level keys through `humanizeKey`, preserving values and key order. */
export function humanizeKeys(value: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    result[humanizeKey(key)] = entryValue;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Fleet-feed liveness (plan §9.5: "human-review:requested/completed on the fleet feed")
// ---------------------------------------------------------------------------

const REVIEW_FLEET_EVENT_KINDS = new Set(['human-review:requested', 'human-review:completed']);

/** `true` for the two fleet-event kinds the Reviews inbox reacts to. */
export function isReviewFleetEventKind(kind: string): boolean {
  return REVIEW_FLEET_EVENT_KINDS.has(kind);
}
