import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import type { FaultTreatment } from '../../lib/faults.ts';
import FaultBanner from './fault-banner.svelte';

describe('FaultBanner', () => {
  test('renders the treatment title and message', async () => {
    const treatment: FaultTreatment = { kind: 'not-found', message: 'Schedule not found.' };

    const { getByText } = render(FaultBanner, { props: { treatment } });

    expect(getByText('Not found')).not.toBeNull();
    expect(getByText('Schedule not found.')).not.toBeNull();
  });

  test('shows the JSON-RPC hint only for a REST-masked internal fault', async () => {
    const masked: FaultTreatment = {
      kind: 'internal',
      message: 'Something went wrong.',
      maskedByRest: true,
      tryViaJsonRpc: true,
    };

    const { getByText, queryByText, rerender } = render(FaultBanner, {
      props: { treatment: masked },
    });
    expect(getByText(/retry via JSON-RPC/)).not.toBeNull();

    await rerender({
      treatment: {
        kind: 'internal',
        message: 'Something went wrong.',
        maskedByRest: false,
        tryViaJsonRpc: false,
      },
    });
    expect(queryByText(/retry via JSON-RPC/)).toBeNull();
  });

  test('renders a Retry button only when onRetry is supplied', async () => {
    const treatment: FaultTreatment = { kind: 'not-supported', message: 'Not supported here.' };

    const { queryByRole, getByRole, rerender } = render(FaultBanner, {
      props: { treatment },
    });
    expect(queryByRole('button', { name: 'Retry' })).toBeNull();

    let retried = false;
    await rerender({ treatment, onRetry: () => (retried = true) });
    await fireEvent.click(getByRole('button', { name: 'Retry' }));
    expect(retried).toBe(true);
  });
});
