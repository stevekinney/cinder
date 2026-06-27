import type {
  IntersectionAttachment,
  IntersectionCallback,
  UseIntersectionOptions,
} from './use-intersection.types.ts';

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
): IntersectionAttachment {
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
          if (!enabled()) {
            return;
          }

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
