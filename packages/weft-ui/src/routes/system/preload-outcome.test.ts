/**
 * Unit tests for `preload-outcome.ts` (WFT-116) — the pure
 * `weft.workflows.revisions.preload` wire-outcome → operator-copy mapping.
 * Every bounded fault the server can produce is exercised by constructing
 * the exact `HttpClientError` shape `httpClientCatalogTransport` builds from
 * a JSON-RPC error envelope (`faultCode` from `error.data.weftCode`, `data`
 * forwarded verbatim).
 */
import { describe, expect, it } from 'bun:test';

import { HttpClientError, isFaultCode } from '@lostgradient/weft';

import {
  describePreloadOutcome,
  KNOWN_PRELOAD_CONFLICT_REASONS,
  KNOWN_SOURCE_REJECTION_REASONS,
  preloadConflictReasonLabel,
  sourceRejectionReasonLabel,
} from './preload-outcome.ts';

function fault(
  status: number,
  faultCode: string,
  message: string,
  data?: Record<string, unknown>,
): HttpClientError {
  if (!isFaultCode(faultCode)) throw new Error(`Unknown fault code: ${faultCode}`);
  return new HttpClientError(status, message, {
    faultCode,
    ...(data === undefined ? {} : { data: { ...data, weftCode: faultCode } }),
  });
}

function rejected(error: unknown) {
  return describePreloadOutcome({ installed: false, error }, 'dynamic-invoice', 'r2');
}

describe('describePreloadOutcome', () => {
  it('reports a successful install with the revision it installed', () => {
    const outcome = describePreloadOutcome(
      { installed: true, revision: 'r2' },
      'dynamic-invoice',
      'r2',
    );
    expect(outcome).toEqual({ kind: 'installed', revision: 'r2' });
  });

  it('explains a NotFound for a never-registered source key', () => {
    const outcome = rejected(fault(404, 'NotFound', 'no source', { resource: 'workflow-source' }));
    if (outcome.kind !== 'no-source') throw new Error('expected no-source');
    expect(outcome.message).toContain('dynamic-invoice');
    expect(outcome.message).toContain('r2');
    expect(outcome.message).toContain('engine.registerSource()');
  });

  it('distinguishes a NotFound for an uninstalled revision from a missing source', () => {
    const outcome = rejected(
      fault(404, 'NotFound', 'not installed', { resource: 'workflow-revision' }),
    );
    if (outcome.kind !== 'no-source') throw new Error('expected no-source');
    expect(outcome.message).toBe('Revision "r2" of "dynamic-invoice" is not installed.');
  });

  it('falls back to the missing-source copy when NotFound carries no resource field', () => {
    const outcome = rejected(fault(404, 'NotFound', 'no source'));
    if (outcome.kind !== 'no-source') throw new Error('expected no-source');
    expect(outcome.message).toContain('engine.registerSource()');
  });

  it('reports a load-failed conflict without claiming to know the underlying cause', () => {
    const outcome = rejected(fault(409, 'Conflict', 'failed to load', { reason: 'load-failed' }));
    if (outcome.kind !== 'rejected') throw new Error('expected rejected');
    expect(outcome.reason).toBe('load-failed');
    expect(outcome.message).toContain('bounded failure category');
    expect(outcome.rejectionReasons).toEqual([]);
  });

  it('lists every bounded source-validation reason a validation-failed conflict carries', () => {
    const outcome = rejected(
      fault(409, 'Conflict', 'invalid', {
        reason: 'validation-failed',
        sourceValidationReasons: ['missing-export', 'contract-hash-mismatch'],
      }),
    );
    if (outcome.kind !== 'rejected') throw new Error('expected rejected');
    expect(outcome.reason).toBe('validation-failed');
    expect(outcome.rejectionReasons).toEqual(['missing-export', 'contract-hash-mismatch']);
  });

  it('drops non-string entries from a malformed sourceValidationReasons array', () => {
    const outcome = rejected(
      fault(409, 'Conflict', 'invalid', {
        reason: 'validation-failed',
        sourceValidationReasons: ['missing-export', 7, null],
      }),
    );
    if (outcome.kind !== 'rejected') throw new Error('expected rejected');
    expect(outcome.rejectionReasons).toEqual(['missing-export']);
  });

  it('treats a non-array sourceValidationReasons as absent', () => {
    const outcome = rejected(
      fault(409, 'Conflict', 'invalid', {
        reason: 'validation-failed',
        sourceValidationReasons: 'missing-export',
      }),
    );
    if (outcome.kind !== 'rejected') throw new Error('expected rejected');
    expect(outcome.rejectionReasons).toEqual([]);
  });

  it('renders an unrecognized conflict reason honestly rather than inventing copy', () => {
    const outcome = rejected(fault(409, 'Conflict', 'nope', { reason: 'sunspots' }));
    if (outcome.kind !== 'rejected') throw new Error('expected rejected');
    expect(outcome.reason).toBe('sunspots');
    expect(outcome.message).toContain('does not recognize');
    expect(outcome.message).toContain('sunspots');
  });

  it('falls back to an unknown reason when a Conflict carries no data at all', () => {
    const outcome = rejected(fault(409, 'Conflict', 'nope'));
    if (outcome.kind !== 'rejected') throw new Error('expected rejected');
    expect(outcome.reason).toBe('unknown');
  });

  it('reports an InvalidParams fault with the server message that named the bad field', () => {
    const outcome = rejected(
      fault(400, 'InvalidParams', 'Field "revision" must be a non-empty string'),
    );
    if (outcome.kind !== 'invalid') throw new Error('expected invalid');
    expect(outcome.message).toContain('Field "revision"');
  });

  it.each(['Unauthorized', 'Forbidden'])('reports a %s fault as a scope denial', (code) => {
    const outcome = rejected(fault(403, code, 'denied'));
    if (outcome.kind !== 'denied') throw new Error('expected denied');
    expect(outcome.message).toContain('workflows:admin');
  });

  it('reports any other wire fault with its key and message', () => {
    const outcome = rejected(fault(500, 'EngineFailure', 'internal error'));
    if (outcome.kind !== 'faulted') throw new Error('expected faulted');
    expect(outcome.message).toContain('dynamic-invoice');
    expect(outcome.message).toContain('r2');
    expect(outcome.message).toContain('internal error');
  });

  it('reports a transport failure that never reached the fault wire', () => {
    const outcome = rejected(new TypeError('Failed to fetch'));
    if (outcome.kind !== 'faulted') throw new Error('expected faulted');
    expect(outcome.message).toContain('Failed to fetch');
  });

  it('reports a non-Error rejection without fabricating a message', () => {
    const outcome = rejected('something went wrong');
    if (outcome.kind !== 'faulted') throw new Error('expected faulted');
    expect(outcome.message).toBe('The preload request did not complete.');
  });
});

describe('reason labels', () => {
  it.each(['toString', 'constructor', '__proto__', 'hasOwnProperty'])(
    'treats inherited property %s as an unknown reason',
    (reason) => {
      expect(sourceRejectionReasonLabel(reason)).toBe(`unknown reason: ${reason}`);
      expect(preloadConflictReasonLabel(reason)).toContain('does not recognize');
      expect(preloadConflictReasonLabel(reason)).toContain(reason);
    },
  );

  it('describes invalid definitions without assuming how the export was constructed', () => {
    expect(sourceRejectionReasonLabel('invalid-definition')).toBe(
      'The candidate workflow definition is invalid or could not be normalized.',
    );
  });

  it.each([...KNOWN_PRELOAD_CONFLICT_REASONS])('labels the %s conflict reason', (reason) => {
    expect(preloadConflictReasonLabel(reason)).not.toContain('does not recognize');
  });

  it.each([...KNOWN_SOURCE_REJECTION_REASONS])('labels the %s rejection reason', (reason) => {
    expect(sourceRejectionReasonLabel(reason)).not.toContain('unknown reason');
  });

  it('falls back honestly for an unrecognized rejection reason', () => {
    expect(sourceRejectionReasonLabel('sunspots')).toBe('unknown reason: sunspots');
  });
});
