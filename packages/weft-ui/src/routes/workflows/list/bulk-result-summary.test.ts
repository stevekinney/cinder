import { describe, expect, test } from 'bun:test';

import {
  cancelResultSummary,
  deleteResultSummary,
  purgeResultSummary,
  retryFailedResultSummary,
  signalResultSummary,
  tagResultSummary,
} from './bulk-result-summary.ts';

describe('cancelResultSummary', () => {
  test('reports cancelled-of-matched and passes through per-workflow errors', () => {
    const summary = cancelResultSummary(
      { cancelled: 45, failed: 2, errors: [{ id: 'wf-1', error: 'boom' }] },
      47,
    );
    expect(summary.headline).toBe('Cancelled 45 of 47 workflows');
    expect(summary.errors).toEqual([{ id: 'wf-1', error: 'boom' }]);
    expect(summary.note).toBeUndefined();
  });
});

describe('retryFailedResultSummary', () => {
  test('reports retried-of-matched', () => {
    const summary = retryFailedResultSummary({ retried: 30, failed: 0, errors: [] }, 30);
    expect(summary.headline).toBe('Retried 30 of 30 workflows');
    expect(summary.errors).toEqual([]);
  });
});

describe('signalResultSummary', () => {
  test('adds a note when some signals failed to deliver (no per-id detail on the wire)', () => {
    const summary = signalResultSummary({ signalled: 45, failed: 2 }, 47);
    expect(summary.headline).toBe('Signalled 45 of 47 workflows');
    expect(summary.errors).toEqual([]);
    expect(summary.note).toBe('2 workflows did not receive the signal.');
  });

  test('no note when nothing failed', () => {
    const summary = signalResultSummary({ signalled: 47, failed: 0 }, 47);
    expect(summary.note).toBeUndefined();
  });
});

describe('deleteResultSummary', () => {
  test('adds a note when workflows were skipped for a pending finalizer', () => {
    const summary = deleteResultSummary(
      { deleted: 40, skippedTeardownPending: ['wf-1', 'wf-2'] },
      42,
    );
    expect(summary.headline).toBe('Deleted 40 of 42 workflows');
    expect(summary.note).toBe(
      '2 workflows skipped — still owe a finalizer run. Delete again once it settles.',
    );
  });

  test('no note when nothing was skipped', () => {
    const summary = deleteResultSummary({ deleted: 42 }, 42);
    expect(summary.note).toBeUndefined();
  });
});

describe('tagResultSummary', () => {
  test('add operation', () => {
    expect(tagResultSummary({ modified: 47 }, 'add', 47).headline).toBe(
      'Added tags to 47 of 47 workflows',
    );
  });

  test('remove operation', () => {
    expect(tagResultSummary({ modified: 10 }, 'remove', 12).headline).toBe(
      'Removed tags from 10 of 12 workflows',
    );
  });
});

describe('purgeResultSummary', () => {
  test('singular vs plural', () => {
    expect(purgeResultSummary({ deleted: 1 }).headline).toBe('Purged 1 workflow');
    expect(purgeResultSummary({ deleted: 0 }).headline).toBe('Purged 0 workflows');
  });
});
