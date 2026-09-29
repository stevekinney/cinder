import { describe, expect, test } from 'bun:test';

import type { FleetEventFrame } from '../../lib/live-source/fleet-event-source.svelte.ts';
import { AlertsStore, isAlertEventKind } from './alerts-store.svelte.ts';

function frame(kind: string, overrides: Partial<FleetEventFrame> = {}): FleetEventFrame {
  return {
    kind,
    sequence: 1,
    cursor: `c-${Math.random()}`,
    emittedAtMs: 1_000,
    payload: {},
    ...overrides,
  };
}

describe('isAlertEventKind', () => {
  test('true for the seven tracked kinds', () => {
    for (const kind of [
      'alert:fired',
      'alert:resolved',
      'constraint:violated',
      'checkpoint:size-warning',
      'development:warning',
      'cleanup:warning',
      'storage:size-reported',
    ]) {
      expect(isAlertEventKind(kind)).toBe(true);
    }
  });

  test('false for an unrelated kind, e.g. workflow lifecycle', () => {
    expect(isAlertEventKind('workflow:started')).toBe(false);
  });
});

describe('AlertsStore', () => {
  test('starts empty', () => {
    const store = new AlertsStore();
    expect(store.isEmpty).toBe(true);
    expect(store.rows).toEqual([]);
  });

  test('ignores an untracked kind', () => {
    const store = new AlertsStore();
    const result = store.ingest(frame('workflow:started'));
    expect(result).toBeNull();
    expect(store.rows).toEqual([]);
  });

  test('alert:fired appends a firing row', () => {
    const store = new AlertsStore();
    store.ingest(frame('alert:fired', { cursor: 'c1', payload: { name: 'dlq-backlog' } }));

    expect(store.rows.length).toBe(1);
    expect(store.rows[0]).toMatchObject({
      kind: 'alert:fired',
      name: 'dlq-backlog',
      state: 'firing',
    });
  });

  test('alert:resolved appends a resolved row AND retroactively resolves the matching firing row', () => {
    const store = new AlertsStore();
    store.ingest(
      frame('alert:fired', { cursor: 'c1', emittedAtMs: 1000, payload: { name: 'dlq-backlog' } }),
    );
    store.ingest(
      frame('alert:resolved', {
        cursor: 'c2',
        emittedAtMs: 2000,
        payload: { name: 'dlq-backlog' },
      }),
    );

    expect(store.rows.length).toBe(2);
    const resolvedRow = store.rows.find((row) => row.kind === 'alert:resolved');
    const firedRow = store.rows.find((row) => row.kind === 'alert:fired');
    expect(resolvedRow?.state).toBe('resolved');
    expect(firedRow?.state).toBe('resolved');
  });

  test('alert:resolved for an unmatched name does not throw and still logs its own row', () => {
    const store = new AlertsStore();
    store.ingest(frame('alert:resolved', { cursor: 'c1', payload: { name: 'never-fired' } }));
    expect(store.rows.length).toBe(1);
    expect(store.rows[0]?.state).toBe('resolved');
  });

  test('constraint:violated is a firing row with no resolution counterpart', () => {
    const store = new AlertsStore();
    store.ingest(
      frame('constraint:violated', {
        cursor: 'c1',
        workflowId: 'wf_12345678abcd',
        payload: { constraint: 'max-retries' },
      }),
    );
    expect(store.rows[0]).toMatchObject({ state: 'firing', name: 'max-retries' });
    expect(store.rows[0]?.body).toContain('wf_12345…abcd');
  });

  test('operational warning kinds are state "warning", never firing/resolved', () => {
    const store = new AlertsStore();
    for (const kind of [
      'checkpoint:size-warning',
      'development:warning',
      'cleanup:warning',
      'storage:size-reported',
    ]) {
      store.ingest(frame(kind, { cursor: `c-${kind}` }));
    }
    expect(store.rows.every((row) => row.state === 'warning')).toBe(true);
  });

  test('newest-first ordering', () => {
    const store = new AlertsStore();
    store.ingest(frame('alert:fired', { cursor: 'c1', payload: { name: 'a' } }));
    store.ingest(frame('constraint:violated', { cursor: 'c2', payload: { constraint: 'b' } }));
    expect(store.rows.map((row) => row.id)).toEqual(['c2', 'c1']);
  });
});
