/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { createRawSnippet } = await import('svelte');
const { default: CapabilityGate } = await import('./capability-gate.svelte');

function snippet(text: string) {
  return createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));
}

afterEach(() => {
  cleanup();
});

describe('CapabilityGate', () => {
  test('renders the feature name and status text', () => {
    const { container } = render(CapabilityGate, {
      feature: 'Microphone',
      state: 'permission-needed',
    });
    const feature = container.querySelector('.cinder-capability-gate__feature');
    const statusText = container.querySelector('.cinder-capability-gate__state-text');
    expect(feature?.textContent).toBe('Microphone');
    expect(statusText?.textContent).toBe('Permission required');
  });

  test('renders with all supported states', () => {
    const states = [
      'supported',
      'unsupported',
      'permission-needed',
      'permission-denied',
      'loading',
      'unavailable',
    ] as const;
    for (const state of states) {
      const { container } = render(CapabilityGate, { feature: 'Test', state });
      const root = container.querySelector('.cinder-capability-gate');
      expect(root?.getAttribute('data-cinder-state')).toBe(state);
      cleanup();
    }
  });

  test('sets aria-busy=true on the live status region when loading', () => {
    const { container } = render(CapabilityGate, { feature: 'Camera', state: 'loading' });
    // aria-busy lives on the role="status" live region (not the root) so the
    // loading→ready transition is announced from the same element.
    const status = container.querySelector('.cinder-capability-gate__status');
    expect(status?.getAttribute('aria-busy')).toBe('true');
  });

  test('does not set aria-busy on the status region when not loading', () => {
    const { container } = render(CapabilityGate, {
      feature: 'Camera',
      state: 'permission-needed',
    });
    const status = container.querySelector('.cinder-capability-gate__status');
    expect(status?.getAttribute('aria-busy')).toBeNull();
  });

  test('renders the primary action button when primaryAction is provided', () => {
    const { getByRole } = render(CapabilityGate, {
      feature: 'Microphone',
      state: 'permission-needed',
      primaryAction: 'Allow access',
    });
    const button = getByRole('button', { name: /Allow access/i });
    expect(button).not.toBeNull();
  });

  test('calls onPrimaryAction when primary button is clicked', () => {
    let called = false;
    const { getByRole } = render(CapabilityGate, {
      feature: 'Microphone',
      state: 'permission-needed',
      primaryAction: 'Allow access',
      onPrimaryAction: () => {
        called = true;
      },
    });
    fireEvent.click(getByRole('button', { name: /Allow access/i }));
    expect(called).toBe(true);
  });

  test('renders fallback button when fallbackAction is provided', () => {
    const { container } = render(CapabilityGate, {
      feature: 'Notifications',
      state: 'permission-denied',
      fallbackAction: 'Use email instead',
    });
    const fallback = container.querySelector('.cinder-capability-gate__fallback');
    expect(fallback?.textContent?.trim()).toBe('Use email instead');
  });

  test('renders fallback as an anchor when fallbackHref is provided', () => {
    const { container } = render(CapabilityGate, {
      feature: 'Notifications',
      state: 'permission-denied',
      fallbackHref: '/settings',
      fallbackAction: 'Go to settings',
    });
    const link = container.querySelector('a.cinder-capability-gate__fallback');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/settings');
  });

  test("dismiss button's accessible name includes the feature, matching primary/fallback", () => {
    const { container } = render(CapabilityGate, {
      feature: 'Offline storage',
      state: 'unavailable',
      dismissAction: 'Dismiss',
    });
    const dismiss = container.querySelector('.cinder-capability-gate__dismiss');
    expect(dismiss?.getAttribute('aria-label')).toBe('Dismiss for Offline storage');
  });

  test('dismiss hides the component and calls onDismiss', () => {
    let dismissed = false;
    const { container, getByRole } = render(CapabilityGate, {
      feature: 'Offline storage',
      state: 'unavailable',
      dismissAction: 'Dismiss',
      onDismiss: () => {
        dismissed = true;
      },
    });
    fireEvent.click(getByRole('button', { name: /Dismiss/i }));
    expect(dismissed).toBe(true);
    expect(container.querySelector('.cinder-capability-gate')).toBeNull();
  });

  test('renders children content', () => {
    const { container } = render(CapabilityGate, {
      feature: 'MIDI',
      state: 'unsupported',
      children: snippet('Custom content'),
    });
    const content = container.querySelector('.cinder-capability-gate__content');
    expect(content).not.toBeNull();
    expect(content?.textContent).toContain('Custom content');
  });

  test('omits the content wrapper entirely when no children are passed', () => {
    const { container } = render(CapabilityGate, {
      feature: 'MIDI',
      state: 'unsupported',
    });
    expect(container.querySelector('.cinder-capability-gate__content')).toBeNull();
  });

  test('renders with data-cinder-presentation attribute', () => {
    const { container } = render(CapabilityGate, {
      feature: 'Camera',
      state: 'supported',
      variant: 'banner',
    });
    const root = container.querySelector('.cinder-capability-gate');
    expect(root?.getAttribute('data-cinder-presentation')).toBe('banner');
  });

  test('applies data-cinder-variant based on state', () => {
    const { container } = render(CapabilityGate, {
      feature: 'Camera',
      state: 'permission-denied',
    });
    const root = container.querySelector('.cinder-capability-gate');
    expect(root?.getAttribute('data-cinder-variant')).toBe('error');
  });

  test('status region has role=status and aria-live=polite', () => {
    const { container } = render(CapabilityGate, {
      feature: 'Camera',
      state: 'permission-needed',
    });
    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.getAttribute('aria-live')).toBe('polite');
  });

  test('applies custom class', () => {
    const { container } = render(CapabilityGate, {
      feature: 'Camera',
      state: 'supported',
      class: 'my-gate',
    });
    const root = container.querySelector('.cinder-capability-gate');
    expect(root?.classList.contains('my-gate')).toBe(true);
  });

  test('an unknown runtime state falls back to "unavailable"', () => {
    const { container } = render(CapabilityGate, {
      feature: 'Camera',
      // Exercising a plain-JS invalid value (the test tsconfig is relaxed).
      state: 'totally-bogus' as never,
    });
    const root = container.querySelector('.cinder-capability-gate');
    expect(root?.getAttribute('data-cinder-state')).toBe('unavailable');
    // The raw bogus value must not leak into the visible status text.
    expect(container.querySelector('.cinder-capability-gate__state-text')?.textContent).toBe(
      'Not available',
    );
  });

  test('calls onFallbackAction when the fallback button is clicked', () => {
    const onFallbackAction = mock(() => {});
    const { getByRole } = render(CapabilityGate, {
      feature: 'Notifications',
      state: 'permission-denied',
      fallbackAction: 'Use email instead',
      onFallbackAction,
    });
    fireEvent.click(getByRole('button', { name: /Use email instead/i }));
    expect(onFallbackAction).toHaveBeenCalledTimes(1);
  });

  test('re-shows the gate on rerender with a different state after being dismissed', async () => {
    const { container, getByRole, rerender } = render(CapabilityGate, {
      feature: 'Microphone',
      state: 'permission-needed',
      dismissAction: 'Dismiss',
    });
    fireEvent.click(getByRole('button', { name: /Dismiss/i }));
    expect(container.querySelector('.cinder-capability-gate')).toBeNull();

    // Reuse the SAME render instance via rerender() — a fresh render() call would
    // start with visible=true by default and pass vacuously without exercising
    // the re-show $effect at all.
    await rerender({ state: 'permission-denied' });

    expect(container.querySelector('.cinder-capability-gate')).not.toBeNull();
  });

  test('dismissing blurs the dismiss button before unmounting', async () => {
    const { container } = render(CapabilityGate, {
      feature: 'Camera',
      state: 'permission-needed',
      dismissAction: 'Dismiss',
    });
    const dismiss = container.querySelector<HTMLButtonElement>('.cinder-capability-gate__dismiss');
    dismiss?.focus();
    expect(document.activeElement).toBe(dismiss);
    await fireEvent.click(dismiss as HTMLButtonElement);
    // Gate is gone and focus is no longer stranded on the detached button.
    expect(container.querySelector('.cinder-capability-gate')).toBeNull();
    expect(document.activeElement).not.toBe(dismiss);
  });
});
