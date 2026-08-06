import type { Attachment } from 'svelte/attachments';

/**
 * Marks a scroll container that has more content on EITHER side of the
 * block axis — the JS driver for the `.cinder-_scroll-fade` +
 * `.cinder-_scroll-fade-start` both-edges recipe in `@lostgradient/cinder`'s
 * shared `_scroll-fade.css` partial (loaded transitively via `cinder/styles`,
 * which every Chat consumer already imports). Sets the exact same
 * `data-cinder-overflows` / `data-cinder-overflows-start` attribute names
 * that recipe reads, so no cinder-side change is needed for chat to opt in.
 *
 * This is a deliberate, minimal LOCAL duplicate of
 * `@lostgradient/cinder`'s internal `overflowFadeEdges()`
 * (`utilities/attachments.ts`) rather than an import: `@lostgradient/cinder`
 * is a peer dependency of this package (see `package.json`), and its
 * internal `src/utilities/*` modules are not a published API surface — only
 * `cinder/*` subpath component/style exports are. Chat already follows this
 * discipline for other cross-cutting DOM concerns (see `use-intersection.svelte.ts`,
 * `use-reduced-motion.svelte.ts`): small, independent local implementations
 * rather than reaching into cinder internals.
 *
 * The start edge fades in once scrolled away from the very start; the end
 * edge fades out once scrolled to the very end — so a timeline fully
 * scrolled to one edge never shows a fade toward content that is not there.
 * Only `node` itself is observed with `ResizeObserver` (container resize);
 * content changes (new messages) are caught by a `MutationObserver` that
 * schedules a re-measure directly, without a per-descendant observer — the
 * same lean design as cinder's `overflowFade`/`overflowFadeEdges` (see their
 * doc comments for the full perf rationale, which matters here just as much:
 * a chat timeline is exactly the "hundreds of messages" case that motivated
 * that design).
 */
export function overflowFadeEdges(): Attachment<HTMLElement> {
  return (node) => {
    if (typeof ResizeObserver === 'undefined') {
      node.removeAttribute('data-cinder-overflows-start');
      node.removeAttribute('data-cinder-overflows');
      return;
    }

    const update = () => {
      const overflows = node.scrollHeight - node.clientHeight > 1;
      const atStart = node.scrollTop <= 1;
      const atEnd = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
      node.toggleAttribute('data-cinder-overflows-start', overflows && !atStart);
      node.toggleAttribute('data-cinder-overflows', overflows && !atEnd);
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
