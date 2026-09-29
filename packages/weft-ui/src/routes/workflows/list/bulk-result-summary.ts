/**
 * Converts each bulk operation's own raw commit result
 * (`BulkCancelResult`/`BulkRetryFailedResult`/`BulkSignalResult`/
 * `BulkDeleteResult`/`BulkTagResult`/`PurgeResult`, all `@lostgradient/weft`)
 * into the one generic `BulkCommitSummary` shape `bulk-action-dialog.svelte`
 * and `bulk-purge-dialog.svelte` render — plan §9.2/§13 T8.1.
 *
 * The six result shapes are NOT uniform (only cancel/retry-failed report
 * per-workflow `errors`; signal reports an aggregate `failed` count with no
 * per-id detail; delete/tags/purge report neither) — kept honest here rather
 * than papering over the gap with a fabricated empty error list that implies
 * more precision than the wire actually carries.
 */
import type {
  BulkCancelResult,
  BulkDeleteResult,
  BulkOperationError,
  BulkRetryFailedResult,
  BulkSignalResult,
  BulkTagResult,
  PurgeResult,
} from '@lostgradient/weft';

export interface BulkCommitSummary {
  readonly headline: string;
  readonly errors: readonly BulkOperationError[];
  /** Extra disclosure line — e.g. delete's finalizer-pending skip count. */
  readonly note?: string;
}

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function cancelResultSummary(result: BulkCancelResult, matched: number): BulkCommitSummary {
  return {
    headline: `Cancelled ${result.cancelled} of ${countLabel(matched, 'workflow')}`,
    errors: result.errors,
  };
}

export function retryFailedResultSummary(
  result: BulkRetryFailedResult,
  matched: number,
): BulkCommitSummary {
  return {
    headline: `Retried ${result.retried} of ${countLabel(matched, 'workflow')}`,
    errors: result.errors,
  };
}

export function signalResultSummary(result: BulkSignalResult, matched: number): BulkCommitSummary {
  return {
    headline: `Signalled ${result.signalled} of ${countLabel(matched, 'workflow')}`,
    errors: [],
    ...(result.failed > 0
      ? { note: `${countLabel(result.failed, 'workflow')} did not receive the signal.` }
      : {}),
  };
}

export function deleteResultSummary(result: BulkDeleteResult, matched: number): BulkCommitSummary {
  const skipped = result.skippedTeardownPending?.length ?? 0;
  return {
    headline: `Deleted ${result.deleted} of ${countLabel(matched, 'workflow')}`,
    errors: [],
    ...(skipped > 0
      ? {
          note: `${countLabel(skipped, 'workflow')} skipped — still owe a finalizer run. Delete again once it settles.`,
        }
      : {}),
  };
}

export function tagResultSummary(
  result: BulkTagResult,
  operation: 'add' | 'remove',
  matched: number,
): BulkCommitSummary {
  const verb = operation === 'add' ? 'Added tags to' : 'Removed tags from';
  return {
    headline: `${verb} ${result.modified} of ${countLabel(matched, 'workflow')}`,
    errors: [],
  };
}

export function purgeResultSummary(result: PurgeResult): BulkCommitSummary {
  return {
    headline: `Purged ${countLabel(result.deleted, 'workflow')}`,
    errors: [],
  };
}
