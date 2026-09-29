/**
 * Pure view-model mapping for the Registry detail view's Revisions panel
 * (WFT-115): turns `weft.workflows.revisions.list`'s output (an array of
 * `WorkflowRevisionRecord`, `@lostgradient/weft`) plus
 * `weft.workflows.active.get`'s output (a `WorkflowCatalogActivePointer`,
 * or `null` for a workflow that has never been activated) into sorted,
 * render-ready rows — mirrors `registry-view.ts`'s framework-free,
 * unit-testable-without-a-DOM convention.
 *
 * Both wire operations type their output `unknown` (the generated client's
 * `weft.workflows.revisions.list`/`weft.workflows.active.get` entries —
 * their zod schemas use `z.unknown()`, same as the registry snapshot), so
 * every record is runtime-guarded rather than cast. `workflowRevisionRows`
 * treats even one malformed entry as a malformed RESPONSE (returns
 * `undefined`) rather than silently dropping just that entry — see that
 * function's own doc for why a partial, silently-filtered list is unsafe
 * here specifically.
 *
 * `WorkflowCatalogActivePointerLike`/`isWorkflowCatalogActivePointerLike`
 * moved to `../../lib/workflow-revision.ts` (WFT-117) once `routes/workflows/*`
 * needed the same active-pointer shape/guard — re-exported here unchanged so
 * this module's own consumers (`workflow-revisions-panel.svelte`) don't need
 * to touch their import path.
 */
import { formatRelativeTime, truncateId } from '../../lib/format/index.ts';
import {
  isWorkflowCatalogActivePointerLike,
  type WorkflowCatalogActivePointerLike,
} from '../../lib/workflow-revision.ts';

export { isWorkflowCatalogActivePointerLike, type WorkflowCatalogActivePointerLike };

/** Mirrors `WorkflowRevisionManifest` (`@lostgradient/weft`) structurally — only the identity fields this panel renders. */
interface WorkflowRevisionManifestLike {
  readonly manifestVersion: number;
  readonly name: string;
  readonly workflowVersion: string;
  readonly revision: string;
  readonly contractHash: string;
  readonly contract: unknown;
}

/** Mirrors `WorkflowRevisionRecord` (`@lostgradient/weft`) structurally. */
export interface WorkflowRevisionRecordSource {
  readonly manifest: WorkflowRevisionManifestLike;
  readonly installedAt: number;
}

function isWorkflowRevisionManifestLike(value: unknown): value is WorkflowRevisionManifestLike {
  if (typeof value !== 'object' || value === null) return false;
  const record: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) record[key] = entry;
  return (
    typeof record['manifestVersion'] === 'number' &&
    typeof record['name'] === 'string' &&
    typeof record['workflowVersion'] === 'string' &&
    typeof record['revision'] === 'string' &&
    typeof record['contractHash'] === 'string' &&
    typeof record['contract'] === 'object' &&
    record['contract'] !== null
  );
}

/** Runtime type guard for one `weft.workflows.revisions.list` array entry. */
export function isWorkflowRevisionRecordLike(
  value: unknown,
): value is WorkflowRevisionRecordSource {
  if (typeof value !== 'object' || value === null) return false;
  const record: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) record[key] = entry;
  return (
    isWorkflowRevisionManifestLike(record['manifest']) && typeof record['installedAt'] === 'number'
  );
}

/** One render-ready row for the Revisions panel — an installed revision, flagged active or not against the resolved active pointer. */
export interface WorkflowRevisionRow {
  readonly revision: string;
  readonly workflowVersion: string;
  readonly contractHash: string;
  readonly manifestVersion: number;
  readonly installedAt: number;
  readonly isActive: boolean;
}

function compareCodepoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Sorted (codepoint order, by revision), render-ready rows for `records` —
 * or `undefined` when even ONE entry fails {@link isWorkflowRevisionRecordLike}.
 *
 * An earlier version of this function silently filtered out malformed
 * entries and rendered the rest as a (misleadingly complete-looking)
 * revisions list. That is unsafe specifically when the malformed record IS
 * the one the active pointer names: the surviving rows would all render as
 * "Installed" with no "Active" badge, AND the panel's "no active
 * revision — never activated" note would stay suppressed (the pointer
 * itself is still non-null) — silently telling an operator the workflow
 * has installed-but-unactivated revisions when it actually has an active
 * one this console just couldn't parse. Treating ANY malformed entry as a
 * malformed RESPONSE (same "reject, don't guess" contract
 * `weft.workflows.active.get`'s own malformed-pointer handling in
 * `workflow-revisions-panel.svelte` already uses) removes that failure
 * mode entirely — the panel renders its explicit malformed-response state
 * instead of a partial, mislabeled list.
 */
export function workflowRevisionRows(
  records: readonly unknown[],
  active: WorkflowCatalogActivePointerLike | null,
): readonly WorkflowRevisionRow[] | undefined {
  const validated: WorkflowRevisionRecordSource[] = [];
  for (const record of records) {
    if (!isWorkflowRevisionRecordLike(record)) return undefined;
    validated.push(record);
  }
  return validated
    .map((record): WorkflowRevisionRow => ({
      revision: record.manifest.revision,
      workflowVersion: record.manifest.workflowVersion,
      contractHash: record.manifest.contractHash,
      manifestVersion: record.manifest.manifestVersion,
      installedAt: record.installedAt,
      isActive: active !== null && active.revision === record.manifest.revision,
    }))
    .toSorted((a, b) => compareCodepoint(a.revision, b.revision));
}

/** The subset of a TanStack `createQuery` result `isBackgroundRefreshing` reads — structurally compatible with `revisionsQuery`/`activeQuery` in `workflow-revisions-panel.svelte` without importing `@tanstack/svelte-query`'s types into this framework-free module. */
export interface FetchStateLike {
  readonly isFetching: boolean;
  readonly data: unknown;
}

/**
 * Whether the panel's "Refreshing…" background-fetch indicator should show:
 * either query is actively fetching AND already resolved once before (`data
 * !== undefined` — `activeQuery`'s own resolved value CAN legitimately be
 * `null` for "never activated", which must still count as "already
 * resolved", not "still loading"). Extracted as a pure function rather than
 * asserted via a real component's fetch-timing in a test, which — given
 * `ScriptedFetch`'s responses resolve as fast as the microtask queue allows
 * — has no reliable window in which "fetching" is observably true.
 */
export function isBackgroundRefreshing(
  revisionsQuery: FetchStateLike,
  activeQuery: FetchStateLike,
): boolean {
  return (
    (revisionsQuery.isFetching && revisionsQuery.data !== undefined) ||
    (activeQuery.isFetching && activeQuery.data !== undefined)
  );
}

/** One `<dt>`/`<dd>` pair for a revision row's `DescriptionList`-style meta grid in `<WorkflowRevisionsPanel>` — a single templated `{#each}` in that markup instead of four hand-repeated blocks. */
export interface RowMetaItem {
  readonly term: string;
  readonly value: string;
  readonly title: string | undefined;
  readonly mono: boolean;
}

/** Render-ready meta items for one {@link WorkflowRevisionRow}, in display order. Pure (no Svelte dependency) so it lives alongside the rest of this file's framework-free view-model mapping rather than in the component itself. */
export function rowMeta(row: WorkflowRevisionRow): readonly RowMetaItem[] {
  return [
    { term: 'Workflow version', value: row.workflowVersion, title: undefined, mono: false },
    {
      term: 'Contract hash',
      value: truncateId(row.contractHash),
      title: row.contractHash,
      mono: true,
    },
    {
      term: 'Manifest version',
      value: String(row.manifestVersion),
      title: undefined,
      mono: false,
    },
    {
      term: 'Installed at',
      value: formatRelativeTime(row.installedAt),
      title: undefined,
      mono: false,
    },
  ];
}
