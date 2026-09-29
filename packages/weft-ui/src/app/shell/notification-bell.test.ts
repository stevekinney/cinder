/**
 * Component tests for `<NotificationBell>` (design `Weft New Surfaces.dc.html`
 * §C: bell + dropdown, grouped Critical/Warning/Info, "Mark all read").
 */
import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import type { FleetEventFrame } from '../../lib/live-source/fleet-event-source.svelte.ts';
import { NotificationStore } from '../notifications.svelte.ts';
import NotificationBell from './notification-bell.svelte';

function fleetFrame(kind: string, overrides: Partial<FleetEventFrame> = {}): FleetEventFrame {
  return { kind, sequence: 1, cursor: 'c1', emittedAtMs: 1, payload: {}, ...overrides };
}

describe('NotificationBell', () => {
  test('shows no unread count badge when there are no notifications', async () => {
    const store = new NotificationStore();
    const { getByRole, container } = render(NotificationBell, {
      props: { store, liveStatus: 'live' },
    });

    expect(getByRole('button', { name: 'Notifications, 0 unread' })).not.toBeNull();
    expect(container.querySelector('.weft-notification-bell__count')).toBeNull();
  });

  test('shows the unread count badge and grouped items after opening', async () => {
    const store = new NotificationStore();
    store.ingest(fleetFrame('alert:fired', { cursor: 'c1', payload: { name: 'dlq' } }));
    store.ingest(fleetFrame('schedule:missed-fire', { cursor: 'c2' }));
    store.ingest(fleetFrame('worker:connected', { cursor: 'c3', payload: { id: 'w-1' } }));

    const { getByRole, getByText, container } = render(NotificationBell, {
      props: { store, liveStatus: 'live' },
    });

    expect(container.querySelector('.weft-notification-bell__count')?.textContent).toBe('3');

    await fireEvent.click(getByRole('button', { name: 'Notifications, 3 unread' }));

    expect(getByText('Critical')).not.toBeNull();
    expect(getByText('Warning')).not.toBeNull();
    expect(getByText('Info')).not.toBeNull();
    expect(getByText('Alert fired')).not.toBeNull();
  });

  test('empty state renders when there are no items yet', async () => {
    const store = new NotificationStore();
    const { getByRole, getByText } = render(NotificationBell, {
      props: { store, liveStatus: 'live' },
    });

    await fireEvent.click(getByRole('button', { name: 'Notifications, 0 unread' }));

    expect(getByText('No notifications yet.')).not.toBeNull();
  });

  test('"Mark all read" clears the unread count', async () => {
    const store = new NotificationStore();
    store.ingest(fleetFrame('workflow:started', { cursor: 'c1', workflowId: 'wf-1' }));
    store.ingest(fleetFrame('workflow:completed', { cursor: 'c2', workflowId: 'wf-2' }));

    const { getByRole } = render(NotificationBell, { props: { store, liveStatus: 'live' } });
    await fireEvent.click(getByRole('button', { name: 'Notifications, 2 unread' }));
    await fireEvent.click(getByRole('button', { name: 'Mark all read' }));

    expect(store.unreadCount).toBe(0);
  });

  test('clicking a notification marks it read and navigates', async () => {
    const store = new NotificationStore();
    store.ingest(fleetFrame('workflow:started', { cursor: 'c1', workflowId: 'wf-1' }));

    const { getByRole, getByText } = render(NotificationBell, {
      props: { store, liveStatus: 'live' },
    });
    await fireEvent.click(getByRole('button', { name: 'Notifications, 1 unread' }));
    await fireEvent.click(getByText('Workflow started'));

    expect(store.items[0]?.read).toBe(true);
  });

  test('regression: item groups render inside a bounded scroll wrapper, header/footer stay outside it', async () => {
    // Guards the WFC-11 design-fidelity fix: the panel previously had
    // `overflow: hidden` with no `max-height`, so a large feed rendered as
    // one unbounded panel with the footer pushed off-screen. The list must
    // live in its own `.weft-notification-panel__list` wrapper, separate
    // from the header/footer, so only the list scrolls.
    const store = new NotificationStore();
    for (let index = 0; index < 30; index += 1) {
      store.ingest(
        fleetFrame('worker:connected', { cursor: `c${index}`, payload: { id: `w-${index}` } }),
      );
    }

    const { getByRole, container } = render(NotificationBell, {
      props: { store, liveStatus: 'live' },
    });
    await fireEvent.click(
      getByRole('button', { name: `Notifications, ${store.unreadCount} unread` }),
    );

    const list = container.querySelector('.weft-notification-panel__list');
    const header = container.querySelector('.weft-notification-panel__header');
    const footer = container.querySelector('.weft-notification-panel__footer');

    expect(list).not.toBeNull();
    expect(list?.querySelectorAll('.weft-notification-panel__item').length).toBe(30);
    expect(header?.contains(list)).toBe(false);
    expect(footer?.contains(list)).toBe(false);
    expect(list?.contains(footer)).toBe(false);
  });
});
