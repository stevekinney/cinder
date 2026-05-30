import type { Attachment } from 'svelte/attachments';

/**
 * Locks body scroll while the element is mounted.
 * Useful for modals, sheets, and other overlays.
 *
 * @example
 * ```svelte
 * <div {@attach bodyScrollLock}>Modal content</div>
 * ```
 */
export const bodyScrollLock: Attachment<HTMLElement> = () => {
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  return () => {
    document.body.style.overflow = previousOverflow;
  };
};

export type ClickOutsideOptions = {
  /** Callback when clicking outside the element */
  handler: () => void;
  /** Whether the attachment is enabled — accepts a getter to stay reactive (default: true) */
  enabled?: boolean | (() => boolean);
};

/**
 * Creates a click-outside attachment that calls a handler when clicking outside the element.
 * Useful for closing dropdowns, menus, and popovers.
 *
 * @example
 * ```svelte
 * <div {@attach createClickOutside({ handler: () => isOpen = false, enabled: () => isOpen })}>
 *   Dropdown content
 * </div>
 * ```
 */
export function createClickOutside(options: ClickOutsideOptions): Attachment<HTMLElement> {
  const { handler, enabled = true } = options;

  return (node: HTMLElement) => {
    function handleClick(event: MouseEvent) {
      const isEnabled = typeof enabled === 'function' ? enabled() : enabled;
      if (!isEnabled) return;
      const target = event.target;
      // A non-Node (or null) target is treated as outside the node.
      const isInside = target instanceof Node && node.contains(target);
      if (!isInside) {
        handler();
      }
    }

    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  };
}

/**
 * Marks scroll containers that have more content below the visible area.
 * Intended for overlay bodies that show a bottom mask fade while scrollable.
 */
export function overflowFade(): Attachment<HTMLElement> {
  return (node) => {
    if (typeof ResizeObserver === 'undefined') {
      node.removeAttribute('data-cinder-overflows');
      return;
    }

    const update = () => {
      const overflows = node.scrollHeight - node.clientHeight > 1;
      const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
      node.toggleAttribute('data-cinder-overflows', overflows && !atBottom);
    };

    const requestFrame =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()));
    const cancelFrame =
      typeof cancelAnimationFrame === 'function'
        ? cancelAnimationFrame
        : (handle: number) => window.clearTimeout(handle);

    let frame = 0;
    const scheduleUpdate = () => {
      if (frame) return;
      frame = requestFrame(() => {
        frame = 0;
        update();
      });
    };

    const resizeObserver = new ResizeObserver(scheduleUpdate);
    const observedElements = new Set<Element>();
    const observeElement = (element: Element) => {
      if (observedElements.has(element)) return;
      resizeObserver.observe(element);
      observedElements.add(element);
    };
    const syncObservedElements = () => {
      const currentElements = new Set<Element>([node, ...node.querySelectorAll('*')]);
      for (const element of observedElements) {
        if (!currentElements.has(element)) {
          resizeObserver.unobserve(element);
          observedElements.delete(element);
        }
      }
      for (const element of currentElements) {
        observeElement(element);
      }
    };

    syncObservedElements();

    const mutationObserver =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(() => {
            syncObservedElements();
            scheduleUpdate();
          });

    mutationObserver?.observe(node, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['hidden', 'class', 'style', 'aria-hidden'],
    });

    node.addEventListener('scroll', scheduleUpdate, { passive: true });
    update();

    return () => {
      if (frame) cancelFrame(frame);
      resizeObserver.disconnect();
      observedElements.clear();
      mutationObserver?.disconnect();
      node.removeEventListener('scroll', scheduleUpdate);
    };
  };
}
