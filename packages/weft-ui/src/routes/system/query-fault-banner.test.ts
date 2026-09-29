/**
 * Component tests for `<QueryFaultBanner>` (plan §10.4). Covers a
 * representative slice of the six treatments plus the retry affordance —
 * full per-code coverage already lives in `fault-boundary.test.ts`
 * (Foundation); this file proves this component reads `error` through the
 * same `faultTreatment` classification and renders the shared banner
 * classes.
 */
import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import { HttpClientError } from '@lostgradient/weft';

import QueryFaultBanner from './query-fault-banner.svelte';

describe('QueryFaultBanner', () => {
  test('renders the not-found treatment with a neutral tone', async () => {
    const error = new HttpClientError(404, 'Workflow wf_missing not found.');
    const { container, getByText } = render(QueryFaultBanner, { props: { error } });

    expect(getByText('Not found')).not.toBeNull();
    expect(getByText('Workflow wf_missing not found.')).not.toBeNull();
    expect(container.querySelector('[data-tone="neutral"]')).not.toBeNull();
  });

  test('renders the unauthorized treatment with a danger tone', async () => {
    const error = new HttpClientError(403, 'Requires system:admin.', { faultCode: 'Forbidden' });
    const { container, getByText } = render(QueryFaultBanner, { props: { error } });

    expect(getByText('Not authorized')).not.toBeNull();
    expect(container.querySelector('[data-tone="danger"]')).not.toBeNull();
  });

  test('shows a Retry button and calls onRetry when clicked', async () => {
    let retried = 0;
    const error = new HttpClientError(500, 'boom');
    const { getByRole } = render(QueryFaultBanner, {
      props: { error, onRetry: () => (retried += 1) },
    });

    await fireEvent.click(getByRole('button', { name: 'Retry' }));
    expect(retried).toBe(1);
  });

  test('omits the Retry button when onRetry is not provided', async () => {
    const error = new HttpClientError(500, 'boom');
    const { queryByRole } = render(QueryFaultBanner, { props: { error } });
    expect(queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  test('an unclassifiable error falls back to the internal treatment', async () => {
    const { getByText } = render(QueryFaultBanner, { props: { error: new Error('network down') } });
    expect(getByText('Something went wrong')).not.toBeNull();
  });
});
