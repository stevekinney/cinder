import type { Attachment } from 'svelte/attachments';
import { lockBodyScroll } from '../_internal/overlay.ts';

/**
 * Creates a body scroll lock attachment that participates in the shared
 * counted lock from `_internal/overlay.ts`. Nested overlays each call this;
 * the page scroll is only restored when the last attachment is torn down.
 *
 * Use this instead of a raw `overflow: hidden` assignment so that a Modal
 * opened inside a Sheet (or any combination of locking overlays) cannot
 * prematurely restore page scroll when only one of them closes.
 *
 * @example
 * ```svelte
 * <div {@attach createBodyScrollLock()}>Modal content</div>
 * ```
 */
export function createBodyScrollLock(): Attachment<HTMLElement> {
  return () => {
    const release = lockBodyScroll();
    return release;
  };
}

/** Pointer/click/touch events the outside-dismiss listener can key off. */
export type ClickOutsideEventType = 'click' | 'pointerdown' | 'mousedown' | 'touchstart';

export type ClickOutsideOptions = {
  /** Callback when an outside interaction occurs */
  handler: () => void;
  /** Whether the attachment is enabled — accepts a getter to stay reactive (default: true) */
  enabled?: boolean | (() => boolean);
  /**
   * Which document event triggers the outside check (default: `'click'`). Overlays that must
   * dismiss before a focus/selection change commits use `'pointerdown'` (or `'mousedown'`),
   * which fire ahead of `'click'`.
   */
  eventType?: ClickOutsideEventType;
  /**
   * Whether to listen in the capture phase (default: `true`). Capture sees the event before
   * inner stopPropagation can swallow it — the right default for a document-level dismisser.
   */
  capture?: boolean;
  /**
   * Additional elements that count as "inside" — a target within any of these (or the attach
   * node) does NOT trigger the handler. Each entry is a getter so a trigger/anchor that mounts
   * or swaps after the attachment is created still resolves freshly on each event. Returning
   * `null` skips that ref.
   */
  ignoreRefs?: Array<() => Element | null>;
};

function isInsideEventPath(event: Event, element: Element): boolean {
  const path = event.composedPath();
  return path.some((entry) => entry instanceof Node && element.contains(entry));
}

/**
 * Creates an outside-interaction attachment that calls a handler when a `click`, `pointerdown`,
 * `mousedown`, or `touchstart` lands outside the attached element (and outside any `ignoreRefs`).
 * This is the single canonical mechanism for overlay light-dismiss — dropdowns, menus, popovers —
 * so each overlay does not hand-roll its own `document` listener and inside/trigger exclusion
 * (see `OVERLAY-POLICY.md` § Outside-click).
 *
 * @example
 * ```svelte
 * <div {@attach createClickOutside({ handler: () => isOpen = false, enabled: () => isOpen })}>
 *   Dropdown content
 * </div>
 * ```
 *
 * @example With a separate trigger that must not count as outside, dismissing on pointerdown:
 * ```svelte
 * <div {@attach createClickOutside({
 *   handler: close,
 *   enabled: () => open,
 *   eventType: 'pointerdown',
 *   ignoreRefs: [() => triggerElement],
 * })}>...</div>
 * ```
 */
export function createClickOutside(options: ClickOutsideOptions): Attachment<HTMLElement> {
  const { handler, enabled = true, eventType = 'click', capture = true, ignoreRefs } = options;

  return (node: HTMLElement) => {
    function handleEvent(event: MouseEvent | PointerEvent | TouchEvent) {
      const isEnabled = typeof enabled === 'function' ? enabled() : enabled;
      if (!isEnabled) return;
      const target = event.target;
      // A non-Node (or null) target is treated as outside the node.
      if (!(target instanceof Node)) {
        handler();
        return;
      }
      if (isInsideEventPath(event, node)) return;
      if (ignoreRefs) {
        for (const ref of ignoreRefs) {
          const element = ref();
          if (element && isInsideEventPath(event, element)) return;
        }
      }
      handler();
    }

    document.addEventListener(eventType, handleEvent, capture);

    return () => {
      document.removeEventListener(eventType, handleEvent, capture);
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
