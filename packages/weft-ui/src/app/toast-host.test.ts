/**
 * Component tests for `<ToastHost>` and its module-level `showToast`/
 * `showFault` API (plan §10.4, §11.2, T1.5). Run with `--conditions browser
 * --conditions svelte` (repo-wide `bun run test`) — see `tests/setup.ts`.
 *
 * `toastApi` is intentionally app-wide module state (module doc in
 * `toast-host.svelte`), not per-render-call state — the global
 * `afterEach(cleanup)` registered in `tests/setup.ts` unmounts every
 * rendered `<ToastHost>` between tests, which runs this component's
 * attachment cleanup and resets that module state back to `undefined`, so
 * tests stay isolated from each other without doing that by hand here.
 */
import { render } from '@testing-library/svelte';
import { describe, expect, mock, test } from 'bun:test';

import { UNKNOWN_FAULT_TREATMENT } from '../lib/faults.ts';
import ToastHost, {
  FAULT_TOAST_DURATION_MS,
  FAULT_TOAST_VARIANT,
  showFault,
  showToast,
} from './toast-host.svelte';

describe('showToast — before <ToastHost> has mounted', () => {
  test('reports an error and preserves the undefined return contract', () => {
    const originalReportError = globalThis.reportError;
    const reportErrorMock = mock((_error: unknown) => {});
    globalThis.reportError = reportErrorMock;

    try {
      expect(showToast('too early')).toBeUndefined();
      expect(reportErrorMock).toHaveBeenCalledTimes(1);
      expect(reportErrorMock).toHaveBeenCalledWith(expect.any(Error));
      const [reportedError] = reportErrorMock.mock.calls[0] ?? [];
      if (!(reportedError instanceof Error)) return;
      expect(reportedError.message).toContain('showToast() called before <ToastHost> mounted');
    } finally {
      globalThis.reportError = originalReportError;
    }
  });
});

describe('showToast — after <ToastHost> has mounted', () => {
  test('renders the message into the DOM', async () => {
    const { findByText } = render(ToastHost);

    showToast('Saved your changes.');

    expect(await findByText('Saved your changes.')).not.toBeNull();
  });

  test('returns the toast id Cinder assigned', async () => {
    render(ToastHost);

    const id = showToast('has an id');

    expect(typeof id).toBe('string');
    expect(id?.length ?? 0).toBeGreaterThan(0);
  });
});

describe('showFault', () => {
  test('renders "<title>: <message>" with a warning variant for a lower-stakes treatment (not-found)', async () => {
    const { findByText } = render(ToastHost);

    showFault({ kind: 'not-found', message: 'workflow wf-1 not found' });

    expect(await findByText('Not found: workflow wf-1 not found')).not.toBeNull();
    expect(FAULT_TOAST_VARIANT['not-found']).toBe('warning');
  });

  test('renders a danger variant for internal', async () => {
    const { findByText } = render(ToastHost);

    showFault(UNKNOWN_FAULT_TREATMENT);

    expect(
      await findByText(`Something went wrong: ${UNKNOWN_FAULT_TREATMENT.message}`),
    ).not.toBeNull();
    expect(FAULT_TOAST_VARIANT[UNKNOWN_FAULT_TREATMENT.kind]).toBe('danger');
  });

  test('renders a danger variant for invalid', async () => {
    const { findByText } = render(ToastHost);

    showFault({ kind: 'invalid', message: 'name is required', fieldErrors: [] });

    expect(await findByText('Invalid input: name is required')).not.toBeNull();
    expect(FAULT_TOAST_VARIANT['invalid']).toBe('danger');
  });

  /**
   * T9.4 accessibility pass (design §C tier mapping): danger-variant faults
   * are the operator-must-act case and must persist (Cinder's `duration: 0`
   * contract — never auto-dismiss on its uniform 5s default) while the
   * lower-stakes warning kinds still auto-dismiss. Asserted against the pure
   * policy table directly rather than by waiting out real dismiss timers —
   * `showFault` passes `FAULT_TOAST_DURATION_MS[treatment.kind]` straight
   * through to `showToast`/Cinder's `ToastApi.show`, so this is the same
   * value Cinder actually receives, without a slow/flaky timer-based test.
   */
  test('every danger-variant kind persists (duration 0) and every warning-variant kind auto-dismisses', () => {
    for (const kind of Object.keys(FAULT_TOAST_VARIANT) as (keyof typeof FAULT_TOAST_VARIANT)[]) {
      if (FAULT_TOAST_VARIANT[kind] === 'danger') {
        expect(FAULT_TOAST_DURATION_MS[kind]).toBe(0);
      } else {
        expect(FAULT_TOAST_DURATION_MS[kind]).toBeGreaterThan(0);
      }
    }
  });

  test('renders inside the assertive (role=alert) live region for a danger-variant fault', async () => {
    const { findByText } = render(ToastHost);

    showFault(UNKNOWN_FAULT_TREATMENT);

    const toastText = await findByText(`Something went wrong: ${UNKNOWN_FAULT_TREATMENT.message}`);
    expect(toastText.closest('[role="alert"]')).not.toBeNull();
  });

  /**
   * `role="status"`, not `role="alert"`. Cinder's `toast-region.svelte`
   * `isPolite()` treats `info`/`success`/`warning` as the polite channel as
   * of Cinder 0.19.0 (fixed upstream:
   * https://github.com/stevekinney/cinder/issues/800 — previously `warning`
   * landed in the assertive channel alongside `danger`), matching the
   * design's warning-is-polite split for a warning-tier fault.
   */
  test('a warning-variant fault renders polite (role=status), not assertive', async () => {
    const { findByText } = render(ToastHost);

    showFault({ kind: 'not-found', message: 'workflow wf-1 not found' });

    const toastText = await findByText('Not found: workflow wf-1 not found');
    expect(toastText.closest('[role="status"]')).not.toBeNull();
    expect(toastText.closest('[role="alert"]')).toBeNull();
  });
});
