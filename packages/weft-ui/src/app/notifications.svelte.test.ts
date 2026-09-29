/**
 * `classifyFleetEvent`/`NotificationStore` unit tests (plan §13 T1.6,
 * design `Weft New Surfaces.dc.html` §C). Covers the full 31-kind
 * `EVENTS_READ_EVENT_TYPES` → tier mapping (verified against
 * `weft/src/server/runtime/client-visible-events.ts`, v0.11.0) plus the
 * store's ingest/read/dismiss behavior.
 */
import { describe, expect, test } from 'bun:test';

import type { FleetEventFrame } from '../lib/live-source/fleet-event-source.svelte.ts';
import {
  classifyFleetEvent,
  NotificationStore,
  type NotificationTier,
} from './notifications.svelte.ts';

function frame(kind: string, overrides: Partial<FleetEventFrame> = {}): FleetEventFrame {
  return {
    kind,
    sequence: 1,
    cursor: 'cursor-1',
    emittedAtMs: 1_000,
    payload: {},
    ...overrides,
  };
}

/** Every client-visible fleet event kind (`EVENTS_READ_EVENT_TYPES`, weft v0.11.0) mapped to its expected tier per this module's documented severity principle. */
const EXPECTED_TIERS: Readonly<Record<string, NotificationTier>> = {
  'alert:fired': 'critical',
  'task:dead-lettered': 'critical',
  'schedule:missed-fire': 'warning',
  'constraint:violated': 'warning',
  'checkpoint:size-warning': 'warning',
  'human-review:requested': 'info',
  'alert:resolved': 'info',
  'worker:connected': 'info',
  'worker:disconnected': 'warning',
  'workflow:started': 'info',
  'workflow:completed': 'info',
  'workflow:failed': 'warning',
  'workflow:cancelled': 'warning',
  'workflow:timed-out': 'warning',
  'workflow:resumed': 'info',
  'workflow:suspended': 'info',
  'workflow:teardown': 'info',
  'activity:started': 'info',
  'activity:completed': 'info',
  'activity:failed': 'warning',
  'activity:async-pending': 'info',
  'signal:received': 'info',
  'signal:delivered': 'info',
  'attributes:changed': 'info',
  'update:received': 'info',
  'update:completed': 'info',
  'schedule:fired': 'info',
  'development:warning': 'warning',
  'cleanup:warning': 'warning',
  'storage:size-reported': 'warning',
  'human-review:completed': 'info',
};

describe('classifyFleetEvent', () => {
  test('maps every client-visible fleet event kind to a tier — no gaps', () => {
    for (const [kind, tier] of Object.entries(EXPECTED_TIERS)) {
      const classified = classifyFleetEvent(frame(kind));
      expect(classified).not.toBeNull();
      expect(classified?.tier).toBe(tier);
    }
  });

  test('returns null for an unrecognized kind', () => {
    expect(classifyFleetEvent(frame('not-a-real-kind'))).toBeNull();
  });

  test('embeds a truncated workflow id in the body when workflowId is present', () => {
    const classified = classifyFleetEvent(
      frame('workflow:started', { workflowId: 'wf_1234567890abcdef1234' }),
    );
    expect(classified?.body).toBe('Workflow wf_12345…1234');
    expect(classified?.href).toBe('/workflows/wf_1234567890abcdef1234');
  });

  test('encodes URL delimiters in workflow notification links', () => {
    const classified = classifyFleetEvent(
      frame('workflow:started', { workflowId: 'wf/orders?region=west#retry' }),
    );

    expect(classified?.href).toBe('/workflows/wf%2Forders%3Fregion%3Dwest%23retry');
  });

  test('falls back to a generic body/href when workflowId is absent', () => {
    const classified = classifyFleetEvent(frame('worker:connected', { payload: {} }));
    expect(classified?.body).toBe('A worker joined the fleet');
    expect(classified?.href).toBe('/workers');
  });

  test('reads a string payload field into the title/body when present', () => {
    const classified = classifyFleetEvent(
      frame('alert:fired', { payload: { name: 'dead-letter-threshold' } }),
    );
    expect(classified?.body).toBe('dead-letter-threshold');
  });

  test('non-workflow kinds route to their owning domain list', () => {
    expect(classifyFleetEvent(frame('schedule:missed-fire'))?.href).toBe('/schedules');
    expect(classifyFleetEvent(frame('human-review:requested'))?.href).toBe('/reviews');
    expect(classifyFleetEvent(frame('storage:size-reported'))?.href).toBe('/storage');
    expect(classifyFleetEvent(frame('development:warning'))?.href).toBe('/system');
  });
});

describe('NotificationStore', () => {
  test('ingest() classifies and prepends; returns null for an unmapped kind without mutating state', () => {
    const store = new NotificationStore();

    const item = store.ingest(frame('workflow:started', { workflowId: 'wf-1' }));
    expect(item).not.toBeNull();
    expect(store.items).toHaveLength(1);
    expect(store.items[0]?.read).toBe(false);

    const unmapped = store.ingest(frame('not-a-real-kind'));
    expect(unmapped).toBeNull();
    expect(store.items).toHaveLength(1);
  });

  test('unreadCount reflects only unread items', () => {
    const store = new NotificationStore();
    store.ingest(frame('workflow:started', { cursor: 'c1' }));
    store.ingest(frame('workflow:completed', { cursor: 'c2' }));
    expect(store.unreadCount).toBe(2);

    store.markRead('c1');
    expect(store.unreadCount).toBe(1);
  });

  test('markAllRead() marks every item read', () => {
    const store = new NotificationStore();
    store.ingest(frame('workflow:started', { cursor: 'c1' }));
    store.ingest(frame('workflow:failed', { cursor: 'c2' }));

    store.markAllRead();

    expect(store.unreadCount).toBe(0);
    expect(store.items.every((item) => item.read)).toBe(true);
  });

  test('critical/warning/info getters partition items by tier', () => {
    const store = new NotificationStore();
    store.ingest(frame('alert:fired', { cursor: 'c1' }));
    store.ingest(frame('workflow:failed', { cursor: 'c2' }));
    store.ingest(frame('workflow:started', { cursor: 'c3' }));

    expect(store.critical).toHaveLength(1);
    expect(store.warning).toHaveLength(1);
    expect(store.info).toHaveLength(1);
  });

  test('criticalUnread excludes dismissed critical items but they remain in critical/items', () => {
    const store = new NotificationStore();
    store.ingest(frame('alert:fired', { cursor: 'c1' }));
    expect(store.criticalUnread).toHaveLength(1);

    store.dismissCritical('c1');

    expect(store.criticalUnread).toHaveLength(0);
    expect(store.critical).toHaveLength(1);
    expect(store.items[0]?.read).toBe(true);
  });

  test('dismissCritical() is a no-op for a non-critical or unknown id', () => {
    const store = new NotificationStore();
    store.ingest(frame('workflow:started', { cursor: 'c1' }));

    store.dismissCritical('c1');
    expect(store.items[0]?.read).toBe(false);

    store.dismissCritical('does-not-exist');
    expect(store.items).toHaveLength(1);
  });

  test('history is bounded to the most recent 50 items', () => {
    const store = new NotificationStore();
    for (let index = 0; index < 55; index += 1) {
      store.ingest(frame('workflow:started', { cursor: `c${index}`, workflowId: `wf-${index}` }));
    }

    expect(store.items).toHaveLength(50);
    // Most recent (`c54`) is first — the list is newest-first.
    expect(store.items[0]?.id).toBe('c54');
  });
});
