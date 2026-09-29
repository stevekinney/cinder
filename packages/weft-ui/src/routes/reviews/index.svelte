<script lang="ts">
  /**
   * Reviews route root (plan §9.5). Owns the `reviews:read` scope gate (plan
   * §6: "lock-state section (EmptyState + lock icon + scope name) for
   * unviewable panels") and the top-level Inbox/Archive switch
   * (`design/Weft UI.dc.html`'s `revViewBtns`). Builds the two review
   * list queries and the decision mutation once here and hands them down —
   * `ReviewsInbox`'s "Decided" state and `ReviewsArchive` both read the same
   * `completed` query, so TanStack Query dedupes the network request.
   *
   * `submitReviewDecisionOperation` is `access: { kind: 'public' }` (no
   * scope required to SUBMIT a decision — verified against
   * `weft/src/server/operations/submit-review-decision.ts`), so only the
   * list query is scope-gated here; the decision form itself is never
   * disabled for a missing scope.
   */
  import { EmptyState, Segment, SegmentedControl } from '@lostgradient/cinder';
  import Lock from 'lucide-svelte/icons/lock';

  import { getClient } from '../../lib/client.ts';
  import { getPrincipalStore, isForbidden, scopeReason } from '../../lib/scopes.svelte.ts';
  import type { ReviewDecisionSubmission } from './review-decision-form.svelte';
  import { reviewListQuery, submitReviewDecisionMutation } from './reviews-data.ts';
  import ReviewsArchive from './reviews-archive.svelte';
  import ReviewsInbox from './reviews-inbox.svelte';

  const client = getClient();
  const principalStore = getPrincipalStore();

  const pendingQuery = reviewListQuery(client, () => 'pending');
  const completedQuery = reviewListQuery(client, () => 'completed');
  const decisionMutation = submitReviewDecisionMutation(client);

  $effect(() => {
    if (isForbidden(pendingQuery.error) || isForbidden(completedQuery.error)) {
      principalStore.denyScope('reviews:read');
    }
  });

  const locked = $derived(!principalStore.hasScope('reviews:read'));

  let view = $state<'inbox' | 'archive'>('inbox');

  function submitDecision(reviewId: string, submission: ReviewDecisionSubmission): void {
    decisionMutation.mutate({
      reviewId,
      options: {
        decision: submission.decision,
        reviewer: submission.reviewer,
        ...(submission.feedback !== undefined ? { feedback: submission.feedback } : {}),
        ...(submission.sectionDecisions !== undefined
          ? { sectionDecisions: submission.sectionDecisions }
          : {}),
      },
    });
  }
</script>

<div class="weft-reviews-route">
  <div class="weft-reviews-route__header">
    <h1 class="weft-reviews-route__title">Reviews</h1>
    {#if !locked}
      <SegmentedControl
        id="reviews-view"
        selectionMode="single"
        label="View"
        labelVisible={false}
        value={view}
        onValueChange={(value) => (view = value as 'inbox' | 'archive')}
      >
        <Segment value="inbox">Inbox</Segment>
        <Segment value="archive">Archive</Segment>
      </SegmentedControl>
    {/if}
  </div>

  {#if locked}
    <EmptyState title="Reviews are locked" description={scopeReason('reviews:read')}>
      {#snippet icon()}
        <Lock size={28} aria-hidden="true" />
      {/snippet}
    </EmptyState>
  {:else if view === 'inbox'}
    <ReviewsInbox
      {pendingQuery}
      {completedQuery}
      submitting={decisionMutation.isPending}
      onSubmit={submitDecision}
    />
  {:else}
    <ReviewsArchive {completedQuery} />
  {/if}
</div>
