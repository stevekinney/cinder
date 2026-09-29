<script lang="ts">
  /**
   * Reviews dashboard card (plan §9.5: "Dashboard card: fill
   * `src/routes/reviews/cards/dashboard-card.svelte` (pending count +
   * nearest deadline)"; card-slot contract `src/routes/dashboard/cards.ts`).
   * Self-contained and zero-prop — every card in the registry is, since
   * `DashboardCardEntry.component: Component` carries no prop generics —
   * so this builds its own scoped `reviews.list({status:'pending'})` query
   * rather than receiving one from the dashboard route.
   */
  import { Card, EmptyState, Skeleton, Statistic } from '@lostgradient/cinder';

  import { getClient } from '../../../lib/client.ts';
  import { faultTreatment } from '../../../lib/faults.ts';
  import { router } from '../../../lib/router.svelte.ts';
  import { getPrincipalStore, scopeReason } from '../../../lib/scopes.svelte.ts';
  import { reviewListQuery } from '../reviews-data.ts';
  import { formatReviewCountdown, pendingEntriesOnly, reviewDeadline } from '../review-domain.ts';

  const client = getClient();
  const principalStore = getPrincipalStore();
  const locked = $derived(!principalStore.hasScope('reviews:read'));

  const query = reviewListQuery(client, () => 'pending');

  const pending = $derived(pendingEntriesOnly(query.data ?? []));
  const now = $state(Date.now());

  const nearestDeadline = $derived.by(() => {
    let nearest: number | null = null;
    for (const entry of pending) {
      if (entry.timeout === undefined) continue;
      const deadline = reviewDeadline(entry, now);
      if (nearest === null || deadline.remainingMs < nearest) nearest = deadline.remainingMs;
    }
    return nearest;
  });

  function onCardClick(event: MouseEvent): void {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    router.navigate('/reviews');
  }
</script>

<a
  href={router.href('/reviews')}
  onclick={onCardClick}
  class="weft-reviews-card-link"
  aria-label="Reviews"
>
  <Card padding="none" class="weft-dashboard-card">
    {#snippet header()}
      <span class="weft-dashboard-card__title">Reviews</span>
    {/snippet}

    {#if locked}
      <EmptyState title="Locked" description={scopeReason('reviews:read')} headingLevel={4} />
    {:else if query.isPending}
      <div
        class="weft-reviews-card__skeleton"
        role="status"
        aria-busy="true"
        aria-label="Loading reviews"
      >
        <Skeleton height="3rem" />
      </div>
    {:else if query.isError}
      <p class="weft-reviews-card__error">{faultTreatment(query.error).message}</p>
    {:else}
      <div class="weft-reviews-card__stats">
        <Statistic label="Pending" value={pending.length} />
        <Statistic
          label="Nearest deadline"
          value={nearestDeadline === null
            ? '—'
            : formatReviewCountdown({
                hasDeadline: true,
                remainingMs: nearestDeadline,
                isTimedOut: nearestDeadline <= 0,
                isUrgent: false,
              })}
        />
      </div>
    {/if}
  </Card>
</a>
