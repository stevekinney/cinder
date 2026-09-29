/**
 * Component tests for `<FaultBoundary>` (plan §10.4, §11.2, T1.5). Run with
 * `--conditions browser --conditions svelte` (repo-wide `bun run test`) —
 * see `tests/setup.ts`. Drives the boundary through a real `<svelte:boundary>`
 * via `fault-boundary.test-harness.svelte` rather than mocking it: a
 * `<svelte:boundary>` error handler is compiled Svelte template behavior,
 * not something that survives being stubbed.
 */
import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import { HttpClientError } from '@lostgradient/weft';

import type { FaultTreatment } from '../lib/faults.ts';
import FaultBoundaryHarness from './fault-boundary.test-harness.svelte';

async function renderHarness(props: {
  error: unknown;
  shouldThrow?: boolean;
  onFault?: (treatment: FaultTreatment, error: unknown) => void;
}) {
  return render(FaultBoundaryHarness, { props });
}

describe('FaultBoundary', () => {
  test('renders children normally when nothing throws', async () => {
    const { findByTestId, queryByRole } = await renderHarness({
      error: new HttpClientError(404, 'not found'),
      shouldThrow: false,
    });

    expect(await findByTestId('recovered')).not.toBeNull();
    expect(queryByRole('alert')).toBeNull();
  });

  test('not-found: shows the banner with the server message', async () => {
    const { findByRole, findByText } = await renderHarness({
      error: new HttpClientError(404, 'workflow wf-1 not found'),
    });

    const banner = await findByRole('alert');
    expect(banner.getAttribute('data-tone')).toBe('neutral');
    expect(await findByText('Not found')).not.toBeNull();
    expect(await findByText('workflow wf-1 not found')).not.toBeNull();
  });

  test('conflict: spent idempotency key shows the extra explanation', async () => {
    const error = new HttpClientError(409, 'a workflow with this id was already started', {
      faultCode: 'Conflict',
      weftCode: 'IdempotencyKeyPurgedError',
    });
    const { findByRole, findByText } = await renderHarness({ error });

    const banner = await findByRole('alert');
    expect(banner.getAttribute('data-tone')).toBe('warning');
    expect(await findByText('Conflict')).not.toBeNull();
    expect(
      await findByText(
        'This idempotency key has already been used and its run was purged — start with a new key.',
        { exact: false },
      ),
    ).not.toBeNull();
  });

  test('conflict: a plain conflict does not show the spent-key explanation', async () => {
    const error = new HttpClientError(409, 'plain conflict', { faultCode: 'Conflict' });
    const { findByRole, queryByText } = await renderHarness({ error });

    await findByRole('alert');
    expect(queryByText('This idempotency key has already been used', { exact: false })).toBeNull();
  });

  test('invalid: shows the invalid-input badge', async () => {
    const error = new HttpClientError(400, 'invalid params', { faultCode: 'InvalidParams' });
    const { findByRole, findByText } = await renderHarness({ error });

    const banner = await findByRole('alert');
    expect(banner.getAttribute('data-tone')).toBe('danger');
    expect(await findByText('Invalid input')).not.toBeNull();
  });

  test('unauthorized (401): shows the not-authorized badge with the server message', async () => {
    const error = new HttpClientError(401, 'no credential', { faultCode: 'Unauthorized' });
    const { findByRole, findByText } = await renderHarness({ error });

    const banner = await findByRole('alert');
    expect(banner.getAttribute('data-tone')).toBe('danger');
    expect(await findByText('Not authorized')).not.toBeNull();
    expect(await findByText('no credential')).not.toBeNull();
  });

  test('unauthorized (403): shows the same not-authorized badge with its own server message', async () => {
    const error = new HttpClientError(403, 'scope denied', { faultCode: 'Forbidden' });
    const { findByRole, findByText } = await renderHarness({ error });

    const banner = await findByRole('alert');
    expect(banner.getAttribute('data-tone')).toBe('danger');
    expect(await findByText('scope denied')).not.toBeNull();
  });

  test('not-supported: shows the not-supported badge', async () => {
    const error = new HttpClientError(501, 'not implemented', { faultCode: 'NotImplemented' });
    const { findByRole, findByText } = await renderHarness({ error });

    const banner = await findByRole('alert');
    expect(banner.getAttribute('data-tone')).toBe('neutral');
    expect(await findByText('Not supported')).not.toBeNull();
  });

  test('internal: REST-masked 500 shows the try-via-JSON-RPC hint', async () => {
    const error = new HttpClientError(500, 'Internal server error');
    const { findByRole, findByText } = await renderHarness({ error });

    const banner = await findByRole('alert');
    expect(banner.getAttribute('data-tone')).toBe('danger');
    expect(await findByText('Something went wrong')).not.toBeNull();
    expect(
      await findByText('The REST API hides internal error detail', { exact: false }),
    ).not.toBeNull();
  });

  test('internal: an unmasked fault (real faultCode) does not show the try-via-JSON-RPC hint', async () => {
    const error = new HttpClientError(500, 'engine failure', { faultCode: 'EngineFailure' });
    const { findByRole, queryByText } = await renderHarness({ error });

    await findByRole('alert');
    expect(queryByText('The REST API hides internal error detail', { exact: false })).toBeNull();
  });

  test('internal: a plain Error (not a wire fault) shows a collapsible stack-trace trigger', async () => {
    // Cinder's own `collapsible.test.ts` already covers click-to-open — this
    // only proves FaultBoundary wires the trigger for the right error shape.
    const error = new Error('capturePayment threw');
    error.name = 'PaymentDeclinedError';
    const { findByRole, findByText } = await renderHarness({ error });

    await findByRole('alert');
    expect(await findByText('PaymentDeclinedError')).not.toBeNull();
  });

  test("internal: an HttpClientError does NOT show a stack-trace trigger (its .stack is only client-side plumbing, never the server's)", async () => {
    const error = new HttpClientError(500, 'Internal server error');
    const { findByRole, getAllByRole } = await renderHarness({ error });

    await findByRole('alert');
    // The banner's Retry button is the only button — no Collapsible trigger
    // (which would be named after `error.name`, `'HttpClientError'`) exists.
    const buttons = getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent?.trim()).toBe('Retry');
  });

  test('onFault reports the classified treatment and the raw error exactly once, before the banner is interactive', async () => {
    const error = new HttpClientError(404, 'not found');
    const reported: Array<{ treatment: FaultTreatment; error: unknown }> = [];
    const { findByRole } = await renderHarness({
      error,
      onFault: (treatment, raisedError) => reported.push({ treatment, error: raisedError }),
    });

    await findByRole('alert');
    expect(reported).toHaveLength(1);
    expect(reported[0]?.error).toBe(error);
    expect(reported[0]?.treatment).toEqual({ kind: 'not-found', message: 'not found' });
  });

  test('Retry re-renders the children once the underlying issue is fixed', async () => {
    const error = new HttpClientError(404, 'not found');
    const { findByRole, findByTestId, rerender, queryByRole } = await renderHarness({ error });

    const banner = await findByRole('alert');
    expect(banner).not.toBeNull();

    await rerender({ error, shouldThrow: false });
    // Merely fixing the underlying condition does not recover on its own —
    // the boundary only re-renders children when `reset()` runs.
    expect(await findByRole('alert')).not.toBeNull();

    await fireEventClick(await findByRole('button', { name: 'Retry' }));

    expect(await findByTestId('recovered')).not.toBeNull();
    expect(queryByRole('alert')).toBeNull();
  });
});

async function fireEventClick(element: Element): Promise<void> {
  await fireEvent.click(element);
}
