/**
 * Compatibility-verdict presentation (WFT-115): turns the wire outcome of
 * `weft.workflows.revisions.activate` into text an operator can act on.
 *
 * There is no separate read-only "preview" operation for workflow
 * compatibility (`packages/weft/documentation/guides/workflow-versioning.md`,
 * verified) — the only server-supplied verdict is the outcome of a real
 * `weft.workflows.revisions.activate` call: success (`{ applied: true,
 * pointer }`), or a `Conflict` fault whose `data.compatibilityReasons`/
 * `data.currentGeneration` (`workflow-catalog-operation-helpers.ts`'s
 * `activationRefusalToFault`) carries the full bounded reason list or the
 * stale-generation signal. This module never calls
 * `checkWorkflowCompatibility` itself — see that function's own module doc
 * (`@lostgradient/weft`'s `core/contract/compatibility.ts`) for the five
 * reasons it can report; `KNOWN_COMPATIBILITY_REASONS` below is a hand-
 * declared mirror of that closed union (a VALUE import from the package
 * root would pull server-only code into the browser bundle — see
 * `../../lib/faults.ts`'s module doc for the same constraint).
 *
 * `client.operations[...]` for the workflow-catalog operation family
 * dispatches over JSON-RPC only (verified against
 * `@lostgradient/weft`'s `CLIENT_REST_OPERATION_BINDINGS`, which lists a
 * single unrelated operation) — `HttpClientError.data` is therefore the
 * JSON-RPC envelope's `error.data` verbatim
 * (`httpClientCatalogTransport`), carrying `compatibilityReasons` and/or
 * `currentGeneration` whenever the refusal reason produced them
 * (`fault-to-json-rpc.ts`'s `dataForConflict`).
 */
import { HttpClientError } from '@lostgradient/weft';

/** Mirrors `WorkflowCompatibilityReason` (`@lostgradient/weft`) — the five closed-union literals, in the same fixed evaluation order. */
export const KNOWN_COMPATIBILITY_REASONS = [
  'name-mismatch',
  'manifest-version-unsupported',
  'contract-hash-mismatch',
  'workflow-version-incompatible',
  'artifact-revision-mismatch',
] as const;

type KnownCompatibilityReason = (typeof KNOWN_COMPATIBILITY_REASONS)[number];

/** Sentence-case operator copy for each known reason (plan §10.10 copy voice). */
const COMPATIBILITY_REASON_LABELS: Readonly<Record<KnownCompatibilityReason, string>> = {
  'name-mismatch': 'Candidate revision is for a different workflow name.',
  'manifest-version-unsupported':
    'Candidate manifest uses a schema version this engine does not support.',
  'contract-hash-mismatch': 'Candidate payload contract differs from the active revision.',
  'workflow-version-incompatible': 'Candidate workflow version differs from the active revision.',
  'artifact-revision-mismatch': 'Candidate revision identity differs from the active revision.',
};

function isKnownCompatibilityReason(value: string): value is KnownCompatibilityReason {
  return (KNOWN_COMPATIBILITY_REASONS as readonly string[]).includes(value);
}

/**
 * Human-readable label for one compatibility reason. An unrecognized string
 * (a future reason this build predates, or malformed wire data) renders
 * honestly as `"unknown reason: <value>"` rather than a fabricated label —
 * this module never guesses what an unknown reason means.
 */
export function compatibilityReasonLabel(reason: string): string {
  return isKnownCompatibilityReason(reason)
    ? COMPATIBILITY_REASON_LABELS[reason]
    : `unknown reason: ${reason}`;
}

/** The subset of a `Conflict` fault's `data` this module reads — additive, narrower than the full wire payload. */
export interface ActivationConflictData {
  readonly compatibilityReasons?: readonly string[];
  readonly currentGeneration?: number;
}

/**
 * Narrows an `HttpClientError`'s `.data` into {@link ActivationConflictData}.
 * Returns `undefined` for anything else this module can't use as an
 * activation refusal — a non-`HttpClientError`, a response with no `data`,
 * or `data` carrying neither field this refusal family ever sets (an empty
 * `compatibilityReasons` array counts as absent: `activationRefusalToFault`
 * never constructs one with zero reasons, so an empty array on the wire is
 * itself malformed data, not a real empty verdict).
 */
export function readActivationConflictData(error: unknown): ActivationConflictData | undefined {
  if (!(error instanceof HttpClientError)) return undefined;
  const data = error.data;
  if (typeof data !== 'object' || data === null) return undefined;
  const record = data as Record<string, unknown>;

  const result: { compatibilityReasons?: readonly string[]; currentGeneration?: number } = {};

  if (Array.isArray(record['compatibilityReasons'])) {
    const reasons = record['compatibilityReasons'].filter(
      (entry): entry is string => typeof entry === 'string',
    );
    if (reasons.length > 0) result.compatibilityReasons = reasons;
  }
  if (typeof record['currentGeneration'] === 'number') {
    result.currentGeneration = record['currentGeneration'];
  }

  return result.compatibilityReasons === undefined && result.currentGeneration === undefined
    ? undefined
    : result;
}

/** The `{ revision, generation, activatedAt }` pointer an applied activation returns — mirrors `WorkflowCatalogActivePointer` (`@lostgradient/weft`) structurally. */
export interface AppliedActivationPointer {
  readonly revision: string;
  readonly generation: number;
  readonly activatedAt: number;
}

/** One attempt at `weft.workflows.revisions.activate`: either it applied, or it was refused and threw. */
export type ActivationAttempt =
  | { readonly applied: true; readonly pointer: AppliedActivationPointer }
  | { readonly applied: false; readonly error: unknown };

/** A render-ready activation outcome — what `<WorkflowRevisionsPanel>` renders directly, never the raw wire result. */
export type WorkflowActivationOutcome =
  | { readonly kind: 'applied'; readonly pointer: AppliedActivationPointer }
  | { readonly kind: 'incompatible'; readonly reasons: readonly string[] }
  | { readonly kind: 'stale'; readonly currentGeneration: number };

/**
 * The `expectedGeneration` the next `weft.workflows.revisions.activate`
 * attempt should send: the NEWER of two known generations, never simply
 * "prefer the pending one."
 *
 * `pending` is the `currentGeneration` a `stale` refusal most recently
 * reported; `active` is `weft.workflows.active.get`'s own cached
 * generation. Catalog generations increase monotonically, so whichever of
 * the two is higher is the more current durable truth. Naively preferring
 * `pending` unconditionally is wrong: `weft.workflows.active.get`'s
 * documented contract is in-memory-only, so a `Refresh` after a stale
 * refusal CAN legitimately return a newer generation than the one that
 * refusal reported (another process activated in between) — always
 * resubmitting the older `pending` value would then guarantee the next
 * attempt is refused as stale too, even though a correct generation was
 * sitting right there in `active`. Returns `undefined` only when neither
 * source has a generation yet (this workflow has never been activated).
 */
export function resolveExpectedGeneration(
  pending: number | null,
  active: number | undefined,
): number | undefined {
  if (pending === null) return active;
  if (active === undefined) return pending;
  return Math.max(pending, active);
}

/**
 * Turns one {@link ActivationAttempt} into a {@link WorkflowActivationOutcome}.
 * A refusal this module recognizes (bounded compatibility reasons, or a
 * stale/expected-generation signal) is a legitimate, expected result — not
 * an error — and renders as text. Any other error (`NotFound`, a network
 * failure, a malformed response) is rethrown unchanged so the caller's
 * normal fault handling (the shared mutation `onError` toast) reports it,
 * rather than this module silently swallowing an unrecognized failure.
 */
export function describeActivationOutcome(attempt: ActivationAttempt): WorkflowActivationOutcome {
  if (attempt.applied) return { kind: 'applied', pointer: attempt.pointer };

  const conflictData = readActivationConflictData(attempt.error);
  if (conflictData?.compatibilityReasons !== undefined) {
    return { kind: 'incompatible', reasons: conflictData.compatibilityReasons };
  }
  if (conflictData?.currentGeneration !== undefined) {
    return { kind: 'stale', currentGeneration: conflictData.currentGeneration };
  }
  throw attempt.error;
}
