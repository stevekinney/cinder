/**
 * Human-review demo fixtures (plan §11, Appendix B "Review inbox + decision
 * (partial sections) / completed / timeout-expired / archive"). Adds a
 * pending sectioned/partial review, a completed review decided with a
 * partial (mixed) section outcome, and a pending review with a
 * short-relative-to-normal timeout. `fixtures/workflows.ts`'s existing
 * `review-gate` already covers the plain (non-partial, effectively
 * unbounded) pending case; this file rounds out the set. See
 * `fixtures/workflows.ts` for the append-only contract this file
 * participates in.
 */
import { workflow, type SubmitReviewOptions, type WorkflowHandle } from '@lostgradient/weft';

interface ContentReviewInput {
  documentTitle: string;
  headline: string;
  body: string;
  callToAction: string;
  allowPartial: boolean;
  timeoutMs: number;
}

export const contentReview = workflow({ name: 'content-review' }).execute(async function* (
  ctx,
  input: ContentReviewInput,
) {
  const decision = yield* ctx.review({
    artifact: {
      documentTitle: input.documentTitle,
      sections: {
        headline: input.headline,
        body: input.body,
        callToAction: input.callToAction,
      },
    },
    reviewType: 'content',
    reviewers: ['ops@example.com'],
    allowPartial: input.allowPartial,
    timeout: input.timeoutMs,
  });
  return { decision };
});

/** Registerable workflow map — merged into `fixtures/workflows.ts`'s registry. */
export const reviewWorkflows = {
  'content-review': contentReview,
};

/** Narrow structural interface — see `fixtures/workflows.ts` for the pattern. */
export interface ReviewsEngine {
  start(
    name: 'content-review',
    input: ContentReviewInput,
    options?: { defer?: boolean },
  ): Promise<WorkflowHandle>;
  listReviews(filter: { workflowId: string }): Promise<Array<{ reviewId: string }>>;
  submitReview(reviewId: string, options: SubmitReviewOptions): Promise<void>;
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
// A "near timeout" review can't backdate its `createdAt` — nearness to a
// real review timeout is inherently wall-clock-relative on a live server.
// 20 minutes is short relative to the 24h "plenty of time" pending review
// above, so it reads as "close to expiring" for a normal dev session,
// without being so short that it risks expiring (and disappearing from the
// pending list — see weft's `handleReviewEscalationTimer`) before anyone
// looks at it.
const NEAR_TIMEOUT_MS = 20 * 60 * 1000;

const REVIEW_PERSISTENCE_POLL_ATTEMPTS = 5;
const REVIEW_PERSISTENCE_POLL_DELAY_MS = 20;

/**
 * `ctx.review()` yields the review-request operation as soon as the
 * generator is driven — even with `{ defer: false }` — but the engine's
 * processing of that yielded operation (persisting the review record) is an
 * async storage write that is not guaranteed to have landed by the time
 * `start()` resolves; `defer: false` only guarantees the generator started
 * running, not that the engine finished handling its first operation. This
 * polls `listReviews` for the record to appear (condition-based, not a fixed
 * sleep), capped at 5 attempts.
 */
async function waitForPendingReview(
  engine: ReviewsEngine,
  workflowId: string,
): Promise<{ reviewId: string }> {
  for (let attempt = 1; attempt <= REVIEW_PERSISTENCE_POLL_ATTEMPTS; attempt++) {
    const [pendingReview] = await engine.listReviews({ workflowId });
    if (pendingReview !== undefined) {
      return pendingReview;
    }
    if (attempt < REVIEW_PERSISTENCE_POLL_ATTEMPTS) {
      await Bun.sleep(REVIEW_PERSISTENCE_POLL_DELAY_MS);
    }
  }
  throw new Error(
    `seedReviews: expected a pending review for workflow ${workflowId} within ` +
      `${REVIEW_PERSISTENCE_POLL_ATTEMPTS} attempts — got none`,
  );
}

/**
 * Seeds three review specimens: one pending sectioned/partial review, one
 * completed with a partial (mixed approve/reject) section decision, and one
 * pending review with a comparatively short timeout. The completed run is
 * awaited so its terminal state is durably committed before the dev server
 * starts serving; the two pending runs are deliberately left undecided.
 */
export async function seedReviews(engine: ReviewsEngine): Promise<void> {
  await engine.start(
    'content-review',
    {
      documentTitle: 'Q3 landing page copy',
      headline: 'Ship durable workflows without the ceremony',
      body: 'Weft keeps your workflow state, retries, and history in one place.',
      callToAction: 'Start building',
      allowPartial: true,
      timeoutMs: TWENTY_FOUR_HOURS_MS,
    },
    { defer: false },
  );

  const completedHandle = await engine.start(
    'content-review',
    {
      documentTitle: 'Autumn promo banner copy',
      headline: 'Cozy season, faster releases',
      body: 'Get 20% off annual plans through October.',
      callToAction: 'Claim your discount',
      allowPartial: true,
      timeoutMs: TWENTY_FOUR_HOURS_MS,
    },
    { defer: false },
  );
  const pendingCompletedReview = await waitForPendingReview(engine, completedHandle.id);
  await engine.submitReview(pendingCompletedReview.reviewId, {
    decision: 'needs-changes',
    reviewer: 'ops@example.com',
    feedback: 'Tighten the call to action; headline and body read well.',
    sectionDecisions: { headline: 'approved', body: 'approved', callToAction: 'rejected' },
    workflowId: completedHandle.id,
  });
  await completedHandle.result();

  await engine.start(
    'content-review',
    {
      documentTitle: 'Incident postmortem summary',
      headline: 'Database failover took 4 minutes longer than budgeted',
      body: 'Root cause: stale connection pool health check.',
      callToAction: 'Approve for publication',
      allowPartial: false,
      timeoutMs: NEAR_TIMEOUT_MS,
    },
    { defer: false },
  );
}
