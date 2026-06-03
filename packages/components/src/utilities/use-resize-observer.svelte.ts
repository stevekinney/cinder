import type { Attachment } from 'svelte/attachments';

export type ResizeCallback = (entries: ResizeObserverEntry[]) => void;

export type UseResizeObserverOptions = {
  /** Which box model to observe. Defaults to the ResizeObserver constructor default. */
  box?: ResizeObserverBoxOptions;
  /** Getter for whether observation is enabled. Defaults to `() => true`. */
  enabled?: () => boolean;
};

/**
 * Creates an attachment that observes the element with ResizeObserver.
 *
 * `box` is captured for each attachment instance. If the caller needs a
 * different value, create a new attachment instance so a new observer is
 * created.
 */
export function useResizeObserver(
  onResize: ResizeCallback,
  options: UseResizeObserverOptions = {},
): Attachment<HTMLElement> {
  const { box, enabled = () => true } = options;

  return (node: HTMLElement) => {
    if (typeof ResizeObserver === 'undefined') {
      return () => {};
    }

    let observer: ResizeObserver | null = null;

    const disconnectObserver = () => {
      observer?.disconnect();
      observer = null;
    };

    $effect(() => {
      if (!enabled()) {
        disconnectObserver();
        return;
      }

      observer = new ResizeObserver((entries) => {
        if (!enabled()) {
          return;
        }

        onResize(entries);
      });

      observer.observe(node, box !== undefined ? { box } : undefined);

      return () => {
        disconnectObserver();
      };
    });

    return () => {
      disconnectObserver();
    };
  };
}
