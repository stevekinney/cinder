export type LoadMoreProps = {
  /** Called when the next page should be loaded. Caller flips `loading` and `hasMore`. */
  onloadmore?: () => void | Promise<void>;
  /** Whether more items are available. Bindable. */
  hasMore?: boolean;
  /** Whether a load is in progress. Bindable. */
  loading?: boolean;
  /**
   * Scroll container the sentinel is observed within. Pass the scrollable
   * ancestor element when the list scrolls inside a container rather than the
   * viewport. `null`/omitted observes against the viewport. Captured at
   * attachment time.
   */
  root?: Element | Document | null;
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
  /** Notified when onloadmore throws or rejects. */
  onError?: (error: unknown) => void;
  /** Custom class merged with `.cinder-load-more`. */
  class?: string;
};
