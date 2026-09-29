/**
 * Shared workflow-revision vocabulary (WFT-117): the `WorkflowCatalogActivePointer`-like
 * type/guard, the active-pointer fetch, and the classifier that compares a
 * persisted run's `revision` against the catalog's currently active one.
 * Consumed by both `routes/workflows/*` (this batch) and `routes/system/
 * workflow-revisions-view.ts` (WFT-115, which re-imports the type/guard from
 * here rather than defining its own — see that module).
 *
 * Lives in `src/lib` rather than either route so neither `routes/workflows`
 * nor `routes/system` cross-imports the other's route-chunked bundle — this
 * repo's routes otherwise never import from a sibling route's `.ts` files
 * (verified by grep across the existing tree).
 *
 * ## Why `fetchActiveWorkflowRevision` throws on a malformed body instead of
 * returning `null`
 *
 * `weft.workflows.active.get` faults `NotFound` for a workflow that has
 * never been activated — a legitimate `null` result, not an error (see the
 * call site's catch below, mirroring `workflow-revisions-panel.svelte`'s
 * identical handling). A SUCCESSFUL response that fails
 * {@link isWorkflowCatalogActivePointerLike} is a different situation
 * entirely and must not collapse to the same `null`: a caller reading `null`
 * cannot tell "never activated" from "the server sent something this
 * console can't parse," and `workflowRevisionRows`'s own doc explains why
 * conflating the two is unsafe specifically for this operation. Throwing a
 * `HttpClientError` (rather than a plain `Error`) matters too — `classifyFault`
 * (`./faults.ts`) only recognizes `HttpClientError`, and `shouldRetryQuery`
 * (`./query.ts`) treats anything ELSE as network-transient and retries it
 * three times with backoff before a caller ever sees "unknown." `Unprocessable`
 * maps to the non-retrying `invalid` treatment, so callers render the
 * "unknown" state immediately instead of stalling on pointless retries of a
 * response that will never change shape on refetch.
 */
import { HttpClientError } from '@lostgradient/weft';

/** Mirrors `WorkflowCatalogActivePointer` (`@lostgradient/weft`) structurally. */
export interface WorkflowCatalogActivePointerLike {
  readonly revision: string;
  readonly generation: number;
  readonly activatedAt: number;
}

/** Runtime type guard for `weft.workflows.active.get`'s output. */
export function isWorkflowCatalogActivePointerLike(
  value: unknown,
): value is WorkflowCatalogActivePointerLike {
  if (typeof value !== 'object' || value === null) return false;
  const record: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) record[key] = entry;
  return (
    typeof record['revision'] === 'string' &&
    typeof record['generation'] === 'number' &&
    typeof record['activatedAt'] === 'number'
  );
}

/**
 * Narrow surface `fetchActiveWorkflowRevision` needs off `client.operations`
 * — `weft.workflows.active.get` has no ergonomic `WeftClient` method.
 * Matches the REAL generated client type (`output: unknown`; the operation
 * declares `outputSchema: z.unknown()` server-side, same reason
 * `checkpoints-data.ts`'s and `workflow-observability.ts`'s narrow
 * interfaces exist) rather than `Pick<HttpClient['operations'], …>`, which
 * would force every test double to also satisfy the generated catalog's
 * full (unrelated) input/output union.
 */
export interface WorkflowActiveRevisionClient {
  readonly operations: {
    readonly 'weft.workflows.active.get': (input: { name: string }) => Promise<unknown>;
  };
}

/**
 * Fetches the catalog's active-revision pointer for one workflow name, or
 * `null` when that name has never been activated. Throws for any other
 * fault, and for a successful-but-malformed response (module doc).
 */
export async function fetchActiveWorkflowRevision(
  client: WorkflowActiveRevisionClient,
  name: string,
): Promise<WorkflowCatalogActivePointerLike | null> {
  try {
    const raw = await client.operations['weft.workflows.active.get']({ name });
    if (isWorkflowCatalogActivePointerLike(raw)) return raw;
    throw new HttpClientError(422, 'Malformed active-pointer response', {
      faultCode: 'Unprocessable',
    });
  } catch (error) {
    if (error instanceof HttpClientError && error.faultCode === 'NotFound') return null;
    throw error;
  }
}

/**
 * How a run's persisted `revision` compares to the catalog's currently
 * active pointer for that workflow's type:
 *
 * - `'unpinned'` — the run predates revision pinning (no `WorkflowState.
 *   revision` was ever persisted for it). Takes priority over the active
 *   comparison: there is nothing to compare.
 * - `'unknown'` — the active pointer could not be resolved (denied,
 *   never-activated, still loading, or a malformed response) — not the same
 *   as "differs," which would assert a comparison this caller cannot
 *   actually make.
 * - `'active'` — the run's revision equals the catalog's active revision.
 * - `'stale'` — the run's revision is a real string that differs from the
 *   catalog's active revision (a redeploy landed after this run started, or
 *   this run is a diagnostic fork pinned to a non-default revision).
 */
export type RevisionActiveComparison = 'active' | 'stale' | 'unpinned' | 'unknown';

export function classifyRevisionAgainstActive(
  revision: string | undefined,
  active: WorkflowCatalogActivePointerLike | null | undefined,
): RevisionActiveComparison {
  if (revision === undefined) return 'unpinned';
  if (active === null || active === undefined) return 'unknown';
  return revision === active.revision ? 'active' : 'stale';
}

/**
 * Single-source-of-truth WFT-159 eager-registration hedge, reused verbatim
 * everywhere this console shows a revision as something a run "will retain"
 * or "will select" (fork default, recovery, `onTerminalConflict: 'start-new'`)
 * so the caveat wording cannot drift between call sites. See
 * `WorkflowReplay.revision`'s own doc (`@lostgradient/weft`) for the
 * authoritative description of the underlying behavior this hedges: a
 * default fork or recovery of an EAGER-registered type always runs whatever
 * this process currently has loaded, even when that differs from the
 * revision being displayed.
 */
export const EAGER_REVISION_HEDGE: string =
  "For an eager-registered workflow type, recovery and a default fork always run this process's currently loaded code, even if it differs from the revision shown here.";

/**
 * Single-source-of-truth hedge for every "fresh start" surface — the
 * start wizard's review step, a checkpoint-less retry, and an
 * `onTerminalConflict: 'start-new'` replacement — reused verbatim so the
 * caveat wording cannot drift between call sites (Codex review, PR #978).
 * Unlike {@link EAGER_REVISION_HEDGE} (which hedges "will retain the
 * SOURCE run's own revision"), this hedges the *different* claim that a
 * fresh start resolves "whichever revision is currently active": for an
 * eager-registered type, or when only one revision is a viable
 * dynamic-source candidate, a fresh start can run without consulting the
 * active pointer at all, so it can differ from whatever was shown as
 * "active" at the moment the operator confirmed.
 */
export const FRESH_START_REVISION_HEDGE: string =
  'For an eager-registered workflow type, or when only one revision is a viable dynamic-source candidate, a fresh start can run without consulting the active pointer at all, so it may not match the revision shown here.';
