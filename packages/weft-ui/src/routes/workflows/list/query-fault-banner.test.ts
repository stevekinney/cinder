import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import { HttpClientError } from '@lostgradient/weft';

import QueryFaultBanner from './query-fault-banner.svelte';

describe('QueryFaultBanner', () => {
  test('renders the treatment title and message for a classified fault', async () => {
    const error = new HttpClientError(404, 'Workflow not found', { faultCode: 'NotFound' });
    const { getByText } = render(QueryFaultBanner, { props: { error, onRetry: () => {} } });

    expect(getByText('Not found')).not.toBeNull();
    expect(getByText('Workflow not found')).not.toBeNull();
  });

  test('falls back to the unknown treatment for a non-wire error', async () => {
    const { getByText } = render(QueryFaultBanner, {
      props: { error: new Error('offline'), onRetry: () => {} },
    });

    expect(getByText('Something went wrong')).not.toBeNull();
  });

  test('Retry calls onRetry', async () => {
    let retried = false;
    const error = new HttpClientError(500, 'boom');
    const { getByRole } = render(QueryFaultBanner, {
      props: {
        error,
        onRetry: () => {
          retried = true;
        },
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Retry' }));
    expect(retried).toBe(true);
  });
});
