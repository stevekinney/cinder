<script lang="ts">
  /**
   * Test-only harness mounting `ReviewsInbox` under the Svelte context it
   * needs at runtime (`HttpClient` via `provideClient()`, a `PrincipalStore`
   * via `providePrincipalStore()`) — mirrors
   * `reviews-test-harness.test-harness.svelte`'s pattern but for the inbox
   * component directly, so a test can pass fake query stores without
   * booting a real `QueryClient`/`HttpClient` round trip. Never imported by
   * production code.
   */
  import { onDestroy, untrack } from 'svelte';

  import type { ReviewListEntry, HttpClient } from '@lostgradient/weft';

  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';

  import { provideFleetEventSource } from '../../app/engine-status.svelte.ts';
  import { provideClient } from '../../lib/client.ts';
  import { FleetEventSource } from '../../lib/live-source/index.ts';
  import { providePrincipalStore, type AuthorizationScope } from '../../lib/scopes.svelte.ts';
  import ReviewsInbox from './reviews-inbox.svelte';
  import type { ReviewDecisionSubmission } from './review-decision-form.svelte';
  import type { ReviewQuery } from './review-domain.ts';

  interface ReviewsInboxTestHarnessProps {
    client: HttpClient;
    scopes?: readonly AuthorizationScope[];
    pendingQuery: ReviewQuery<ReviewListEntry[]>;
    completedQuery: ReviewQuery<ReviewListEntry[]>;
    submitting?: boolean;
    onSubmit?: (reviewId: string, submission: ReviewDecisionSubmission) => void;
  }

  let {
    client,
    scopes = ['reviews:read', 'events:read'],
    pendingQuery,
    completedQuery,
    submitting = false,
    onSubmit = () => {},
  }: ReviewsInboxTestHarnessProps = $props();

  provideClient(untrack(() => client));
  const principalStore = providePrincipalStore();
  principalStore.setPrincipal({ scopes: untrack(() => scopes), unauthenticatedAccess: null });

  // `getFleetEventSource()` (the inbox Live toggle) needs a real provided
  // instance — same pattern as `schedules-test-harness.test-harness.svelte`,
  // pointed at the SAME server the `client` prop uses.
  const fleetSource = untrack(
    () => new FleetEventSource({ baseUrl: client.baseUrl, headers: client.headers }),
  );
  provideFleetEventSource(fleetSource);
  onDestroy(() => fleetSource.close());

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
</script>

<QueryClientProvider client={queryClient}>
  <ReviewsInbox {pendingQuery} {completedQuery} {submitting} {onSubmit} />
</QueryClientProvider>
