/**
 * Component tests for `<CriticalAlertStrip>` (design `Weft New Surfaces.dc.html`
 * §C: "Critical strip below header, dismissible").
 */
import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import type { FleetEventFrame } from '../../lib/live-source/fleet-event-source.svelte.ts';
import { NotificationStore } from '../notifications.svelte.ts';
import CriticalAlertStrip from './critical-alert-strip.svelte';

function fleetFrame(kind: string, overrides: Partial<FleetEventFrame> = {}): FleetEventFrame {
  return { kind, sequence: 1, cursor: 'c1', emittedAtMs: 1, payload: {}, ...overrides };
}

describe('CriticalAlertStrip', () => {
  test('renders nothing when there are no unread critical items', async () => {
    const store = new NotificationStore();
    const { container } = render(CriticalAlertStrip, { props: { store } });

    expect(container.querySelector('.weft-critical-strip')).toBeNull();
  });

  test('renders one row per unread critical item, ignoring warning/info tiers', async () => {
    const store = new NotificationStore();
    store.ingest(fleetFrame('alert:fired', { cursor: 'c1', payload: { name: 'dlq' } }));
    store.ingest(fleetFrame('task:dead-lettered', { cursor: 'c2' }));
    store.ingest(fleetFrame('workflow:failed', { cursor: 'c3' })); // warning, not critical

    const { container } = render(CriticalAlertStrip, { props: { store } });

    expect(container.querySelectorAll('.weft-critical-strip__row')).toHaveLength(2);
  });

  test('dismissing a row calls dismissCritical and removes it from the strip', async () => {
    const store = new NotificationStore();
    store.ingest(fleetFrame('alert:fired', { cursor: 'c1', payload: { name: 'dlq' } }));

    const { container, getByRole } = render(CriticalAlertStrip, { props: { store } });
    expect(container.querySelectorAll('.weft-critical-strip__row')).toHaveLength(1);

    await fireEvent.click(getByRole('button', { name: /Dismiss/ }));

    expect(container.querySelectorAll('.weft-critical-strip__row')).toHaveLength(0);
    expect(store.items[0]?.read).toBe(true);
  });
});
