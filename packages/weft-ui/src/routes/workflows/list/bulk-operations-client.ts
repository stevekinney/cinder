/**
 * Typed wrappers over `client.operations['weft.workflows.bulk.*']` /
 * `'weft.workflows.purge'` (plan §9.2/§13 T8.1). Ergonomic `WeftClient`
 * methods don't cover bulk operations (verified against
 * `weft/src/client/interface.ts`), so every call goes through
 * `client.operations[...]` per plan §4.
 *
 * ## Why results are runtime-validated, not just typed
 *
 * Every bulk operation declares `outputSchema: z.unknown()` server-side
 * (`weft/src/server/operations/bulk-*.ts` — the wire contract is
 * deliberately loose there), and the GENERATED client catalog
 * (`weft/src/cli/generated/operation-client.generated.ts`, the actual source
 * of `HttpClient.operations[name]`'s return type) reads that zod schema, not
 * the operation's TS `Output` generic — so every one of these calls is really
 * typed `Promise<unknown>`. The real shapes (`BulkCancelResult`,
 * `BulkOperationDryRunResult`, etc. — all exported from `@lostgradient/weft`)
 * are validated structurally at the boundary here, mirroring
 * `../detail/checkpoints/checkpoints-data.ts`'s identical pattern for the
 * same reason.
 *
 * Every INPUT type below is derived from `HttpClient['operations']` itself
 * via `Parameters<...>[0]` rather than hand-copied, so a future
 * `@lostgradient/weft` bump that reshapes an operation's input is a
 * type-check failure here, not a silent drift.
 *
 * `import type` only for every `@lostgradient/weft` (root) symbol — never a
 * value import from the root barrel, which also re-exports server-only code
 * reaching `node:crypto` (see `../../../lib/faults.ts`'s module doc for the
 * same discipline). `BulkOperationConfirmationError` (the stale-token signal)
 * is deliberately NOT imported here for that reason — callers distinguish a
 * stale-token commit fault via `../../../lib/faults.ts`'s
 * `classifyFault(...).kind === 'invalid'` instead, which needs no server-side
 * class import at all.
 */
import type {
  BulkCancelResult,
  BulkDeleteResult,
  BulkOperationDryRunResult,
  BulkRetryFailedResult,
  BulkSignalResult,
  BulkTagResult,
  HttpClient,
  PurgeResult,
} from '@lostgradient/weft';

import type { BulkListFilterInput } from './bulk-list-filter.ts';

type Operations = Pick<HttpClient, 'operations'>;

type BulkCancelInput = Parameters<HttpClient['operations']['weft.workflows.bulk.cancel']>[0];
type BulkRetryFailedInput = Parameters<
  HttpClient['operations']['weft.workflows.bulk.retryfailed']
>[0];
type BulkDeleteInput = Parameters<HttpClient['operations']['weft.workflows.bulk.delete']>[0];
type BulkSignalInput = Parameters<HttpClient['operations']['weft.workflows.bulk.signal']>[0];
type BulkTagsInput = Parameters<HttpClient['operations']['weft.workflows.bulk.tags']>[0];
type PurgeInput = Parameters<HttpClient['operations']['weft.workflows.purge']>[0];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBulkOperationErrorList(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        isRecord(entry) && typeof entry['id'] === 'string' && typeof entry['error'] === 'string',
    )
  );
}

function parseBulkOperationErrors(value: unknown): { id: string; error: string }[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const errors: { id: string; error: string }[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry['id'] !== 'string' || typeof entry['error'] !== 'string') {
      return undefined;
    }
    errors.push({ id: entry['id'], error: entry['error'] });
  }
  return errors;
}

/** `true` for the shared dry-run preview shape every scoped bulk operation returns (plan §9.2, `BulkOperationDryRunResult`). */
export function isBulkDryRunResult(value: unknown): value is BulkOperationDryRunResult {
  return (
    isRecord(value) &&
    value['dryRun'] === true &&
    typeof value['matched'] === 'number' &&
    typeof value['confirmationToken'] === 'string' &&
    isRecord(value['scope'])
  );
}

function parseDryRunResult(value: unknown): BulkOperationDryRunResult {
  if (!isBulkDryRunResult(value)) {
    throw new TypeError('Bulk dry-run returned an unexpected shape');
  }
  return value;
}

function parseBulkCancelResult(value: unknown): BulkCancelResult {
  if (
    isRecord(value) &&
    typeof value['cancelled'] === 'number' &&
    typeof value['failed'] === 'number' &&
    isBulkOperationErrorList(value['errors'])
  ) {
    const errors = parseBulkOperationErrors(value['errors']);
    if (errors) return { cancelled: value['cancelled'], failed: value['failed'], errors };
  }
  throw new TypeError('weft.workflows.bulk.cancel returned an unexpected shape');
}

function parseBulkRetryFailedResult(value: unknown): BulkRetryFailedResult {
  if (
    isRecord(value) &&
    typeof value['retried'] === 'number' &&
    typeof value['failed'] === 'number' &&
    isBulkOperationErrorList(value['errors'])
  ) {
    const errors = parseBulkOperationErrors(value['errors']);
    if (errors) return { retried: value['retried'], failed: value['failed'], errors };
  }
  throw new TypeError('weft.workflows.bulk.retryfailed returned an unexpected shape');
}

function parseBulkDeleteResult(value: unknown): BulkDeleteResult {
  if (isRecord(value) && typeof value['deleted'] === 'number') {
    const skipped = value['skippedTeardownPending'];
    return {
      deleted: value['deleted'],
      ...(Array.isArray(skipped) && skipped.every((entry) => typeof entry === 'string')
        ? { skippedTeardownPending: skipped }
        : {}),
    };
  }
  throw new TypeError('weft.workflows.bulk.delete returned an unexpected shape');
}

function parseBulkSignalResult(value: unknown): BulkSignalResult {
  if (
    isRecord(value) &&
    typeof value['signalled'] === 'number' &&
    typeof value['failed'] === 'number'
  ) {
    return { signalled: value['signalled'], failed: value['failed'] };
  }
  throw new TypeError('weft.workflows.bulk.signal returned an unexpected shape');
}

function parseBulkTagResult(value: unknown): BulkTagResult {
  if (isRecord(value) && typeof value['modified'] === 'number') {
    return { modified: value['modified'] };
  }
  throw new TypeError('weft.workflows.bulk.tags returned an unexpected shape');
}

function parsePurgeResult(value: unknown): PurgeResult {
  if (isRecord(value) && typeof value['deleted'] === 'number') {
    return { deleted: value['deleted'] };
  }
  throw new TypeError('weft.workflows.purge returned an unexpected shape');
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------

export async function dryRunBulkCancel(
  client: Operations,
  filter: BulkListFilterInput,
): Promise<BulkOperationDryRunResult> {
  const input: BulkCancelInput = { ...filter, dryRun: true };
  return parseDryRunResult(await client.operations['weft.workflows.bulk.cancel'](input));
}

export async function commitBulkCancel(
  client: Operations,
  filter: BulkListFilterInput,
  confirmationToken: string,
): Promise<BulkCancelResult> {
  const input: BulkCancelInput = { ...filter, confirmationToken };
  return parseBulkCancelResult(await client.operations['weft.workflows.bulk.cancel'](input));
}

// ---------------------------------------------------------------------------
// Retry failed
// ---------------------------------------------------------------------------

export async function dryRunBulkRetryFailed(
  client: Operations,
  filter: BulkListFilterInput,
): Promise<BulkOperationDryRunResult> {
  const input: BulkRetryFailedInput = { ...filter, dryRun: true };
  return parseDryRunResult(await client.operations['weft.workflows.bulk.retryfailed'](input));
}

export async function commitBulkRetryFailed(
  client: Operations,
  filter: BulkListFilterInput,
  confirmationToken: string,
): Promise<BulkRetryFailedResult> {
  const input: BulkRetryFailedInput = { ...filter, confirmationToken };
  return parseBulkRetryFailedResult(
    await client.operations['weft.workflows.bulk.retryfailed'](input),
  );
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function dryRunBulkDelete(
  client: Operations,
  filter: BulkListFilterInput,
): Promise<BulkOperationDryRunResult> {
  const input: BulkDeleteInput = { ...filter, dryRun: true };
  return parseDryRunResult(await client.operations['weft.workflows.bulk.delete'](input));
}

export async function commitBulkDelete(
  client: Operations,
  filter: BulkListFilterInput,
  confirmationToken: string,
): Promise<BulkDeleteResult> {
  const input: BulkDeleteInput = { ...filter, confirmationToken };
  return parseBulkDeleteResult(await client.operations['weft.workflows.bulk.delete'](input));
}

// ---------------------------------------------------------------------------
// Signal
// ---------------------------------------------------------------------------

export async function dryRunBulkSignal(
  client: Operations,
  filter: BulkListFilterInput,
  name: string,
  payload: unknown,
): Promise<BulkOperationDryRunResult> {
  const input: BulkSignalInput = { ...filter, name, payload, dryRun: true };
  return parseDryRunResult(await client.operations['weft.workflows.bulk.signal'](input));
}

export async function commitBulkSignal(
  client: Operations,
  filter: BulkListFilterInput,
  name: string,
  payload: unknown,
  confirmationToken: string,
): Promise<BulkSignalResult> {
  const input: BulkSignalInput = { ...filter, name, payload, confirmationToken };
  return parseBulkSignalResult(await client.operations['weft.workflows.bulk.signal'](input));
}

// ---------------------------------------------------------------------------
// Tags (add/remove — one PATCH endpoint, `operation` discriminates)
// ---------------------------------------------------------------------------

export async function dryRunBulkTags(
  client: Operations,
  filter: BulkListFilterInput,
  operation: 'add' | 'remove',
  tags: readonly string[],
): Promise<BulkOperationDryRunResult> {
  const input: BulkTagsInput = { filter, operation, tags: [...tags], dryRun: true };
  return parseDryRunResult(await client.operations['weft.workflows.bulk.tags'](input));
}

export async function commitBulkTags(
  client: Operations,
  filter: BulkListFilterInput,
  operation: 'add' | 'remove',
  tags: readonly string[],
  confirmationToken: string,
): Promise<BulkTagResult> {
  const input: BulkTagsInput = { filter, operation, tags: [...tags], confirmationToken };
  return parseBulkTagResult(await client.operations['weft.workflows.bulk.tags'](input));
}

// ---------------------------------------------------------------------------
// Purge — no dry-run/confirmation-token protocol (module doc, plan §0
// Ground Truth vs actual `purge-workflows.ts` source; see
// `bulk-purge-dialog.svelte`).
// ---------------------------------------------------------------------------

export async function purgeWorkflows(
  client: Operations,
  filter: BulkListFilterInput,
): Promise<PurgeResult> {
  const input: PurgeInput = { ...filter };
  return parsePurgeResult(await client.operations['weft.workflows.purge'](input));
}
