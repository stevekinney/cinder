/**
 * Route-level test for the Reviews `reviews:read` scope gate (plan §6, §9.5,
 * Appendix B "Workflow list … denied" pattern applied to Reviews — a lock
 * state that names the missing scope rather than hiding the surface).
 * Deliberately does not exercise the full inbox/archive data flow here —
 * `reviews.integration.test.ts` covers that against a real engine.
 */
import { render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import { HttpClient } from '@lostgradient/weft';

import ReviewsTestHarness from './reviews-test-harness.test-harness.svelte';

/** Never resolves — this test only asserts synchronous scope-derived rendering, not query settlement. */
function pendingClient(): HttpClient {
  return new HttpClient({ baseUrl: 'http://localhost' });
}

describe('Reviews route — scope gate', () => {
  test('shows a lock state naming the missing scope when reviews:read is not granted', async () => {
    const { getByText } = render(ReviewsTestHarness, {
      props: { client: pendingClient(), scopes: [] },
    });

    expect(getByText('Reviews are locked')).not.toBeNull();
    expect(getByText('Requires reviews:read')).not.toBeNull();
  });

  test('renders the Inbox/Archive switch (not the lock state) once reviews:read is granted', async () => {
    const { getByRole, queryByText } = render(ReviewsTestHarness, {
      props: { client: pendingClient(), scopes: ['reviews:read', 'events:read'] },
    });

    expect(queryByText('Reviews are locked')).toBeNull();
    expect(getByRole('radio', { name: 'Inbox' })).not.toBeNull();
    expect(getByRole('radio', { name: 'Archive' })).not.toBeNull();
  });
});
