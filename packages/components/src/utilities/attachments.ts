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
      if (event.type === 'touchstart' && !event.cancelable) return;
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
 * Intended for overlay bodies that show a bottom fade (opaque overlay, never
 * a mask — see `_scroll-fade.css`) while scrollable.
 *
 * Only `node` itself is observed with `ResizeObserver` — it catches the
 * container's own box changing (viewport resize, a sidebar collapsing, a
 * layout pass). Because `node` scrolls (`overflow-y: auto` with a fixed/flex
 * height), content growing or shrinking INSIDE it does not resize `node`'s
 * own box, so that case is covered separately by a `MutationObserver` that
 * schedules a re-measure directly on any child/text/relevant-attribute
 * change. Re-measuring `scrollHeight`/`clientHeight` is a cheap property
 * read, so the mutation callback does not need an observer of its own.
 *
 * This replaces an earlier version that additionally registered a
 * `ResizeObserver` on every descendant (`node.querySelectorAll('*')`,
 * re-synced on every mutation) to catch a size change that occurs without a
 * DOM mutation. That is fine for a handful of nodes in a Modal body, but
 * registers thousands of observers on a long scroll surface such as a chat
 * timeline. Dropping that exhaustive case for a large, real perf win is a
 * deliberate trade-off — the common version of it, an `<img src>` swap (a
 * lazy-load library resolving an attachment thumbnail, for example), IS
 * still covered: `src` is in the `attributeFilter` below, so it schedules a
 * re-measure like any other tracked mutation. What remains uncovered is
 * narrower — a genuinely mutation-less size change, such as a `<canvas>`
 * redraw or a webfont finishing load and reflowing existing text — which is
 * rare enough that every path this attachment is actually exercised through
 * (content added/removed, text/attribute changes, scrolling, container
 * resize) is still covered.
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
    resizeObserver.observe(node);

    const mutationObserver =
      typeof MutationObserver === 'undefined' ? null : new MutationObserver(scheduleUpdate);

    mutationObserver?.observe(node, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['hidden', 'class', 'style', 'aria-hidden', 'src'],
    });

    node.addEventListener('scroll', scheduleUpdate, { passive: true });
    update();

    return () => {
      if (frame) cancelFrame(frame);
      resizeObserver.disconnect();
      mutationObserver?.disconnect();
      node.removeEventListener('scroll', scheduleUpdate);
    };
  };
}

/** Which scroll axis {@link overflowShadow} measures and reports. */
export type OverflowShadowAxis = 'inline' | 'block';

const OVERFLOW_SHADOW_ATTRIBUTE: Record<OverflowShadowAxis, string> = {
  inline: 'data-cinder-overflows-inline',
  block: 'data-cinder-overflows-block',
};

/**
 * Marks scroll containers that have MORE content than fits on the given
 * axis, in EITHER direction — unlike {@link overflowFade}, this is not
 * scroll-position-aware (no `scroll` listener, no "am I at the end"
 * suppression). It backs the data-grid `--_cinder-data-grid-overflow-shadow`
 * inset-shadow affordance (see `data-grid.css`), which paints BOTH edges
 * whenever content overflows, regardless of current scroll position — the
 * inset shadow is decoration on the scroll container's own (non-scrolling)
 * box, so it stays pinned at the true edges as content scrolls underneath.
 *
 * `node`'s own box is observed with `ResizeObserver` (container resize), and
 * content changes are caught by a `MutationObserver` that schedules a
 * re-measure directly — the same lean design as `overflowFade`, see its doc
 * comment for the full rationale.
 */
export function overflowShadow(axis: OverflowShadowAxis): Attachment<HTMLElement> {
  const attributeName = OVERFLOW_SHADOW_ATTRIBUTE[axis];

  return (node) => {
    if (typeof ResizeObserver === 'undefined') {
      node.removeAttribute(attributeName);
      return;
    }

    const update = () => {
      const overflows =
        axis === 'inline'
          ? node.scrollWidth - node.clientWidth > 1
          : node.scrollHeight - node.clientHeight > 1;
      node.toggleAttribute(attributeName, overflows);
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
    resizeObserver.observe(node);

    const mutationObserver =
      typeof MutationObserver === 'undefined' ? null : new MutationObserver(scheduleUpdate);

    mutationObserver?.observe(node, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['hidden', 'class', 'style', 'aria-hidden', 'src'],
    });

    update();

    return () => {
      if (frame) cancelFrame(frame);
      resizeObserver.disconnect();
      mutationObserver?.disconnect();
    };
  };
}

/** Which scroll axis {@link overflowFadeEdges} measures and reports. */
export type OverflowFadeEdgesAxis = 'block' | 'inline';

const OVERFLOW_FADE_START_ATTRIBUTE: Record<OverflowFadeEdgesAxis, string> = {
  block: 'data-cinder-overflows-start',
  inline: 'data-cinder-overflows-inline-start',
};
const OVERFLOW_FADE_END_ATTRIBUTE: Record<OverflowFadeEdgesAxis, string> = {
  block: 'data-cinder-overflows',
  inline: 'data-cinder-overflows-inline-end',
};

/**
 * Marks a scroll container that has more content on EITHER side of the given
 * axis — the fallback driver for a both-edges `_scroll-fade.css` recipe
 * (`.cinder-_scroll-fade` + `.cinder-_scroll-fade-start` for block, or the
 * `-inline-start`/`-inline-end` pair for inline). Unlike {@link overflowFade}
 * (single, block-end-only edge), this reports each edge independently based
 * on real scroll position: the start edge fades in once scrolled away from
 * the very start, and the end edge fades out once scrolled to the very end —
 * so a container that is fully scrolled to one edge never shows a fade
 * toward content that is not there.
 *
 * Shares the same lean container-ResizeObserver + content-MutationObserver +
 * passive-scroll-listener design as {@link overflowFade}; see its doc
 * comment for the full perf rationale.
 */
export function overflowFadeEdges(axis: OverflowFadeEdgesAxis): Attachment<HTMLElement> {
  const startAttribute = OVERFLOW_FADE_START_ATTRIBUTE[axis];
  const endAttribute = OVERFLOW_FADE_END_ATTRIBUTE[axis];

  return (node) => {
    if (typeof ResizeObserver === 'undefined') {
      node.removeAttribute(startAttribute);
      node.removeAttribute(endAttribute);
      return;
    }

    const update = () => {
      const scrollPosition = axis === 'block' ? node.scrollTop : node.scrollLeft;
      const contentExtent = axis === 'block' ? node.scrollHeight : node.scrollWidth;
      const viewportExtent = axis === 'block' ? node.clientHeight : node.clientWidth;
      const overflows = contentExtent - viewportExtent > 1;
      const atStart = scrollPosition <= 1;
      const atEnd = scrollPosition + viewportExtent >= contentExtent - 1;
      node.toggleAttribute(startAttribute, overflows && !atStart);
      node.toggleAttribute(endAttribute, overflows && !atEnd);
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
    resizeObserver.observe(node);

    const mutationObserver =
      typeof MutationObserver === 'undefined' ? null : new MutationObserver(scheduleUpdate);

    mutationObserver?.observe(node, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['hidden', 'class', 'style', 'aria-hidden', 'src'],
    });

    node.addEventListener('scroll', scheduleUpdate, { passive: true });
    update();

    return () => {
      if (frame) cancelFrame(frame);
      resizeObserver.disconnect();
      mutationObserver?.disconnect();
      node.removeEventListener('scroll', scheduleUpdate);
    };
  };
}
