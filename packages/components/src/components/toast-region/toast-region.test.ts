/// <reference lib="dom" />
import { join } from 'node:path';

import { afterEach, describe, expect, jest, test } from 'bun:test';

import { _resetEscapeStack, pushEscapeHandler } from '../../_internal/overlay.ts';
import type { ToastApi } from '../../_internal/toast-context.ts';
import { setupHappyDom } from '../../test/happy-dom.ts';
import { expectNoLeakedTimers, trackTimers } from '../../test/lifecycle.ts';

setupHappyDom();

const { cleanup, render, waitFor } = await import('@testing-library/svelte');
const { fireEvent } = await import('@testing-library/dom');
const { createRawSnippet, tick } = await import('svelte');
const { default: Wrapper } = await import('../../test/fixtures/toast-fixture.svelte');

const TOAST_REGION_SOURCE = join(import.meta.dir, 'toast-region.svelte');
const REPOSITORY_ROOT = join(import.meta.dir, '../../../../../');
// Resolve Svelte's server index from this process so the SSR subprocess works
// regardless of where `node_modules` lives — in a git worktree it is hoisted to
// the monorepo root, so a `process.cwd()`-relative path would not find it.
const SVELTE_SERVER_ENTRY = new URL(
  './src/index-server.js',
  import.meta.resolve('svelte/package.json'),
).href;

let mockedPerformanceNow = 0;

function useDeterministicTimers(now = 0): void {
  mockedPerformanceNow = now;
  jest.useFakeTimers({ now });
  jest.spyOn(performance, 'now').mockImplementation(() => mockedPerformanceNow);
}

async function advanceDeterministicTimers(milliseconds: number): Promise<void> {
  mockedPerformanceNow += milliseconds;
  jest.advanceTimersByTime(milliseconds);
  await tick();
}

function createDeferred<T>(): {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T | PromiseLike<T>) => void;
} {
  let resolveDeferred: (value: T | PromiseLike<T>) => void = () => {};
  let rejectDeferred: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((resolve, reject) => {
    resolveDeferred = resolve;
    rejectDeferred = reject;
  });
  return { promise, reject: rejectDeferred, resolve: resolveDeferred };
}

afterEach(() => {
  cleanup();
  if (jest.isFakeTimers()) {
    jest.useRealTimers();
  }
  jest.restoreAllMocks();
  _resetEscapeStack();
  // Clean up any toast region nodes left in the body between tests.
  document.body.innerHTML = '';
});

describe('ToastRegion structure', () => {
  test('omits live-region DOM on the server', () => {
    const script = `
      import { rm, writeFile } from 'node:fs/promises';
      import { dirname, join } from 'node:path';
      import { pathToFileURL } from 'node:url';
      import { compile } from 'svelte/compiler';
      const sourcePath = ${JSON.stringify(TOAST_REGION_SOURCE)};
      const source = await Bun.file(sourcePath).text();
      const compiled = compile(source, { filename: sourcePath, generate: 'server', css: 'external', dev: false });
      const serverSvelteEntry = ${JSON.stringify(SVELTE_SERVER_ENTRY)};
      const serverCode = compiled.js.code.replaceAll("from 'svelte';", \`from \${JSON.stringify(serverSvelteEntry)};\`);
      const file = join(dirname(sourcePath), \`.cinder-ssr-test-\${process.pid}-\${Date.now()}.mjs\`);
      await writeFile(file, serverCode, 'utf-8');
      try {
        const { createRawSnippet } = await import('svelte');
        const { render } = await import('svelte/server');
        const module = await import(pathToFileURL(file).href);
        const children = createRawSnippet(() => ({
          render: () => '<span data-ssr-child>SSR child</span>',
        }));
        process.stdout.write(render(module.default, { props: { children } }).body);
      } finally {
        await rm(file, { force: true });
      }
    `;
    const result = Bun.spawnSync({
      cmd: ['bun', '-e', script],
      cwd: REPOSITORY_ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const stderr = new TextDecoder().decode(result.stderr);
    const ssrHtml = new TextDecoder().decode(result.stdout);

    expect(result.exitCode, stderr).toBe(0);
    expect(ssrHtml).toContain('data-ssr-child');
    expect(ssrHtml).toContain('SSR child');
    expect(ssrHtml).not.toContain('role="status"');
    expect(ssrHtml).not.toContain('role="alert"');
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

  test('keeps stack metadata scoped to individual live-region channels', async () => {
    const { container } = render(Wrapper, {});
    await waitFor(() => {
      const region = container.querySelector('.cinder-toast-region');
      const assertive = container.querySelector('[role="alert"]');
      expect(region).not.toBeNull();
      expect(region?.hasAttribute('data-cinder-stack')).toBe(false);
      expect(assertive?.getAttribute('data-cinder-stack')).toBe('assertive');
    });
  });
});

describe('useToast api', () => {
  test('stamps the selected viewport position', async () => {
    const { container } = render(Wrapper, { position: 'top-center' });
    await waitFor(() => {
      expect(
        container.querySelector('.cinder-toast-region')?.getAttribute('data-cinder-position'),
      ).toBe('top-center');
    });
  });

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

  test('pre-hydration toast calls are side-effect free', async () => {
    let api: ToastApi | null = null;
    const earlyRejectingPromise = Promise.reject(new Error('pre-hydration rejection'));
    const { container } = render(Wrapper, {
      onInitialize: (initialApi: ToastApi) => {
        initialApi.show('Too early', { duration: 1 });
        initialApi.promise(earlyRejectingPromise, {
          loading: 'Loading too early',
          success: 'Resolved too early',
          error: 'Failed too early',
        });
      },
      onReady: (readyApi: ToastApi) => {
        api = readyApi;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    await tick();

    expect(container.textContent).not.toContain('Too early');
    expect(container.textContent).not.toContain('Loading too early');
    expect(container.textContent).not.toContain('Resolved too early');

    api!.show('After hydration', { duration: 0 });
    await waitFor(() => {
      expect(container.textContent).toContain('After hydration');
    });
  });

  test('warning variant routes to the polite region', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    api!.show('Watch out', { variant: 'warning' });
    await waitFor(() => {
      const polite = container.querySelector('[role="status"]');
      expect(polite?.textContent).toContain('Watch out');
      const assertive = container.querySelector('[role="alert"]');
      expect(assertive?.textContent).not.toContain('Watch out');
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
      const politeText = container.querySelector('[role="status"]')?.textContent ?? '';
      expect(politeText).toContain('Info');
      expect(politeText).toContain('Warning');
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
    const firstToast = await waitFor(() => {
      const element = container.querySelector<HTMLElement>('[data-cinder-toast-id="dup"]');
      expect(element).not.toBeNull();
      expect(element?.textContent).toContain('First');
      return element!;
    });
    api!.show('Second', { id: 'dup', duration: 0 });
    await waitFor(() => {
      const matches = container.querySelectorAll('[data-cinder-toast-id="dup"]');
      expect(matches.length).toBe(1);
      expect(matches[0]?.textContent).toContain('Second');
      expect(matches[0]).not.toBe(firstToast);
    });
  });

  test('same-id replacement moves a toast across live-region channels', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    api!.show('Working', { id: 'shared', variant: 'info', duration: 0 });
    api!.show('Failed', { id: 'shared', variant: 'danger', duration: 0 });
    await waitFor(() => {
      expect(container.querySelector('[role="status"]')?.textContent ?? '').not.toContain(
        'Working',
      );
      expect(container.querySelector('[role="alert"]')?.textContent).toContain('Failed');
      expect(container.querySelectorAll('[data-cinder-toast-id="shared"]').length).toBe(1);
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

  test('maxStack overflow is scoped to the overflowing live-region channel', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      maxStack: 2,
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    api!.show('Danger A', { variant: 'danger', duration: 0 });
    api!.show('Info A', { duration: 0 });
    api!.show('Info B', { duration: 0 });
    api!.show('Info C', { duration: 0 });
    await waitFor(() => {
      const politeText = container.querySelector('[role="status"]')?.textContent ?? '';
      const assertiveText = container.querySelector('[role="alert"]')?.textContent ?? '';
      expect(politeText).not.toContain('Info A');
      expect(politeText).toContain('Info B');
      expect(politeText).toContain('Info C');
      expect(assertiveText).toContain('Danger A');
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

  test('renders the icon in the polite region for warning variants', async () => {
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
      const polite = container.querySelector('[role="status"]');
      const iconWrapper = polite?.querySelector('.cinder-toast__icon');
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

  test('promise replaces loading with success and keeps the polite route', async () => {
    let api: ToastApi | null = null;
    const tracked = createDeferred<string>();
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    api!.promise(tracked.promise, {
      id: 'save',
      loading: 'Saving',
      success: (value) => `Saved ${value}`,
      error: 'Failed',
      duration: 0,
    });
    await waitFor(() => {
      expect(container.querySelector('[role="status"]')?.textContent).toContain('Saving');
      expect(container.querySelector('[data-cinder-pending="true"]')).not.toBeNull();
      expect(container.querySelector('[data-cinder-pending="true"] [role="status"]')).toBeNull();
      expect(container.querySelector('.cinder-toast__spinner')?.getAttribute('aria-hidden')).toBe(
        'true',
      );
    });
    const loadingToast = container.querySelector<HTMLElement>('[data-cinder-toast-id="save"]');
    expect(loadingToast).not.toBeNull();
    tracked.resolve('draft');
    await waitFor(() => {
      expect(container.querySelector('[role="status"]')?.textContent).toContain('Saved draft');
      expect(container.querySelector('[data-cinder-pending="true"]')).toBeNull();
      expect(container.querySelector('[data-cinder-toast-id="save"]')).not.toBe(loadingToast);
    });
  });

  test('promise rejection moves from polite loading to assertive danger', async () => {
    let api: ToastApi | null = null;
    const tracked = createDeferred<string>();
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    api!.promise(tracked.promise, {
      id: 'save',
      loading: 'Saving',
      success: 'Saved',
      error: (error) => (error instanceof Error ? error.message : 'Failed'),
      duration: 0,
    });
    await waitFor(() => {
      expect(container.querySelector('[role="status"]')?.textContent).toContain('Saving');
      expect(container.querySelector('[role="alert"]')?.textContent ?? '').not.toContain('Saving');
      expect(container.querySelector('[data-cinder-pending="true"]')).not.toBeNull();
    });
    tracked.reject(new Error('Nope'));
    await waitFor(() => {
      expect(container.querySelector('[role="status"]')?.textContent ?? '').not.toContain('Saving');
      expect(container.querySelector('[role="alert"]')?.textContent).toContain('Nope');
      expect(container.querySelector('[data-cinder-pending="true"]')).toBeNull();
    });
  });

  test('dismissing a pending promise prevents late settlement from resurrecting it', async () => {
    useDeterministicTimers();
    let api: ToastApi | null = null;
    const tracked = createDeferred<string>();
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    const id = api!.promise(tracked.promise, {
      loading: 'Saving',
      success: 'Saved',
      error: 'Failed',
      duration: 0,
    });
    await tick();
    api!.dismiss(id);
    tracked.resolve('late');
    await tick();
    expect(container.textContent).not.toContain('Saved');
    await advanceDeterministicTimers(220);
    expect(container.querySelector('.cinder-toast')).toBeNull();
  });

  test('unmounting the region prevents late promise settlement timers', async () => {
    useDeterministicTimers();
    let api: ToastApi | null = null;
    const tracked = createDeferred<string>();
    const { container, unmount } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    api!.promise(tracked.promise, {
      loading: 'Saving',
      success: 'Saved',
      error: 'Failed',
      duration: 100,
    });
    await waitFor(() => expect(container.textContent).toContain('Saving'));

    unmount();
    expect(jest.getTimerCount()).toBe(0);
    tracked.resolve('done');
    await tick();

    expect(jest.getTimerCount()).toBe(0);
    expect(document.body.textContent ?? '').not.toContain('Saved');
  });

  // Real-timer counterpart to the deterministic leak test above: tracks the
  // global setTimeout/setInterval table directly (no fake timers) so a toast
  // that schedules an auto-dismiss timer must clear it on unmount.
  test('unmounting the region leaves no real auto-dismiss timer pending', async () => {
    const timers = trackTimers();
    try {
      let api: ToastApi | null = null;
      const { unmount } = render(Wrapper, {
        onReady: (a: ToastApi) => {
          api = a;
        },
      });
      await waitFor(() => expect(api).not.toBeNull());
      api!.show('Heads up', { duration: 10_000 });
      await tick();

      unmount();
      await tick();
      expectNoLeakedTimers(timers.active());
    } finally {
      timers.release();
    }
  });

  test('action fires once and dismisses by default even when not otherwise dismissible', async () => {
    let api: ToastApi | null = null;
    let actionCount = 0;
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    api!.show('Undoable', {
      duration: 0,
      dismissible: false,
      action: {
        label: 'Undo',
        onAction: () => {
          actionCount += 1;
        },
      },
    });
    const action = await waitFor(() => {
      const button = container.querySelector<HTMLButtonElement>('.cinder-toast__action');
      expect(button).not.toBeNull();
      return button!;
    });
    action.click();
    expect(actionCount).toBe(1);
    await waitFor(() => {
      expect(container.querySelector('.cinder-toast')).toBeNull();
    });
  });

  test('action cannot fire again while the toast is leaving', async () => {
    let api: ToastApi | null = null;
    let actionCount = 0;
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    api!.show('Undoable', {
      duration: 0,
      action: {
        label: 'Undo',
        onAction: () => {
          actionCount += 1;
        },
      },
    });
    const action = await waitFor(() => {
      const button = container.querySelector<HTMLButtonElement>('.cinder-toast__action');
      expect(button).not.toBeNull();
      return button!;
    });
    action.click();
    action.click();
    await tick();

    expect(actionCount).toBe(1);
    expect(action.disabled).toBe(true);
  });

  test('keepOpen action remains visible after firing', async () => {
    let api: ToastApi | null = null;
    let actionCount = 0;
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    api!.show('Pause sync', {
      duration: 0,
      action: {
        label: 'Pause',
        keepOpen: true,
        onAction: () => {
          actionCount += 1;
        },
      },
    });
    const action = await waitFor(() => {
      const button = container.querySelector<HTMLButtonElement>('.cinder-toast__action');
      expect(button).not.toBeNull();
      return button!;
    });
    action.click();
    expect(actionCount).toBe(1);
    expect(container.querySelector('.cinder-toast')?.textContent).toContain('Pause sync');
  });

  test('Escape dismisses a focused dismissible toast and does not bubble', async () => {
    useDeterministicTimers();
    let api: ToastApi | null = null;
    let bubbled = false;
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    container.addEventListener('keydown', () => {
      bubbled = true;
    });
    await waitFor(() => expect(api).not.toBeNull());
    api!.show('Keyboard', { duration: 0 });
    const dismissButton = await waitFor(() => {
      const button = container.querySelector<HTMLButtonElement>('.cinder-toast__dismiss');
      expect(button).not.toBeNull();
      return button!;
    });
    dismissButton.focus();
    await fireEvent.keyDown(dismissButton, { key: 'Escape' });
    expect(bubbled).toBe(false);
    await advanceDeterministicTimers(220);
    expect(container.querySelector('.cinder-toast')).toBeNull();
  });

  test('dismissing a focused toast moves focus to the next toast control', async () => {
    useDeterministicTimers();
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    api!.show('First', { duration: 0 });
    api!.show('Second', { duration: 0 });
    const dismissButtons = await waitFor(() => {
      const buttons = [...container.querySelectorAll<HTMLButtonElement>('.cinder-toast__dismiss')];
      expect(buttons.length).toBe(2);
      return buttons;
    });

    dismissButtons[0]!.focus();
    await fireEvent.keyDown(dismissButtons[0]!, { key: 'Escape' });
    await tick();

    expect(document.activeElement).toBe(dismissButtons[1]!);
    await advanceDeterministicTimers(220);
    expect(container.textContent).not.toContain('First');
    expect(container.textContent).toContain('Second');
  });

  test('programmatic dismiss does not move focus to another toast', async () => {
    useDeterministicTimers();
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    const firstId = api!.show('First', { duration: 0 });
    api!.show('Second', { duration: 0 });
    const dismissButtons = await waitFor(() => {
      const buttons = [...container.querySelectorAll<HTMLButtonElement>('.cinder-toast__dismiss')];
      expect(buttons.length).toBe(2);
      return buttons;
    });

    dismissButtons[0]!.focus();
    api!.dismiss(firstId);
    await tick();

    expect(document.activeElement).not.toBe(dismissButtons[1]!);
    await advanceDeterministicTimers(220);
    expect(container.textContent).not.toContain('First');
    expect(container.textContent).toContain('Second');
  });

  test('dismissing the last focused toast returns focus to the previous outside control', async () => {
    useDeterministicTimers();
    let api: ToastApi | null = null;
    const outsideButton = document.createElement('button');
    outsideButton.textContent = 'Outside';
    document.body.append(outsideButton);
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    outsideButton.focus();
    api!.show('Final toast', { duration: 0 });
    const dismissButton = await waitFor(() => {
      const button = container.querySelector<HTMLButtonElement>('.cinder-toast__dismiss');
      expect(button).not.toBeNull();
      return button!;
    });

    await fireEvent.focusIn(dismissButton, { relatedTarget: outsideButton });
    dismissButton.focus();
    await fireEvent.keyDown(dismissButton, { key: 'Escape' });
    await tick();

    expect(document.activeElement).toBe(outsideButton);
    await advanceDeterministicTimers(220);
    expect(container.textContent).not.toContain('Final toast');
  });

  test('Escape on a non-dismissible toast bubbles and does not dismiss', async () => {
    let api: ToastApi | null = null;
    let bubbled = false;
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    container.addEventListener('keydown', () => {
      bubbled = true;
    });
    await waitFor(() => expect(api).not.toBeNull());
    api!.show('Sticky', { duration: 0, dismissible: false });
    const toast = await waitFor(() => {
      const element = container.querySelector<HTMLElement>('.cinder-toast');
      expect(element).not.toBeNull();
      return element!;
    });
    await fireEvent.keyDown(toast, { key: 'Escape' });
    expect(bubbled).toBe(true);
    expect(container.querySelector('.cinder-toast')?.textContent).toContain('Sticky');
  });

  test('focused toast owns Escape ahead of parent overlay handlers', async () => {
    useDeterministicTimers();
    let api: ToastApi | null = null;
    let parentOverlayEscapes = 0;
    pushEscapeHandler(() => {
      parentOverlayEscapes += 1;
    });
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    api!.show('Nested toast', { duration: 0 });
    const dismissButton = await waitFor(() => {
      const button = container.querySelector<HTMLButtonElement>('.cinder-toast__dismiss');
      expect(button).not.toBeNull();
      return button!;
    });

    dismissButton.focus();
    await fireEvent.focusIn(dismissButton);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await tick();

    expect(parentOverlayEscapes).toBe(0);
    await advanceDeterministicTimers(220);
    expect(container.textContent).not.toContain('Nested toast');
  });

  test('pointer swipe past threshold dismisses the toast', async () => {
    useDeterministicTimers();
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    api!.show('Swipe me', { duration: 0 });
    const toast = await waitFor(() => {
      const element = container.querySelector<HTMLElement>('.cinder-toast');
      expect(element).not.toBeNull();
      return element!;
    });
    await fireEvent.pointerDown(toast, { pointerId: 1, clientX: 0 });
    await fireEvent.pointerMove(toast, { pointerId: 1, clientX: 96 });
    expect(toast.getAttribute('style')).toContain('--cinder-toast-swipe-x: 96px');
    expect(toast.dataset['cinderSwiping']).toBe('true');
    await fireEvent.pointerUp(toast, { pointerId: 1, clientX: 96 });
    await advanceDeterministicTimers(220);
    expect(container.querySelector('.cinder-toast')).toBeNull();
  });

  test('pointer swipe below threshold resets without dismissing', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    api!.show('Keep me', { duration: 0 });
    const toast = await waitFor(() => {
      const element = container.querySelector<HTMLElement>('.cinder-toast');
      expect(element).not.toBeNull();
      return element!;
    });

    await fireEvent.pointerDown(toast, { pointerId: 1, clientX: 0 });
    await fireEvent.pointerMove(toast, { pointerId: 1, clientX: 40 });
    expect(toast.getAttribute('style')).toContain('--cinder-toast-swipe-x: 40px');
    expect(toast.dataset['cinderSwiping']).toBe('true');
    await fireEvent.pointerUp(toast, { pointerId: 1, clientX: 40 });
    await tick();

    expect(container.querySelector('.cinder-toast')?.textContent).toContain('Keep me');
    expect(container.querySelector<HTMLElement>('.cinder-toast')?.getAttribute('style')).toBeNull();
    expect(
      container.querySelector<HTMLElement>('.cinder-toast')?.dataset['cinderSwiping'],
    ).toBeUndefined();
  });

  test('pointer cancel resets swipe state without dismissing', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    api!.show('Cancel keeps me', { duration: 0 });
    const toast = await waitFor(() => {
      const element = container.querySelector<HTMLElement>('.cinder-toast');
      expect(element).not.toBeNull();
      return element!;
    });

    await fireEvent.pointerDown(toast, { pointerId: 1, clientX: 0 });
    await fireEvent.pointerMove(toast, { pointerId: 1, clientX: 96 });
    expect(toast.getAttribute('style')).toContain('--cinder-toast-swipe-x: 96px');
    expect(toast.dataset['cinderSwiping']).toBe('true');
    await fireEvent.pointerCancel(toast, { pointerId: 1 });
    await tick();

    expect(container.querySelector('.cinder-toast')?.textContent).toContain('Cancel keeps me');
    expect(container.querySelector<HTMLElement>('.cinder-toast')?.getAttribute('style')).toBeNull();
    expect(
      container.querySelector<HTMLElement>('.cinder-toast')?.dataset['cinderSwiping'],
    ).toBeUndefined();
  });

  test('hover pauses auto-dismiss until the pointer leaves', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    useDeterministicTimers();
    api!.show('Paused', { duration: 40 });
    await tick();
    const region = container.querySelector<HTMLElement>('.cinder-toast-region')!;
    await fireEvent.pointerEnter(region);
    await advanceDeterministicTimers(70);
    expect(container.querySelector('.cinder-toast')?.textContent).toContain('Paused');
    await fireEvent.pointerLeave(region);
    await advanceDeterministicTimers(39);
    expect(container.querySelector('.cinder-toast')?.textContent).toContain('Paused');
    await advanceDeterministicTimers(1);
    await advanceDeterministicTimers(220);
    expect(container.textContent).not.toContain('Paused');
  });

  test('focus inside the region pauses auto-dismiss until focus leaves', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      onReady: (a: ToastApi) => {
        api = a;
      },
    });
    await waitFor(() => expect(api).not.toBeNull());
    useDeterministicTimers();
    api!.show('Focused', { duration: 40 });
    await tick();
    const dismissButton = container.querySelector<HTMLButtonElement>('.cinder-toast__dismiss')!;

    dismissButton.focus();
    await fireEvent.focusIn(dismissButton);
    await advanceDeterministicTimers(80);
    expect(container.querySelector('.cinder-toast')?.textContent).toContain('Focused');

    await fireEvent.focusOut(dismissButton, { relatedTarget: document.body });
    await advanceDeterministicTimers(40);
    await advanceDeterministicTimers(220);
    expect(container.textContent).not.toContain('Focused');
  });

  test('toast DOM lookups are scoped to each ToastRegion instance', async () => {
    let firstApi: ToastApi | null = null;
    let secondApi: ToastApi | null = null;
    const first = render(Wrapper, {
      onReady: (api: ToastApi) => {
        firstApi = api;
      },
    });
    const second = render(Wrapper, {
      onReady: (api: ToastApi) => {
        secondApi = api;
      },
    });
    await waitFor(() => {
      expect(firstApi).not.toBeNull();
      expect(secondApi).not.toBeNull();
    });

    firstApi!.show('First region', { id: 'shared-id', duration: 0 });
    secondApi!.show('Second region', { id: 'shared-id', duration: 0 });
    await waitFor(() => {
      expect(first.container.textContent).toContain('First region');
      expect(second.container.textContent).toContain('Second region');
    });

    secondApi!.dismiss('shared-id');
    await waitFor(() => {
      expect(first.container.textContent).toContain('First region');
      expect(second.container.textContent).not.toContain('Second region');
    });
  });
});

describe('toast dismiss button label', () => {
  test('dismiss button aria-label includes the toast message', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      props: {
        onReady: (a: ToastApi) => {
          api = a;
        },
      },
    });
    await waitFor(() => expect(api).not.toBeNull());

    api!.show('File saved', { dismissible: true, duration: 0 });
    await waitFor(() => {
      const dismissButton = container.querySelector('.cinder-toast__dismiss');
      expect(dismissButton).not.toBeNull();
      expect(dismissButton?.getAttribute('aria-label')).toBe('Dismiss: File saved');
    });
  });

  test('stacked toasts each have a distinct dismiss aria-label', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      props: {
        onReady: (a: ToastApi) => {
          api = a;
        },
      },
    });
    await waitFor(() => expect(api).not.toBeNull());

    api!.show('File saved', { dismissible: true, duration: 0, id: 'msg-1' });
    api!.show('Upload failed', { dismissible: true, duration: 0, id: 'msg-2', variant: 'danger' });

    await waitFor(() => {
      const buttons = Array.from(container.querySelectorAll('.cinder-toast__dismiss'));
      expect(buttons.length).toBeGreaterThanOrEqual(2);
      const labels = buttons.map((b) => b.getAttribute('aria-label'));
      expect(labels).toContain('Dismiss: File saved');
      expect(labels).toContain('Dismiss: Upload failed');
    });
  });

  test('dismiss button aria-label is bounded for a long message (the full text is in the live region)', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      props: {
        onReady: (a: ToastApi) => {
          api = a;
        },
      },
    });
    await waitFor(() => expect(api).not.toBeNull());

    const longMessage =
      'Upload failed because the connection to the server was interrupted partway through the transfer; please retry.';
    api!.show(longMessage, { dismissible: true, duration: 0, variant: 'danger' });

    await waitFor(() => {
      const dismissButton = container.querySelector('.cinder-toast__dismiss');
      expect(dismissButton).not.toBeNull();
      const label = dismissButton?.getAttribute('aria-label') ?? '';
      // Bounded: not the entire message dumped into the control name.
      expect(label.length).toBeLessThan(longMessage.length);
      expect(label).toStartWith('Dismiss: ');
      expect(label).toEndWith('…');
    });
  });

  test('dismiss button aria-label falls back to a generic label for an empty/whitespace message', async () => {
    // A blank message would otherwise yield a dangling "Dismiss: " — a
    // low-quality control name for assistive tech.
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      props: {
        onReady: (a: ToastApi) => {
          api = a;
        },
      },
    });
    await waitFor(() => expect(api).not.toBeNull());

    api!.show('   ', { dismissible: true, duration: 0 });
    await waitFor(() => {
      const dismissButton = container.querySelector('.cinder-toast__dismiss');
      expect(dismissButton).not.toBeNull();
      expect(dismissButton?.getAttribute('aria-label')).toBe('Dismiss notification');
    });
  });
});

describe('toast variant icons', () => {
  test('info toast renders default icon when showIcon=true', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      props: {
        onReady: (a: ToastApi) => {
          api = a;
        },
      },
    });
    await waitFor(() => expect(api).not.toBeNull());

    api!.show('Information message', { variant: 'info', duration: 0, showIcon: true });
    await waitFor(() => {
      const toastIcon = container.querySelector('.cinder-toast__icon');
      expect(toastIcon).not.toBeNull();
    });
  });

  test('showIcon=false suppresses the default icon', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      props: {
        onReady: (a: ToastApi) => {
          api = a;
        },
      },
    });
    await waitFor(() => expect(api).not.toBeNull());

    api!.show('No icon', { variant: 'info', duration: 0, showIcon: false });
    await waitFor(() => {
      expect(container.querySelector('.cinder-toast__icon')).toBeNull();
    });
  });

  test('success toast renders its distinct checkmark icon when showIcon=true', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      props: {
        onReady: (a: ToastApi) => {
          api = a;
        },
      },
    });
    await waitFor(() => expect(api).not.toBeNull());

    api!.show('Saved', { variant: 'success', duration: 0, showIcon: true });
    await waitFor(() => {
      const iconWrapper = container.querySelector('.cinder-toast__icon');
      expect(iconWrapper).not.toBeNull();
      // Success branch: fill-rule="evenodd" path contains the checkmark shape.
      const svg = iconWrapper?.querySelector('svg');
      expect(svg).not.toBeNull();
      const path = svg?.querySelector('path');
      // The success path includes the clip-rule="evenodd" checkmark.
      expect(path?.getAttribute('d')).toContain('3.857-9.809');
    });
  });

  test('warning toast renders its distinct triangle icon when showIcon=true', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      props: {
        onReady: (a: ToastApi) => {
          api = a;
        },
      },
    });
    await waitFor(() => expect(api).not.toBeNull());

    api!.show('Caution', { variant: 'warning', duration: 0, showIcon: true });
    await waitFor(() => {
      const polite = container.querySelector('[role="status"]');
      const iconWrapper = polite?.querySelector('.cinder-toast__icon');
      expect(iconWrapper).not.toBeNull();
      const svg = iconWrapper?.querySelector('svg');
      expect(svg).not.toBeNull();
      const path = svg?.querySelector('path');
      // The warning path contains the triangle/exclamation shape.
      expect(path?.getAttribute('d')).toContain('8.485 2.495');
    });
  });

  test('danger toast renders its distinct X-circle icon when showIcon=true', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      props: {
        onReady: (a: ToastApi) => {
          api = a;
        },
      },
    });
    await waitFor(() => expect(api).not.toBeNull());

    api!.show('Error', { variant: 'danger', duration: 0, showIcon: true });
    await waitFor(() => {
      const assertive = container.querySelector('[role="alert"]');
      const iconWrapper = assertive?.querySelector('.cinder-toast__icon');
      expect(iconWrapper).not.toBeNull();
      const svg = iconWrapper?.querySelector('svg');
      expect(svg).not.toBeNull();
      const path = svg?.querySelector('path');
      // The danger path contains the X-circle shape with 8.28 7.22 coords.
      expect(path?.getAttribute('d')).toContain('8.28 7.22');
    });
  });

  test('showIcon=false suppresses the variant icon for success', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      props: {
        onReady: (a: ToastApi) => {
          api = a;
        },
      },
    });
    await waitFor(() => expect(api).not.toBeNull());

    api!.show('Saved silently', { variant: 'success', duration: 0, showIcon: false });
    await waitFor(() => {
      expect(container.querySelector('[role="status"]')?.textContent).toContain('Saved silently');
    });
    expect(container.querySelector('.cinder-toast__icon')).toBeNull();
  });

  test('consumer icon prop overrides default icon regardless of showIcon', async () => {
    let api: ToastApi | null = null;
    const { container } = render(Wrapper, {
      props: {
        onReady: (a: ToastApi) => {
          api = a;
        },
      },
    });
    await waitFor(() => expect(api).not.toBeNull());

    const customIcon = createRawSnippet(() => ({
      render: () => `<span data-testid="custom-icon">★</span>`,
    }));

    api!.show('Custom icon', { variant: 'info', duration: 0, icon: customIcon });
    await waitFor(() => {
      const customEl = container.querySelector('[data-testid="custom-icon"]');
      expect(customEl).not.toBeNull();
    });
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
