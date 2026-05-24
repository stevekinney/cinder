<script lang="ts" module>
  /**
   * @cinder
   * @category navigation
   * @status beta
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

  import { classNames } from '../../utilities/class-names.ts';
  import { useIntersection } from '../../utilities/use-intersection.svelte.ts';

  let {
    onLoadMore = async () => {},
    onError,
    hasMore = $bindable(true),
    loading = $bindable(false),
    rootMargin = '200px 0px',
    buttonLabel = 'Load more',
    retryLabel = 'Retry loading',
    endOfListMessage = 'End of list',
    maxRetries = 5,
    class: customClassName,
  }: LoadMoreProps = $props();

  let requestInFlight = $state(false);
  let errorState = $state(false);
  let retryCount = $state(0);
  let previousHasMore = $state(hasMore);
  let statusText = $state('');

  const mergedClassName = $derived(classNames('cinder-load-more', customClassName));
  const busy = $derived(loading || requestInFlight);
  const sentinelEnabled = $derived(
    hasMore && !loading && !errorState && !requestInFlight && retryCount < maxRetries,
  );
  const sentinelIntersection = $derived(
    useIntersection(handleIntersect, {
      rootMargin,
      enabled: () => sentinelEnabled,
    }),
  );
  const buttonText = $derived(errorState ? retryLabel : buttonLabel);
  const buttonDisabled = $derived(busy && !errorState);

  $effect(() => {
    if (previousHasMore && !hasMore) {
      statusText = endOfListMessage;
    } else if (!previousHasMore && hasMore) {
      statusText = '';
      retryCount = 0;
      errorState = false;
    }

    previousHasMore = hasMore;
  });

  async function requestNextPage(source: 'button' | 'sentinel'): Promise<void> {
    if (!hasMore || loading || requestInFlight) {
      return;
    }

    if (source === 'sentinel' && (errorState || retryCount >= maxRetries)) {
      return;
    }

    if (source === 'sentinel') {
      retryCount += 1;
    }

    requestInFlight = true;
    errorState = false;

    try {
      await onLoadMore();
      if (source === 'button') {
        retryCount = 0;
      }
      if (!loading) {
        requestInFlight = false;
      }
    } catch (error) {
      requestInFlight = false;
      errorState = true;
      onError?.(error);
    }
  }

  function handleIntersect(entry: IntersectionObserverEntry): void {
    if (!entry.isIntersecting) return;
    void requestNextPage('sentinel');
  }

  $effect(() => {
    if (!loading) {
      requestInFlight = false;
    }
  });
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
      onclick={() => void requestNextPage('button')}
    >
      <span>{buttonText}</span>
      {#if busy}
        <span class="cinder-load-more__spinner" aria-hidden="true"></span>
      {/if}
    </button>
  {/if}

  <div role="status" aria-live="polite" aria-atomic="true" class="cinder-sr-only">
    {statusText}
  </div>
</div>
