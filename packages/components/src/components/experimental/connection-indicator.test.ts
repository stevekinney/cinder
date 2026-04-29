/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render } = await import('@testing-library/svelte');
const { default: ConnectionIndicator } = await import('./connection-indicator.svelte');

describe('ConnectionIndicator (experimental)', () => {
  test('renders role=status with default label for the state', () => {
    const { container } = render(ConnectionIndicator, { state: 'connected' });
    const el = container.querySelector('[role="status"]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('data-cinder-state')).toBe('connected');
    expect(el?.textContent?.trim()).toContain('Connected');
  });

  test('custom label overrides the default for the state', () => {
    const { container } = render(ConnectionIndicator, {
      state: 'connecting',
      label: 'Reconnecting',
    });
    const el = container.querySelector('[role="status"]');
    expect(el?.textContent?.trim()).toContain('Reconnecting');
  });

  test('each state sets the matching data attribute', () => {
    for (const state of ['connected', 'connecting', 'disconnected', 'error'] as const) {
      const { container } = render(ConnectionIndicator, { state });
      expect(container.querySelector('[role="status"]')?.getAttribute('data-cinder-state')).toBe(
        state,
      );
    }
  });
});
