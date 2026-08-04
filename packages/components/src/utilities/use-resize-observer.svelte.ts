/**
 * Creates an attachment that observes the element with ResizeObserver.
 *
 * `box` is captured for each attachment instance. If the caller needs a
 * different value, create a new attachment instance so a new observer is
 * created.
 */
export function useResizeObserver(
  onResize: import('./use-resize-observer.types.ts').ResizeCallback,
  options: import('./use-resize-observer.types.ts').UseResizeObserverOptions = {},
): import('./use-resize-observer.types.ts').ResizeObserverAttachment {
  const { box, enabled = () => true } = options;

  return (node: HTMLElement) => {
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

      const ResizeObserverConstructor =
        typeof document !== 'undefined' && node.ownerDocument === document
          ? globalThis.ResizeObserver
          : node.ownerDocument.defaultView?.ResizeObserver;
      if (!ResizeObserverConstructor) {
        disconnectObserver();
        return;
      }

      observer = new ResizeObserverConstructor((entries) => {
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
