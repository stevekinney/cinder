export type LoadMoreProps = {
  /** Called when the next page should be loaded. Caller flips `loading` and `hasMore`. */
  onLoadMore?: () => void | Promise<void>;
  /** Whether more items are available. Bindable. */
  hasMore?: boolean;
  /** Whether a load is in progress. Bindable. */
  loading?: boolean;
  /** rootMargin passed to IntersectionObserver. Captured at attachment time. */
  rootMargin?: string;
  /** Visible label for the load-more button. */
  buttonLabel?: string;
  /** Visible label for the retry button after a load error. */
  retryLabel?: string;
  /** Politely announced when the end of the list is reached. */
  endOfListMessage?: string;
  /** Maximum consecutive sentinel-triggered requests before auto-loading pauses. */
  maxRetries?: number;
  /** Notified when onLoadMore throws or rejects. */
  onError?: (error: unknown) => void;
  /** Custom class merged with `.cinder-load-more`. */
  class?: string;
};
