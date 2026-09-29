/**
 * Preload-outcome presentation (WFT-116): turns the wire outcome of
 * `weft.workflows.revisions.preload` into text an operator can act on.
 *
 * `weft.workflows.revisions.preload` (`workflows:admin`) validates an existing
 * catalog entry or loads, validates, and installs one registered source
 * revision durably into the workflow catalog. It resolves with the installed
 * `WorkflowRevisionRecord`, or faults with one of a bounded set this module
 * enumerates exhaustively from the server's own mapping
 * (`preload-workflow-revision.ts` plus `workflow-catalog-operation-helpers.ts`'s
 * `throwWorkflowCatalogOperationFault`, both verified against the published
 * `@lostgradient/weft` 0.25.0 tree):
 *
 * - `NotFound` + `data.resource: 'workflow-source'` — nothing was ever
 *   `registerSource()`-registered under this exact `(name, revision)` key.
 * - `NotFound` + `data.resource: 'workflow-revision'` — the revision is not
 *   installed (`WorkflowRevisionNotInstalledError`).
 * - `Conflict` + `data.reason: 'load-failed'` — the loader threw, or the
 *   source was otherwise unavailable. The server deliberately never
 *   forwards the loader's own message (it can carry a filesystem path or a
 *   credentialed URL); the classified cause is observable instead through
 *   `weft.catalog.diagnostics`' `source.lastFailureCategory`, which is
 *   why the panel re-fetches diagnostics after a failed preload. Correlating
 *   that observation with this failure requires routing both requests to the
 *   same engine process.
 * - `Conflict` + `data.reason: 'validation-failed'` + `sourceValidationReasons`
 *   — a stored manifest or freshly loaded candidate failed validation against
 *   the source descriptor; the bounded reason list is rendered verbatim.
 * - `Conflict` + `data.reason: 'ambiguous-revision'` — two or more
 *   registered revisions matched and the engine refused to guess.
 * - `Conflict` + `data.reason: 'catalog-conflict'` — a durable catalog
 *   conflict (`WorkflowCatalogConflictError`).
 * - `Conflict` + `data.reason` of `'not-registered' | 'legacy-ambiguous' |
 *   'not-installed'` — `WorkflowRevisionUnavailableError` (WFT-21), which
 *   `runSharedSourceLoad()` throws directly for a tombstoned revision.
 * - `InvalidParams` — a malformed `name`/`revision`, rejected before any
 *   load is attempted.
 *
 * Like `compatibility-verdict.ts`, this module never reimplements any of
 * that server-side logic; it only labels what comes back. The reason
 * literals below are hand-declared mirrors of closed unions that live in
 * server-only modules — a VALUE import from the package root would pull
 * Weft's server module graph into the browser bundle (see
 * `../../lib/faults.ts`'s module doc).
 */
import { HttpClientError } from '@lostgradient/weft';

import { KNOWN_COMPATIBILITY_REASONS } from './compatibility-verdict.ts';

/**
 * Every `data.reason` a preload `Conflict` can carry. Sourced from
 * `DynamicWorkflowSourceUnavailableError.reason`, `WorkflowSourceValidationError`,
 * `WorkflowCatalogConflictError`, and `WorkflowRevisionUnavailableError.reason`
 * as mapped by `throwWorkflowCatalogOperationFault`.
 */
export const KNOWN_PRELOAD_CONFLICT_REASONS = [
  'load-failed',
  'ambiguous-revision',
  'validation-failed',
  'catalog-conflict',
  'not-registered',
  'legacy-ambiguous',
  'not-installed',
] as const;

type KnownPreloadConflictReason = (typeof KNOWN_PRELOAD_CONFLICT_REASONS)[number];

const PRELOAD_CONFLICT_REASON_LABELS: Readonly<Record<KnownPreloadConflictReason, string>> = {
  'load-failed':
    'The source loader failed. Weft never forwards the loader’s own message; check the load state below for its bounded failure category.',
  'ambiguous-revision':
    'More than one registered revision matched, so Weft refused to pick one. Name an exact revision.',
  // NOT "the module loaded but failed validation": when the revision is already
  // in the durable catalog, `resolveCachedOrHandle()` validates the CACHED
  // manifest against the descriptor's pins and throws before the loader is ever
  // invoked. Both paths produce this same reason, so the copy must cover both.
  'validation-failed':
    'The candidate failed validation against the registered source descriptor. Every rejection reason is listed below. Depending on whether this revision was already in the catalog, this may have been decided against the stored manifest without loading the module.',
  // A revision IS the identity, so "another revision holds it" is incoherent:
  // the collision is on this exact `(name, revision)` key, against different
  // stored content — or a concurrent catalog mutation.
  'catalog-conflict':
    'The durable workflow catalog rejected the install. This exact revision is already stored with different contract metadata, or the catalog changed concurrently.',
  'not-registered': 'This revision is no longer registered with the serving engine.',
  'legacy-ambiguous': 'This revision predates revision pinning, so Weft cannot resolve it.',
  'not-installed': 'This revision was removed from the catalog while the load was running.',
};

/**
 * Every `WorkflowSourceRejectionReason` a `validation-failed` conflict can
 * list. The first five are source-structural; the remaining five are
 * `WorkflowCompatibilityReason` reused verbatim upstream, so they are
 * spread in from `compatibility-verdict.ts` rather than duplicated — the
 * same closed union, labelled once.
 */
export const KNOWN_SOURCE_REJECTION_REASONS = [
  'unregistered-source-kind',
  'missing-export',
  'ambiguous-export',
  'invalid-definition',
  'manifest-build-failed',
  ...KNOWN_COMPATIBILITY_REASONS,
] as const;

type KnownSourceRejectionReason = (typeof KNOWN_SOURCE_REJECTION_REASONS)[number];

/**
 * Labels for every source-rejection reason, INCLUDING the five shared with
 * `WorkflowCompatibilityReason` — which is why this table does not defer to
 * `compatibilityReasonLabel()` for them.
 *
 * The two contexts compare different things. Activation compares a candidate
 * against the catalog's currently active revision, and
 * `compatibilityReasonLabel()`'s copy says so. Source validation
 * compares a stored manifest or freshly loaded candidate against the
 * synthetic expected manifest built from the `registerSource()`
 * descriptor; it never consults the active pointer at all. Reusing the
 * activation copy here pointed the operator's remediation at an unrelated
 * revision — the descriptor or the artifact is what they need to look at.
 */
const SOURCE_REJECTION_REASON_LABELS: Readonly<Record<KnownSourceRejectionReason, string>> = {
  'unregistered-source-kind': 'The descriptor names a source kind this engine cannot load.',
  'missing-export': 'The module does not export the name the descriptor points at.',
  'ambiguous-export': 'The module exports more than one candidate workflow definition.',
  'invalid-definition': 'The candidate workflow definition is invalid or could not be normalized.',
  'manifest-build-failed': 'A revision manifest could not be built from the loaded contract.',
  'name-mismatch': 'The candidate workflow is named differently from the descriptor.',
  'manifest-version-unsupported':
    'The candidate uses a manifest schema version this engine does not support.',
  // "candidate", not "loaded artifact": these are reached from the cached-manifest
  // path too, where nothing was loaded (see `validation-failed` above).
  'contract-hash-mismatch':
    'The candidate’s contract does not match the contractHash the descriptor pins.',
  'workflow-version-incompatible':
    'The candidate’s workflow version does not match the workflowVersion the descriptor pins.',
  'artifact-revision-mismatch':
    'The candidate derives a different revision from the one the descriptor names. A revision is a content identity, so the descriptor must name the revision the artifact actually produces.',
};

function isKnownSourceRejectionReason(value: string): value is KnownSourceRejectionReason {
  return Object.hasOwn(SOURCE_REJECTION_REASON_LABELS, value);
}

/**
 * Human-readable label for one source-rejection reason. An unrecognized
 * string renders honestly as `"unknown reason: <value>"` rather than a
 * fabricated label.
 */
export function sourceRejectionReasonLabel(reason: string): string {
  return isKnownSourceRejectionReason(reason)
    ? SOURCE_REJECTION_REASON_LABELS[reason]
    : `unknown reason: ${reason}`;
}

function isKnownConflictReason(value: string): value is KnownPreloadConflictReason {
  return Object.hasOwn(PRELOAD_CONFLICT_REASON_LABELS, value);
}

/** Operator copy for one preload conflict reason, or an honest fallback for an unrecognized one. */
export function preloadConflictReasonLabel(reason: string): string {
  return isKnownConflictReason(reason)
    ? PRELOAD_CONFLICT_REASON_LABELS[reason]
    : `Weft refused the preload for a reason this console does not recognize: ${reason}`;
}

/** One attempt at `weft.workflows.revisions.preload`: either it installed a revision, or it threw. */
export type PreloadAttempt =
  | { readonly installed: true; readonly revision: string }
  | { readonly installed: false; readonly error: unknown };

/**
 * A render-ready preload outcome. Every variant is an EXPECTED result this
 * console renders as text — including `'faulted'`, the catch-all for a
 * fault whose shape this build does not recognize. Nothing is rethrown:
 * unlike `describeActivationOutcome`, a preload has no "this isn't my
 * error" case worth escalating to the shared mutation toast, because the
 * panel's outcome region is already the right place for every failure and
 * a toast would additionally hide which `(name, revision)` failed.
 */
export type PreloadOutcome =
  | { readonly kind: 'installed'; readonly revision: string }
  | { readonly kind: 'no-source'; readonly message: string }
  | {
      readonly kind: 'rejected';
      readonly reason: string;
      readonly message: string;
      readonly rejectionReasons: readonly string[];
    }
  | { readonly kind: 'invalid'; readonly message: string }
  | { readonly kind: 'denied'; readonly message: string }
  | { readonly kind: 'faulted'; readonly message: string };

/** The subset of a preload fault's `data` this module reads — narrower than the full wire payload. */
interface PreloadFaultData {
  readonly reason?: string;
  readonly resource?: string;
  readonly sourceValidationReasons?: readonly string[];
}

function readPreloadFaultData(error: HttpClientError): PreloadFaultData {
  const data = error.data;
  if (typeof data !== 'object' || data === null) return {};
  const record = data as Record<string, unknown>;
  const reasons = Array.isArray(record['sourceValidationReasons'])
    ? record['sourceValidationReasons'].filter(
        (entry): entry is string => typeof entry === 'string',
      )
    : [];
  return {
    ...(typeof record['reason'] === 'string' ? { reason: record['reason'] } : {}),
    ...(typeof record['resource'] === 'string' ? { resource: record['resource'] } : {}),
    ...(reasons.length > 0 ? { sourceValidationReasons: reasons } : {}),
  };
}

function describeNotFound(data: PreloadFaultData, name: string, revision: string): PreloadOutcome {
  return {
    kind: 'no-source',
    message:
      data.resource === 'workflow-revision'
        ? `Revision "${revision}" of "${name}" is not installed.`
        : `No dynamic workflow source is registered for "${name}" at revision "${revision}". A source must be registered with engine.registerSource() in the serving process before it can be preloaded.`,
  };
}

/** A rejection that never reached the fault wire at all — a network failure, an aborted request, a thrown non-`Error`. */
function describeTransportFailure(error: unknown): PreloadOutcome {
  return {
    kind: 'faulted',
    message:
      error instanceof Error
        ? `The preload request did not complete: ${error.message}`
        : 'The preload request did not complete.',
  };
}

/** A `Conflict`: the load or its validation was refused, always with a bounded reason. */
function describeConflict(data: PreloadFaultData): PreloadOutcome {
  const reason = data.reason ?? 'unknown';
  return {
    kind: 'rejected',
    reason,
    message: preloadConflictReasonLabel(reason),
    rejectionReasons: data.sourceValidationReasons ?? [],
  };
}

/** Every fault code other than `NotFound`/`Conflict`, which have their own shapes. */
function describeOtherFault(
  error: HttpClientError,
  name: string,
  revision: string,
): PreloadOutcome {
  switch (error.faultCode) {
    case 'InvalidParams':
      return { kind: 'invalid', message: `Weft rejected the request: ${error.message}` };
    case 'Unauthorized':
    case 'Forbidden':
      return {
        kind: 'denied',
        message: 'This principal is not allowed to preload workflow revisions (workflows:admin).',
      };
    default:
      return {
        kind: 'faulted',
        message: `Weft could not preload "${name}" at revision "${revision}": ${error.message}`,
      };
  }
}

/**
 * Turns one {@link PreloadAttempt} into a {@link PreloadOutcome}. `name` and
 * `revision` are the key the attempt was made against — folded into the
 * copy so an operator reading the outcome never has to correlate it back to
 * the form themselves.
 */
export function describePreloadOutcome(
  attempt: PreloadAttempt,
  name: string,
  revision: string,
): PreloadOutcome {
  if (attempt.installed) return { kind: 'installed', revision: attempt.revision };

  const error = attempt.error;
  if (!(error instanceof HttpClientError)) return describeTransportFailure(error);

  const data = readPreloadFaultData(error);
  if (error.faultCode === 'NotFound') return describeNotFound(data, name, revision);
  if (error.faultCode === 'Conflict') return describeConflict(data);
  return describeOtherFault(error, name, revision);
}
