<script lang="ts" module>
  /**
   * @cinder
   * @category navigation
   * @status stable
   * @purpose Sentinel-based infinite-scroll trigger with an always-visible button fallback and accessible status states.
   * @tag navigation
   * @tag paging
   * @useWhen Streaming results into a long list and you want the next page to load as the user approaches the end.
   * @avoidWhen The dataset is bounded and benefits from discrete jumps — use `Pagination` instead.
   * @related pagination
   */
  export type { LoadMoreProps } from './load-more.types.ts';
</script>

<script lang="ts">
  import type { LoadMoreProps } from './load-more.types.ts';
  import { untrack } from 'svelte';

  import { classNames } from '../../utilities/class-names.ts';
  import { useIntersection } from '../../utilities/use-intersection.svelte.ts';
  import VisuallyHiddenLiveRegion from '../_visually-hidden-live-region.svelte';

  let {
    onLoadMore = async () => {},
    onError,
    hasMore = $bindable(true),
    loading = $bindable(false),
    root = null,
    rootMargin = '200px 0px',
    buttonLabel = 'Load more',
    retryLabel = 'Retry loading',
    endOfListMessage = 'End of list',
    maxRetries = 5,
    class: customClassName,
  }: LoadMoreProps = $props();

  let requestInFlight = $state(false);
  let errorState = $state(false);
  let sentinelRequestCount = $state(0);
  let sentinelArmed = $state(true);
  let sentinelIntersecting = $state(false);
  let sentinelReported = $state(false);
  let manualObserverSuspended = $state(false);
  let previousSentinelEnabled = false;
  let previousMaxRetries: number | undefined;
  // Tracks the last `hasMore` value the component reconciled against so a
  // parent-driven false -> true flip (new page of data arrived) can clear the
  // sentinel request cap and error latch exactly once per transition.
  let previousHasMore = hasMore;

  const mergedClassName = $derived(classNames('cinder-load-more', customClassName));
  const busy = $derived(loading || requestInFlight);
  const sentinelEnabled = $derived(hasMore && !errorState && sentinelRequestCount < maxRetries);
  const sentinelObserverEnabled = $derived(sentinelEnabled && !manualObserverSuspended);
  // `enabled` is a getter, so `useIntersection`'s own `$effect` re-evaluates
  // `sentinelEnabled` reactively and toggles the observer in place. Constructing
  // the attachment once (rather than inside `$derived`) avoids tearing down and
  // recreating the IntersectionObserver every time `sentinelEnabled` flips.
  const sentinelIntersection = useIntersection(handleIntersect, {
    root: untrack(() => root),
    rootMargin: untrack(() => rootMargin),
    enabled: () => sentinelObserverEnabled,
  });
  const buttonText = $derived(errorState ? retryLabel : buttonLabel);
  const buttonDisabled = $derived(busy && !errorState);
  // End-of-list message is a pure function of `hasMore`; no sentinel effect needed.
  const statusText = $derived(hasMore ? '' : endOfListMessage);

  // The only remaining effect: re-arm the sentinel when the parent flips
  // `hasMore` back to true (a fresh page arrived). This is a genuine reaction to
  // a prop *transition* — not a derivable value — so the previous-value diff is
  // intentional. `statusText` (pure) is a `$derived` above; `requestInFlight` is
  // cleared in `requestNextPage`'s `finally`, so neither needs an effect.
  $effect(() => {
    if (!previousHasMore && hasMore) {
      sentinelRequestCount = 0;
      sentinelArmed = true;
      sentinelIntersecting = false;
      errorState = false;
    }
    previousHasMore = hasMore;
  });

  $effect(() => {
    if (!previousSentinelEnabled && sentinelEnabled) {
      sentinelReported = false;
      sentinelIntersecting = false;
      if (
        !manualObserverSuspended &&
        previousMaxRetries !== undefined &&
        maxRetries > previousMaxRetries
      ) {
        sentinelArmed = true;
      }
    }
    previousSentinelEnabled = sentinelEnabled;
    previousMaxRetries = maxRetries;
  });

  $effect(() => {
    requestFromSentinelIfReady();
  });

  async function requestNextPage(source: 'button' | 'sentinel'): Promise<void> {
    if (!hasMore || loading || requestInFlight) {
      return;
    }

    if (source === 'sentinel' && (errorState || sentinelRequestCount >= maxRetries)) {
      return;
    }

    if (source === 'sentinel') {
      sentinelRequestCount += 1;
    } else {
      // A manual request supersedes every entry queued by the current observer.
      // Suspending the observer makes its callback stale immediately; the
      // replacement must report off-screen before it can re-arm.
      sentinelArmed = false;
      sentinelReported = false;
      sentinelIntersecting = false;
      manualObserverSuspended = true;
    }

    requestInFlight = true;
    errorState = false;

    try {
      await onLoadMore();
      if (source === 'button') {
        sentinelRequestCount = 0;
      }
    } catch (error) {
      errorState = true;
      onError?.(error);
    } finally {
      // Always clear the in-flight guard once the request settles, regardless of
      // whether the parent has flipped its own `loading` prop yet.
      requestInFlight = false;
      if (source === 'button') {
        manualObserverSuspended = false;
      }
    }
  }

  function requestFromSentinelIfReady(): void {
    if (!sentinelReported || !sentinelIntersecting || !sentinelArmed || !sentinelEnabled || busy) {
      return;
    }

    sentinelArmed = false;
    void requestNextPage('sentinel');
  }

  function handleIntersect(entry: IntersectionObserverEntry): void {
    sentinelReported = true;
    sentinelIntersecting = entry.isIntersecting;

    if (!entry.isIntersecting) {
      sentinelArmed = true;
      return;
    }

    requestFromSentinelIfReady();
  }
</script>

<div class={mergedClassName} aria-busy={busy}>
  {#if hasMore && !errorState}
    <div aria-hidden="true" class="cinder-load-more__sentinel" {@attach sentinelIntersection}></div>
  {/if}

  {#if hasMore}
    <button
      type="button"
      class="cinder-load-more__button"
      disabled={buttonDisabled}
      aria-busy={busy}
      onclick={() => void requestNextPage('button')}
    >
      <span>{buttonText}</span>
      {#if busy}
        <span class="cinder-load-more__spinner" aria-hidden="true"></span>
      {/if}
    </button>
  {/if}

  <VisuallyHiddenLiveRegion message={statusText} />
</div>
