import { describe, expect, test } from 'bun:test';

import { throwingRejectionOf } from '@lostgradient/testing';
import {
  commitBulkCancel,
  commitBulkDelete,
  commitBulkRetryFailed,
  commitBulkSignal,
  commitBulkTags,
  dryRunBulkCancel,
  dryRunBulkDelete,
  dryRunBulkRetryFailed,
  dryRunBulkSignal,
  dryRunBulkTags,
  purgeWorkflows,
} from './bulk-operations-client.ts';
import { realClient, ScriptedFetch, type FetchCall } from './workflow-test-support.test-support.ts';

function requestParams(call: FetchCall | undefined): Record<string, unknown> {
  const body = call?.init?.body;
  if (typeof body !== 'string') throw new Error('JSON-RPC request body missing');
  const parsed: unknown = JSON.parse(body);
  if (parsed === null || typeof parsed !== 'object') throw new Error('JSON-RPC body malformed');
  const params = Reflect.get(parsed, 'params');
  if (params === null || typeof params !== 'object') throw new Error('JSON-RPC params missing');
  return params;
}

const DRY_RUN_PREVIEW = {
  dryRun: true,
  action: 'cancel',
  matched: 3,
  requestId: 'bulk:req-1',
  scope: {
    matched: 3,
    filter: { status: 'failed' },
    statuses: ['failed'],
    workflowTypes: ['checkout'],
    sampleWorkflowIds: ['wf-1', 'wf-2', 'wf-3'],
    sampleLimit: 20,
  },
  sampleWorkflowIds: ['wf-1', 'wf-2', 'wf-3'],
  confirmationToken: 'bulk:token-abc',
  confirmationTokenVersion: 1,
};

describe('dryRunBulkCancel / commitBulkCancel', () => {
  test('dry-run round-trips the preview shape and never sends a page size', async () => {
    const fetch = new ScriptedFetch();
    fetch.routeJsonRpcMethod('weft.workflows.bulk.cancel', DRY_RUN_PREVIEW);
    const client = realClient();

    const preview = await dryRunBulkCancel(client, { status: 'failed' });

    expect(preview.matched).toBe(3);
    expect(preview.confirmationToken).toBe('bulk:token-abc');
    const [call] = fetch.calls;
    const params = requestParams(call);
    expect(params['dryRun']).toBe(true);
    fetch.restore();
  });

  test('commit sends the confirmation token and parses the committed result', async () => {
    const fetch = new ScriptedFetch();
    fetch.routeJsonRpcMethod('weft.workflows.bulk.cancel', {
      cancelled: 2,
      failed: 1,
      errors: [{ id: 'wf-3', error: 'already completed' }],
    });
    const client = realClient();

    const result = await commitBulkCancel(client, { status: 'failed' }, 'bulk:token-abc');

    expect(result.cancelled).toBe(2);
    expect(result.errors).toEqual([{ id: 'wf-3', error: 'already completed' }]);
    const [call] = fetch.calls;
    const params = requestParams(call);
    expect(params['confirmationToken']).toBe('bulk:token-abc');
    fetch.restore();
  });

  test('throws when the server returns an unexpected shape', async () => {
    const fetch = new ScriptedFetch();
    fetch.routeJsonRpcMethod('weft.workflows.bulk.cancel', { unexpected: true });
    const client = realClient();

    expect(await throwingRejectionOf(dryRunBulkCancel(client, { status: 'failed' }))).toThrow(
      TypeError,
    );
    fetch.restore();
  });

  test('a stale confirmation token surfaces as an InvalidParams-shaped fault', async () => {
    const fetch = new ScriptedFetch();
    fetch.routeJsonRpcMethodUnprocessable(
      'weft.workflows.bulk.cancel',
      'Bulk confirmation token does not match the current dry-run scope',
    );
    const client = realClient();

    expect(
      await throwingRejectionOf(commitBulkCancel(client, { status: 'failed' }, 'bulk:stale-token')),
    ).toThrow(/confirmation token/i);
    fetch.restore();
  });
});

describe('dryRunBulkRetryFailed / commitBulkRetryFailed', () => {
  test('round-trips', async () => {
    const fetch = new ScriptedFetch();
    fetch.routeJsonRpcMethod('weft.workflows.bulk.retryfailed', {
      ...DRY_RUN_PREVIEW,
      action: 'retry-failed',
    });
    const client = realClient();
    const preview = await dryRunBulkRetryFailed(client, { status: 'failed' });
    expect(preview.matched).toBe(3);
    fetch.restore();

    const fetch2 = new ScriptedFetch();
    fetch2.routeJsonRpcMethod('weft.workflows.bulk.retryfailed', {
      retried: 3,
      failed: 0,
      errors: [],
    });
    const client2 = realClient();
    const result = await commitBulkRetryFailed(client2, { status: 'failed' }, 'bulk:token-abc');
    expect(result.retried).toBe(3);
    fetch2.restore();
  });
});

describe('dryRunBulkDelete / commitBulkDelete', () => {
  test('round-trips, including skippedTeardownPending', async () => {
    const fetch = new ScriptedFetch();
    fetch.routeJsonRpcMethod('weft.workflows.bulk.delete', {
      ...DRY_RUN_PREVIEW,
      action: 'delete',
    });
    const client = realClient();
    const preview = await dryRunBulkDelete(client, { status: 'completed' });
    expect(preview.matched).toBe(3);
    fetch.restore();

    const fetch2 = new ScriptedFetch();
    fetch2.routeJsonRpcMethod('weft.workflows.bulk.delete', {
      deleted: 2,
      skippedTeardownPending: ['wf-3'],
    });
    const client2 = realClient();
    const result = await commitBulkDelete(client2, { status: 'completed' }, 'bulk:token-abc');
    expect(result.deleted).toBe(2);
    expect(result.skippedTeardownPending).toEqual(['wf-3']);
    fetch2.restore();
  });
});

describe('dryRunBulkSignal / commitBulkSignal', () => {
  test('sends name/payload alongside the flat filter', async () => {
    const fetch = new ScriptedFetch();
    fetch.routeJsonRpcMethod('weft.workflows.bulk.signal', {
      ...DRY_RUN_PREVIEW,
      action: 'signal',
    });
    const client = realClient();

    await dryRunBulkSignal(client, { status: 'running' }, 'addItem', { sku: 'abc' });

    const [call] = fetch.calls;
    const params = requestParams(call);
    expect(params['name']).toBe('addItem');
    expect(params['payload']).toEqual({ sku: 'abc' });
    expect(params['status']).toBe('running');
    fetch.restore();

    const fetch2 = new ScriptedFetch();
    fetch2.routeJsonRpcMethod('weft.workflows.bulk.signal', { signalled: 3, failed: 0 });
    const client2 = realClient();
    const result = await commitBulkSignal(
      client2,
      { status: 'running' },
      'addItem',
      { sku: 'abc' },
      'bulk:token-abc',
    );
    expect(result.signalled).toBe(3);
    fetch2.restore();
  });
});

describe('dryRunBulkTags / commitBulkTags', () => {
  test('nests the filter under `filter` (the wire shape differs from the other five)', async () => {
    const fetch = new ScriptedFetch();
    fetch.routeJsonRpcMethod('weft.workflows.bulk.tags', { ...DRY_RUN_PREVIEW, action: 'tag:add' });
    const client = realClient();

    await dryRunBulkTags(client, { tags: ['nightly'] }, 'add', ['urgent']);

    const [call] = fetch.calls;
    const params = requestParams(call);
    expect(params['filter']).toEqual({ tags: ['nightly'] });
    expect(params['operation']).toBe('add');
    expect(params['tags']).toEqual(['urgent']);
    fetch.restore();

    const fetch2 = new ScriptedFetch();
    fetch2.routeJsonRpcMethod('weft.workflows.bulk.tags', { modified: 5 });
    const client2 = realClient();
    const result = await commitBulkTags(
      client2,
      { tags: ['nightly'] },
      'remove',
      ['urgent'],
      'bulk:token-abc',
    );
    expect(result.modified).toBe(5);
    fetch2.restore();
  });
});

describe('purgeWorkflows', () => {
  test('sends only the filter — no dryRun/confirmationToken field exists for purge', async () => {
    const fetch = new ScriptedFetch();
    fetch.routeJsonRpcMethod('weft.workflows.purge', { deleted: 9 });
    const client = realClient();

    const result = await purgeWorkflows(client, { status: 'completed' });

    expect(result.deleted).toBe(9);
    const [call] = fetch.calls;
    const params = requestParams(call);
    expect(params).not.toHaveProperty('dryRun');
    expect(params).not.toHaveProperty('confirmationToken');
    fetch.restore();
  });
});
