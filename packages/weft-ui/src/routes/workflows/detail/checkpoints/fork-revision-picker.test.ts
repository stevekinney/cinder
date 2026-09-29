import { describe, expect, test } from 'bun:test';

import { HttpClientError } from '@lostgradient/weft';

import {
  forkConflictGuidance,
  isForkRevisionConflict,
  parseInstalledRevisions,
  resolveForkOptions,
  type ForkRevisionSelection,
} from './fork-revision-picker.ts';

function revisionRecord(revision: string, installedAt: number) {
  return {
    manifest: { manifestVersion: 1, name: 'order-processing', workflowVersion: '1.0.0', revision },
    installedAt,
  };
}

describe('resolveForkOptions', () => {
  test('mode: source omits revision entirely', () => {
    const selection: ForkRevisionSelection = { mode: 'source' };
    expect(resolveForkOptions(selection, 4)).toEqual({ fromStep: 4 });
  });

  test('mode: explicit includes the chosen revision verbatim', () => {
    const selection: ForkRevisionSelection = {
      mode: 'explicit',
      revision: 'order-processing-rev-b',
    };
    expect(resolveForkOptions(selection, 4)).toEqual({
      fromStep: 4,
      revision: 'order-processing-rev-b',
    });
  });
});

describe('isForkRevisionConflict', () => {
  test('true for a WorkflowRevisionUnavailableError-coded HttpClientError', () => {
    const error = new HttpClientError(409, 'revision not registered', {
      faultCode: 'Conflict',
      weftCode: 'WorkflowRevisionUnavailableError',
    });
    expect(isForkRevisionConflict(error)).toBe(true);
  });

  test('false for a generic 409 Conflict with no weftCode', () => {
    const error = new HttpClientError(409, 'stale token', { faultCode: 'Conflict' });
    expect(isForkRevisionConflict(error)).toBe(false);
  });

  test('false for a differently-coded fault', () => {
    const error = new HttpClientError(409, 'spent idempotency key', {
      faultCode: 'Conflict',
      weftCode: 'IdempotencyKeyPurgedError',
    });
    expect(isForkRevisionConflict(error)).toBe(false);
  });

  test('false for a plain Error', () => {
    expect(isForkRevisionConflict(new Error('boom'))).toBe(false);
  });

  test('false for a non-error value', () => {
    expect(isForkRevisionConflict('nope')).toBe(false);
    expect(isForkRevisionConflict(null)).toBe(false);
  });
});

describe('forkConflictGuidance', () => {
  test('explicit mode points back at the source revision — real, available advice', () => {
    const selection: ForkRevisionSelection = { mode: 'explicit', revision: 'rev-b' };
    expect(forkConflictGuidance(selection)).toMatch(/use the source revision instead/);
  });

  test('source mode does NOT tell the operator to retry the thing that just failed (Codex review, PR #978)', () => {
    const selection: ForkRevisionSelection = { mode: 'source' };
    const guidance = forkConflictGuidance(selection);
    expect(guidance).not.toMatch(/use the source revision/);
    expect(guidance).toMatch(/Fork a different revision/);
  });
});

describe('parseInstalledRevisions', () => {
  test('sorts well-formed records newest-installed-first', () => {
    const result = parseInstalledRevisions([
      revisionRecord('rev-old', 1_000),
      revisionRecord('rev-new', 3_000),
      revisionRecord('rev-mid', 2_000),
    ]);
    expect(result).toEqual([
      { revision: 'rev-new', installedAt: 3_000 },
      { revision: 'rev-mid', installedAt: 2_000 },
      { revision: 'rev-old', installedAt: 1_000 },
    ]);
  });

  test('returns an empty array for an empty list', () => {
    expect(parseInstalledRevisions([])).toEqual([]);
  });

  test('returns undefined for a non-array response', () => {
    expect(parseInstalledRevisions(null)).toBeUndefined();
    expect(parseInstalledRevisions(undefined)).toBeUndefined();
    expect(parseInstalledRevisions({})).toBeUndefined();
  });

  test('returns undefined (not a partial list) when any entry is malformed', () => {
    const result = parseInstalledRevisions([
      revisionRecord('rev-a', 1_000),
      { manifest: { revision: 'rev-b' } }, // missing installedAt
    ]);
    expect(result).toBeUndefined();
  });
});
