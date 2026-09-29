/**
 * Query/mutation wiring for the Reviews surface (Track D, plan §4, §9.5).
 * Bridges `getClient()`'s `HttpClient` + the frozen `queryKeys.reviews.list`
 * (`src/lib/query.ts`) into TanStack's Svelte 5 reactive query API.
 * Option getters track changing component state and query effects share
 * the calling component's lifetime.
 */
import type {
  HttpClient,
  ReviewListEntry,
  ReviewStatus,
  SubmitReviewOptions,
} from '@lostgradient/weft';

import {
  createMutation,
  createQuery,
  useQueryClient,
  type CreateMutationResult,
  type CreateQueryResult,
} from '@tanstack/svelte-query';

import { queryKeys } from '../../lib/query.ts';

/**
 * Reactive `reviews.list({status})` query. `status` is read via a getter so
 * the caller can pass a `$derived`/plain field and have the query re-key
 * itself when the active tab changes. TanStack tracks the option getter;
 * this factory runs once during component initialization.
 */
export function reviewListQuery(
  client: HttpClient,
  status: () => ReviewStatus,
): CreateQueryResult<ReviewListEntry[]> {
  return createQuery(() => ({
    queryKey: queryKeys.reviews.list({ status: status() }),
    queryFn: () => client.listReviews({ status: status() }),
  }));
}

export interface SubmitReviewDecisionVariables {
  readonly reviewId: string;
  readonly options: SubmitReviewOptions;
}

/**
 * Mutation for `POST /v1/reviews/:reviewId/decision`. On success, invalidates
 * BOTH status buckets — a decision moves a review from the `pending` list to
 * the `completed` one, so both queries are stale regardless of which tab the
 * operator submitted from.
 *
 * `SubmitReviewOptions.sectionDecisions` is included in every submission this
 * module builds (`review-decision-form.svelte` populates it). Round-trips as
 * of `@lostgradient/weft@0.12.0`
 * (https://github.com/stevekinney/weft/issues/724, fixed upstream #731) —
 * before that, `submitReviewDecisionOperation` silently dropped the field
 * server-side for both transports. Sending the full, documented
 * `SubmitReviewOptions` shape here was never a workaround, so nothing in
 * this module changed when the fix landed.
 */
export function submitReviewDecisionMutation(
  client: HttpClient,
): CreateMutationResult<void, Error, SubmitReviewDecisionVariables> {
  const queryClient = useQueryClient();

  return createMutation(() => ({
    mutationFn: ({ reviewId, options }: SubmitReviewDecisionVariables) =>
      client.submitReview(reviewId, options),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reviews.list({ status: 'pending' }),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.reviews.list({ status: 'completed' }),
      });
    },
  }));
}
