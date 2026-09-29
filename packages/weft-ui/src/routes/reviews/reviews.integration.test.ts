/**
 * Integration tests for the Reviews data layer against a REAL in-process
 * weft server (`src/lib/live-source/live-source-test-server.test-support.ts`
 * — no mock server, per plan §11.3). Exercises `reviews-data.ts`'s query/
 * mutation helpers with a real `HttpClient` talking to a real `Engine`
 * running `fixtures/reviews.ts`'s `content-review` workflow (already
 * registered in `fixtures/workflows.ts`'s full registry, which this test
 * harness boots).
 */
import { describe, expect, test } from 'bun:test';

import { HttpClient } from '@lostgradient/weft';

import { startLiveSourceTestServer } from '../../lib/live-source/live-source-test-server.test-support.ts';
import { completedEntriesOnly, pendingEntriesOnly } from './review-domain.ts';

const REVIEW_PERSISTENCE_POLL_ATTEMPTS = 5;
const REVIEW_PERSISTENCE_POLL_DELAY_MS = 20;

/** Mirrors `fixtures/reviews.ts`'s own `waitForPendingReview` — the review-creation write is async relative to `engine.start()` resolving (see that module's doc). */
async function waitForPendingReview(
  client: HttpClient,
  workflowId: string,
): Promise<{ reviewId: string }> {
  for (let attempt = 1; attempt <= REVIEW_PERSISTENCE_POLL_ATTEMPTS; attempt += 1) {
    const [pending] = await client.listReviews({ status: 'pending', workflowId });
    if (pending !== undefined) return pending;
    if (attempt < REVIEW_PERSISTENCE_POLL_ATTEMPTS) {
      await Bun.sleep(REVIEW_PERSISTENCE_POLL_DELAY_MS);
    }
  }
  throw new Error(`Expected a pending review for workflow ${workflowId} — got none.`);
}

describe('Reviews data layer (integration, real server)', () => {
  test('lists a pending sectioned review and moves it to completed after a decision', async () => {
    const server = await startLiveSourceTestServer();
    try {
      const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });
      const workflowId = 'reviews-integration-basic';
      const handle = await server.engine.start(
        'content-review',
        {
          documentTitle: 'Integration test copy',
          headline: 'Ship it',
          body: 'Body copy',
          callToAction: 'Go',
          allowPartial: true,
          timeoutMs: 60 * 60 * 1000,
        },
        { id: workflowId, defer: false },
      );
      expect(handle.id).toBe(workflowId);

      const pendingReview = await waitForPendingReview(client, workflowId);

      const pendingEntries = pendingEntriesOnly(await client.listReviews({ status: 'pending' }));
      const found = pendingEntries.find((entry) => entry.workflowId === workflowId);
      expect(found).toBeDefined();
      expect(found?.reviewType).toBe('content');
      expect(found?.allowPartial).toBe(true);
      expect(found?.artifact).toEqual({
        documentTitle: 'Integration test copy',
        sections: { headline: 'Ship it', body: 'Body copy', callToAction: 'Go' },
      });

      await client.submitReview(pendingReview.reviewId, {
        decision: 'needs-changes',
        reviewer: 'ops@example.com',
        feedback: 'Tighten the CTA.',
        // sectionDecisions is included on every real submission the console
        // sends (`reviews-data.ts`'s `submitReviewDecisionMutation` doc).
        sectionDecisions: { headline: 'approved', body: 'rejected' },
        workflowId,
      });

      await handle.result();

      const completedEntries = completedEntriesOnly(
        await client.listReviews({ status: 'completed' }),
      );
      const completed = completedEntries.find((entry) => entry.workflowId === workflowId);
      expect(completed).toBeDefined();
      expect(completed?.decision).toBe('needs-changes');
      expect(completed?.reviewer).toBe('ops@example.com');
      expect(completed?.feedback).toBe('Tighten the CTA.');

      // Fixed upstream in @lostgradient/weft@0.12.0
      // (github.com/stevekinney/weft/issues/724, #731):
      // `submitReviewDecisionOperation` now reads `sectionDecisions` off the
      // wire and passes it through to `engine.submitReview()`.
      expect(completed?.sectionDecisions).toEqual({ headline: 'approved', body: 'rejected' });
    } finally {
      await server.stop();
    }
  });

  test('a review not created by this test (fixtures/workflows.ts review-gate) is also visible unsectioned', async () => {
    const server = await startLiveSourceTestServer();
    try {
      const client = new HttpClient({ baseUrl: server.baseUrl, token: server.token });
      const workflowId = 'reviews-integration-unsectioned';
      await server.engine.start(
        'review-gate',
        { artifact: 'Plain-string artifact for the unsectioned case.' },
        { id: workflowId, defer: false },
      );

      const pendingReview = await waitForPendingReview(client, workflowId);
      const pendingEntries = pendingEntriesOnly(await client.listReviews({ status: 'pending' }));
      const found = pendingEntries.find((entry) => entry.reviewId === pendingReview.reviewId);
      expect(found?.artifact).toBe('Plain-string artifact for the unsectioned case.');
      expect(found?.allowPartial).toBe(false);
    } finally {
      await server.stop();
    }
  });
});
