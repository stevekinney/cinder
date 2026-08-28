/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render } = await import('@testing-library/svelte');
const { createRawSnippet } = await import('svelte');
const { default: CapabilityGate } = await import('./capability-gate.svelte');

function snippet(text: string) {
  return createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));
}

/**
 * Consumer actions snippet: a primary button wired to `onPrimary` and a
 * dismiss button wired to the gate-provided `dismiss` function.
 */
function actionsSnippet(onPrimary?: () => void) {
  return createRawSnippet<[{ dismiss: () => void }]>((getArgs) => ({
    render: () =>
      `<div><button type="button" class="test-primary">Allow access</button><a href="/settings" class="test-fallback">Go to settings</a><button type="button" class="test-dismiss">Dismiss</button></div>`,
    setup(node) {
      const primary = (node as HTMLElement).querySelector<HTMLButtonElement>('.test-primary');
      const dismiss = (node as HTMLElement).querySelector<HTMLButtonElement>('.test-dismiss');
      primary?.addEventListener('click', () => onPrimary?.());
      dismiss?.addEventListener('click', () => getArgs().dismiss());
    },
  }));
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
      'permission-limited',
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

  test('permission-limited is announced as a warning rather than an error', () => {
    const { container } = render(CapabilityGate, {
      feature: 'Notifications',
      state: 'permission-limited',
    });
    const root = container.querySelector('.cinder-capability-gate');

    expect(root?.getAttribute('data-cinder-state')).toBe('permission-limited');
    expect(root?.getAttribute('data-cinder-variant')).toBe('warning');
    expect(container.querySelector('.cinder-capability-gate__state-text')?.textContent).toBe(
      'Limited permission',
    );
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

  test('renders consumer content (buttons and links alike) in the actions row', () => {
    const { container, getByRole } = render(CapabilityGate, {
      feature: 'Microphone',
      state: 'permission-needed',
      actions: actionsSnippet(),
    });
    expect(container.querySelector('.cinder-capability-gate__actions')).not.toBeNull();
    expect(getByRole('button', { name: /Allow access/i })).not.toBeNull();
    const link = container.querySelector('a.test-fallback');
    expect(link?.getAttribute('href')).toBe('/settings');
  });

  test('renders no actions row when the actions snippet is omitted', () => {
    const { container } = render(CapabilityGate, {
      feature: 'Microphone',
      state: 'permission-needed',
    });
    expect(container.querySelector('.cinder-capability-gate__actions')).toBeNull();
  });

  test('consumer action handlers fire from inside the snippet', () => {
    let called = false;
    const { getByRole } = render(CapabilityGate, {
      feature: 'Microphone',
      state: 'permission-needed',
      actions: actionsSnippet(() => {
        called = true;
      }),
    });
    fireEvent.click(getByRole('button', { name: /Allow access/i }));
    expect(called).toBe(true);
  });

  test('the snippet-provided dismiss hides the component and calls onDismiss', () => {
    let dismissed = false;
    const { container, getByRole } = render(CapabilityGate, {
      feature: 'Offline storage',
      state: 'unavailable',
      actions: actionsSnippet(),
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

  test('re-shows the gate on rerender with a different state after being dismissed', async () => {
    const { container, getByRole, rerender } = render(CapabilityGate, {
      feature: 'Microphone',
      state: 'permission-needed',
      actions: actionsSnippet(),
    });
    fireEvent.click(getByRole('button', { name: /Dismiss/i }));
    expect(container.querySelector('.cinder-capability-gate')).toBeNull();

    // Reuse the SAME render instance via rerender() — a fresh render() call would
    // start with visible=true by default and pass vacuously without exercising
    // the re-show $effect at all.
    await rerender({ state: 'permission-denied' });

    expect(container.querySelector('.cinder-capability-gate')).not.toBeNull();
  });

  test('the snippet dismiss blurs the focused consumer control before unmounting', async () => {
    const { container } = render(CapabilityGate, {
      feature: 'Camera',
      state: 'permission-needed',
      actions: actionsSnippet(),
    });
    const dismiss = container.querySelector<HTMLButtonElement>('.test-dismiss');
    dismiss?.focus();
    expect(document.activeElement).toBe(dismiss);
    await fireEvent.click(dismiss as HTMLButtonElement);
    // Gate is gone and focus is no longer stranded on the detached button.
    expect(container.querySelector('.cinder-capability-gate')).toBeNull();
    expect(document.activeElement).not.toBe(dismiss);
  });
});
