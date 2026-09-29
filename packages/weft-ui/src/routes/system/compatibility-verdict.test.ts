/**
 * Unit tests for `compatibility-verdict.ts` (WFT-115): reason labels, the
 * activation-conflict data reader, and the activation-outcome combinator.
 */
import { HttpClientError } from '@lostgradient/weft';
import { describe, expect, test } from 'bun:test';

import {
  compatibilityReasonLabel,
  describeActivationOutcome,
  KNOWN_COMPATIBILITY_REASONS,
  readActivationConflictData,
  resolveExpectedGeneration,
} from './compatibility-verdict.ts';

describe('KNOWN_COMPATIBILITY_REASONS', () => {
  test('lists exactly the five WorkflowCompatibilityReason literals', () => {
    expect(KNOWN_COMPATIBILITY_REASONS).toEqual([
      'name-mismatch',
      'manifest-version-unsupported',
      'contract-hash-mismatch',
      'workflow-version-incompatible',
      'artifact-revision-mismatch',
    ]);
  });
});

describe('compatibilityReasonLabel', () => {
  for (const reason of KNOWN_COMPATIBILITY_REASONS) {
    test(`labels "${reason}" as human-readable, sentence-case text`, () => {
      const label = compatibilityReasonLabel(reason);
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toBe(reason);
      expect(label.startsWith('unknown reason')).toBe(false);
    });
  }

  test('renders an unrecognized reason as "unknown reason: <value>" rather than fabricating a label', () => {
    expect(compatibilityReasonLabel('some-future-reason')).toBe(
      'unknown reason: some-future-reason',
    );
  });
});

describe('readActivationConflictData', () => {
  test('returns undefined for a non-HttpClientError', () => {
    expect(readActivationConflictData(new Error('boom'))).toBeUndefined();
    expect(readActivationConflictData('not an error')).toBeUndefined();
    expect(readActivationConflictData(undefined)).toBeUndefined();
  });

  test('returns undefined when the error carries no data at all', () => {
    const error = new HttpClientError(409, 'Conflict');
    expect(readActivationConflictData(error)).toBeUndefined();
  });

  test('reads compatibilityReasons off HttpClientError.data, filtering non-string entries', () => {
    const error = new HttpClientError(409, 'Conflict', {
      faultCode: 'Conflict',
      data: {
        reason: 'incompatible',
        compatibilityReasons: ['contract-hash-mismatch', 42, 'workflow-version-incompatible'],
      },
    });
    expect(readActivationConflictData(error)).toEqual({
      compatibilityReasons: ['contract-hash-mismatch', 'workflow-version-incompatible'],
    });
  });

  test('reads currentGeneration-only data (stale/expected-generation-required)', () => {
    const error = new HttpClientError(409, 'Conflict', {
      faultCode: 'Conflict',
      data: { reason: 'stale-generation', currentGeneration: 3 },
    });
    expect(readActivationConflictData(error)).toEqual({ currentGeneration: 3 });
  });

  test('returns undefined when data has neither field (an empty compatibilityReasons array counts as absent)', () => {
    const error = new HttpClientError(409, 'Conflict', {
      faultCode: 'Conflict',
      data: { reason: 'conflict' },
    });
    expect(readActivationConflictData(error)).toBeUndefined();
  });
});

describe('resolveExpectedGeneration', () => {
  test('returns undefined when neither source has a generation (never activated)', () => {
    expect(resolveExpectedGeneration(null, undefined)).toBeUndefined();
  });

  test('returns the pending generation when active is unknown', () => {
    expect(resolveExpectedGeneration(4, undefined)).toBe(4);
  });

  test('returns the active generation when there is no pending refusal', () => {
    expect(resolveExpectedGeneration(null, 7)).toBe(7);
  });

  test('prefers the NEWER of the two when both are known, even when that is `active` — a stale refusal stored generation 4, then a refresh observed a newer generation 5 from another process activating in between', () => {
    expect(resolveExpectedGeneration(4, 5)).toBe(5);
  });

  test('prefers the NEWER of the two when that is `pending` (active has not caught up yet)', () => {
    expect(resolveExpectedGeneration(6, 5)).toBe(6);
  });

  test('either source alone at the same value is idempotent', () => {
    expect(resolveExpectedGeneration(5, 5)).toBe(5);
  });
});

describe('describeActivationOutcome', () => {
  test('an applied attempt renders as the applied outcome, pointer verbatim', () => {
    const pointer = { revision: 'rev-2', generation: 4, activatedAt: 1_700_000_000_000 };
    expect(describeActivationOutcome({ applied: true, pointer })).toEqual({
      kind: 'applied',
      pointer,
    });
  });

  test('a refusal carrying compatibilityReasons renders as the incompatible outcome', () => {
    const error = new HttpClientError(409, 'Candidate revision is incompatible', {
      faultCode: 'Conflict',
      data: {
        reason: 'incompatible',
        compatibilityReasons: ['contract-hash-mismatch', 'workflow-version-incompatible'],
      },
    });
    expect(describeActivationOutcome({ applied: false, error })).toEqual({
      kind: 'incompatible',
      reasons: ['contract-hash-mismatch', 'workflow-version-incompatible'],
    });
  });

  test('a refusal carrying only currentGeneration renders as the stale outcome', () => {
    const error = new HttpClientError(409, 'Stale expectedGeneration', {
      faultCode: 'Conflict',
      data: { reason: 'stale-generation', currentGeneration: 5 },
    });
    expect(describeActivationOutcome({ applied: false, error })).toEqual({
      kind: 'stale',
      currentGeneration: 5,
    });
  });

  test('a refusal with neither field, or a non-conflict fault, rethrows the original error', () => {
    const notFound = new HttpClientError(404, 'Workflow revision not installed', {
      faultCode: 'NotFound',
    });
    expect(() => describeActivationOutcome({ applied: false, error: notFound })).toThrow(notFound);

    const bare = new Error('network blip');
    expect(() => describeActivationOutcome({ applied: false, error: bare })).toThrow(bare);
  });
});
