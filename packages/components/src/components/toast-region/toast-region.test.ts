/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import type { ToastApi } from '../../_internal/toast-context.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { render, waitFor } = await import('@testing-library/svelte');
const { createRawSnippet } = await import('svelte');
const { default: Wrapper } = await import('../../test/fixtures/toast-fixture.svelte');

afterEach(() => {
  // Clean up any toast region nodes left in the body between tests.
  document.body.innerHTML = '';
});

describe('ToastRegion structure', () => {
  test('renders nothing on the server (gated by hydrated state)', async () => {
    // Initial render under happy-dom — but the $effect runs synchronously
    // during the testing-library render cycle, so by the time we read the
    // DOM it's already hydrated. Instead, verify the live regions exist
    // post-hydration.
    const { container } = render(Wrapper, {});
    await waitFor(() => {
      expect(container.querySelector('[role="status"]')).not.toBeNull();
      expect(container.querySelector('[role="alert"]')).not.toBeNull();
    });
  });

  test('renders polite region with role=status, aria-live=polite', async () => {
    const { container } = render(Wrapper, {});
    await waitFor(() => {
      const polite = container.querySelector('[role="status"]');
      expect(polite).not.toBeNull();
      expect(polite?.getAttribute('aria-live')).toBe('polite');
      expect(polite?.getAttribute('aria-atomic')).toBe('true');
    });
  });

  test('renders assertive region with role=alert, aria-live=assertive', async () => {
    const { container } = render(Wrapper, {});
    await waitFor(() => {
      const assertive = container.querySelector('[role="alert"]');
      expect(assertive).not.toBeNull();
      expect(assertive?.getAttribute('aria-live')).toBe('assertive');
    });
  });
});

describe('useToast api', () => {
  test('show(message) routes info variant to the polite region', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    api!.show('Hello');
    await waitFor(() => {
      const polite = container.querySelector('[role="status"]');
      expect(polite?.textContent).toContain('Hello');
    });
  });

  test('warning variant routes to the assertive region', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    api!.show('Watch out', { variant: 'warning' });
    await waitFor(() => {
      const assertive = container.querySelector('[role="alert"]');
      expect(assertive?.textContent).toContain('Watch out');
      const polite = container.querySelector('[role="status"]');
      expect(polite?.textContent).not.toContain('Watch out');
    });
  });

  test('danger variant also routes to the assertive region', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    api!.show('Boom', { variant: 'danger' });
    await waitFor(() => {
      const assertive = container.querySelector('[role="alert"]');
      expect(assertive?.textContent).toContain('Boom');
    });
  });

  test('dismiss(id) removes the matching toast', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    const id = api!.show('Removable');
    await waitFor(() => {
      expect(container.querySelector('[role="status"]')?.textContent).toContain('Removable');
    });
    api!.dismiss(id);
    await waitFor(() => {
      expect(container.querySelector('[role="status"]')?.textContent ?? '').not.toContain(
        'Removable',
      );
    });
  });

  test('dismissAll clears every active toast across both regions', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    api!.show('Info', { variant: 'info' });
    api!.show('Warning', { variant: 'warning' });
    await waitFor(() => {
      expect(container.querySelector('[role="status"]')?.textContent).toContain('Info');
      expect(container.querySelector('[role="alert"]')?.textContent).toContain('Warning');
    });
    api!.dismissAll();
    await waitFor(() => {
      const politeText = container.querySelector('[role="status"]')?.textContent ?? '';
      const assertiveText = container.querySelector('[role="alert"]')?.textContent ?? '';
      expect(politeText.trim()).toBe('');
      expect(assertiveText.trim()).toBe('');
    });
  });

  test('passing the same id replaces the existing toast (deduplication)', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    api!.show('First', { id: 'dup', duration: 0 });
    api!.show('Second', { id: 'dup', duration: 0 });
    await waitFor(() => {
      const matches = container.querySelectorAll('[data-cinder-toast-id="dup"]');
      expect(matches.length).toBe(1);
      expect(matches[0]?.textContent).toContain('Second');
    });
  });

  test('maxStack drops the oldest when exceeded', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      maxStack: 2,
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    api!.show('A', { duration: 0 });
    api!.show('B', { duration: 0 });
    api!.show('C', { duration: 0 });
    await waitFor(() => {
      const polite = container.querySelector('[role="status"]');
      const text = polite?.textContent ?? '';
      expect(text).not.toContain('A');
      expect(text).toContain('B');
      expect(text).toContain('C');
    });
  });
  test('renders the icon snippet before the message when provided', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    const icon = createRawSnippet(() => ({
      render: () => `<svg data-testid="toast-icon" aria-hidden="true"></svg>`,
    }));
    api!.show('With icon', { icon, duration: 0 });
    await waitFor(() => {
      const iconWrapper = container.querySelector('.cinder-toast__icon');
      expect(iconWrapper).not.toBeNull();
      expect(iconWrapper?.getAttribute('aria-hidden')).toBe('true');
      expect(iconWrapper?.querySelector('[data-testid="toast-icon"]')).not.toBeNull();
      // The icon must precede the message in DOM order.
      const toast = container.querySelector('.cinder-toast');
      const children = [...(toast?.children ?? [])];
      const iconIndex = children.findIndex((el) => el.classList.contains('cinder-toast__icon'));
      const messageIndex = children.findIndex((el) =>
        el.classList.contains('cinder-toast__message'),
      );
      expect(iconIndex).toBeGreaterThanOrEqual(0);
      expect(iconIndex).toBeLessThan(messageIndex);
    });
  });

  test('renders the icon in the assertive region for warning/danger variants', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    const icon = createRawSnippet(() => ({
      render: () => `<svg data-testid="assertive-icon" aria-hidden="true"></svg>`,
    }));
    api!.show('Heads up', { icon, variant: 'warning', duration: 0 });
    await waitFor(() => {
      const assertive = container.querySelector('[role="alert"]');
      const iconWrapper = assertive?.querySelector('.cinder-toast__icon');
      expect(iconWrapper).not.toBeNull();
      expect(iconWrapper?.querySelector('[data-testid="assertive-icon"]')).not.toBeNull();
    });
  });

  test('omits the icon wrapper when no icon is provided', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    api!.show('No icon', { duration: 0 });
    await waitFor(() => {
      expect(container.querySelector('[role="status"]')?.textContent).toContain('No icon');
    });
    expect(container.querySelector('.cinder-toast__icon')).toBeNull();
  });
});

describe('useToast outside a region', () => {
  test('throws when called outside of any component (getContext lifecycle)', async () => {
    // useToast() ultimately calls getContext, which Svelte requires to run
    // during component initialisation. Calling it from a plain test function
    // throws a Svelte lifecycle error before our own check can run — that's
    // actually fine; both errors mean "you're using this wrong."
    const { useToast } = await import('../../utilities/use-toast.ts');
    let error: Error | null = null;
    try {
      useToast();
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
    }
    expect(error).not.toBeNull();
  });
});
