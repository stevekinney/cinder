import type { Attachment } from 'svelte/attachments';

export type IntersectionCallback = (entry: IntersectionObserverEntry) => void;

export type UseIntersectionOptions = {
  /** Static root element. If null/undefined, observes against the viewport. */
  root?: Element | Document | null;
  /** CSS margin string captured when the attachment mounts. Defaults to "0px". */
  rootMargin?: string;
  /** Threshold(s) captured when the attachment mounts. Defaults to 0. */
  threshold?: number | number[];
  /** Getter for whether observation is enabled. Defaults to `() => true`. */
  enabled?: () => boolean;
};

/**
 * Creates an attachment that observes the element with IntersectionObserver.
 *
 * `root`, `rootMargin`, and `threshold` are captured for each attachment
 * instance. If the caller needs different values, create a new attachment
 * instance so a new observer is created.
 */
export function useIntersection(
  onIntersect: IntersectionCallback,
  options: UseIntersectionOptions = {},
): Attachment<HTMLElement> {
  const { root = null, rootMargin = '0px', threshold = 0, enabled = () => true } = options;

  return (node: HTMLElement) => {
    if (typeof IntersectionObserver === 'undefined') {
      return () => {};
    }

    let observer: IntersectionObserver | null = null;

    const disconnectObserver = () => {
      observer?.disconnect();
      observer = null;
    };

    $effect(() => {
      if (!enabled()) {
        disconnectObserver();
        return;
      }

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            onIntersect(entry);
          }
        },
        {
          root,
          rootMargin,
          threshold,
        },
      );

      observer.observe(node);

      return () => {
        disconnectObserver();
      };
    });

    return () => {
      disconnectObserver();
    };
  };
}
