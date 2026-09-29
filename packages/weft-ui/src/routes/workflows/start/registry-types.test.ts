import { describe, expect, test } from 'bun:test';

import { narrowRegistryWorkflows } from './registry-types.ts';

function manifest(name: string, revision: string, contract: Record<string, unknown> = {}) {
  return {
    manifestVersion: 1,
    name,
    workflowVersion: '1.0.0',
    revision,
    contractHash: `${name}-hash`,
    contract: { name, workflowVersion: '1.0.0', ...contract },
  };
}

describe('narrowRegistryWorkflows', () => {
  test('returns {} for non-array workflows or non-object activeRevisions', () => {
    expect(narrowRegistryWorkflows(undefined, {})).toEqual({});
    expect(narrowRegistryWorkflows(null, {})).toEqual({});
    expect(narrowRegistryWorkflows('nope', {})).toEqual({});
    expect(narrowRegistryWorkflows([], undefined)).toEqual({});
    expect(narrowRegistryWorkflows([], null)).toEqual({});
  });

  test('keeps each active manifest projected to a RegistryWorkflowEntry (name/workflowVersion dropped), carrying its own revision', () => {
    const result = narrowRegistryWorkflows(
      [
        manifest('order-processing', 'rev-a', { inputSchema: { type: 'object' } }),
        manifest('no-schema', 'rev-b'),
      ],
      { 'order-processing': 'rev-a', 'no-schema': 'rev-b' },
    );
    expect(result).toEqual({
      'order-processing': { inputSchema: { type: 'object' }, revision: 'rev-a' },
      'no-schema': { revision: 'rev-b' },
    });
  });

  test('drops a manifest whose revision does not match activeRevisions', () => {
    const result = narrowRegistryWorkflows(
      [manifest('order-processing', 'rev-old', { description: 'stale' })],
      { 'order-processing': 'rev-new' },
    );
    expect(result).toEqual({});
  });

  test('drops a manifest not named in activeRevisions at all', () => {
    const result = narrowRegistryWorkflows([manifest('order-processing', 'rev-a')], {});
    expect(result).toEqual({});
  });

  test("regression (WFT-115): unaffected by the sibling registry-view.ts contract extension — a manifest carrying the full signals/updates/queries/activities/finalizer surface still projects to only RegistryWorkflowEntry's fields", () => {
    const result = narrowRegistryWorkflows(
      [
        manifest('order-processing', 'rev-a', {
          inputSchema: { type: 'object' },
          signals: { cancel: { inputSchema: { type: 'object' } } },
          updates: { expedite: { inputSchema: { type: 'object' } } },
          queries: { status: { outputSchema: { type: 'object' } } },
          activities: { chargeCard: { inputSchema: { type: 'object' } } },
          finalizer: { inputSchema: { type: 'object' } },
        }),
      ],
      { 'order-processing': 'rev-a' },
    );
    expect(result).toEqual({
      'order-processing': { inputSchema: { type: 'object' }, revision: 'rev-a' },
    });
  });

  test('drops array entries that are not manifest-shaped', () => {
    const result = narrowRegistryWorkflows(
      [
        'not an object',
        null,
        { name: 'missing-revision' },
        manifest('valid', 'rev-a', { description: 'ok' }),
      ],
      { valid: 'rev-a' },
    );
    expect(result).toEqual({
      valid: { description: 'ok', revision: 'rev-a' },
    });
  });

  test('drops a manifest-shaped entry whose contract is not an object', () => {
    const result = narrowRegistryWorkflows(
      [
        {
          manifestVersion: 1,
          name: 'broken',
          workflowVersion: '1.0.0',
          revision: 'rev-a',
          contract: null,
        },
      ],
      { broken: 'rev-a' },
    );
    expect(result).toEqual({});
  });

  test('preserves a workflow literally named "__proto__"', () => {
    // `{ '__proto__': 'rev-a' }` as an object *literal* is the language's
    // special prototype-setting syntax (quoting the key does not change
    // that), so it would silently produce an object with zero own
    // properties. `JSON.parse` uses `CreateDataProperty` instead, which
    // really does set `__proto__` as an own data property — the same shape
    // `activeRevisions` arrives in from a real `response.json()` call.
    const activeRevisions: unknown = JSON.parse('{"__proto__":"rev-a"}');
    const result = narrowRegistryWorkflows(
      [manifest('__proto__', 'rev-a', { description: 'proto-named' })],
      activeRevisions,
    );
    expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(true);
    expect(result['__proto__']).toEqual({ description: 'proto-named', revision: 'rev-a' });
    // Sanity: the object's actual prototype must be unaffected.
    expect(Object.getPrototypeOf(result)).toBeNull();
  });
});
