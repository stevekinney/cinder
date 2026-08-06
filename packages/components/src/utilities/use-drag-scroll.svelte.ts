import {
  DRAG_DAMPING,
  DRAG_FRICTION,
  DRAG_SETTLE_VELOCITY_EPSILON,
  damp,
  dragSnap,
  project,
  shouldSnap,
  snapSelect,
} from './drag-scroll-physics.ts';

const DRAG_THRESHOLD_PX = 10;

/**
 * Fine-pointer (mouse) drag-to-scroll for a native scroll container along a
 * single axis, in the house attachment style of `useResizeObserver`:
 * `(node) => cleanup`. Owns pointer capture, a rAF-driven momentum ticker,
 * and the `scroll-snap-type` swap that lets the physics run without the
 * browser's native snapping fighting it.
 *
 * Touch and pen are untouched — they already pan the native scroller, and
 * layering this engine under them would double-handle the gesture; a
 * hardware-level `pointerType === 'mouse'` check enforces that. The `enabled`
 * option is the caller's responsibility for everything else this shouldn't
 * run under — a `(hover: hover) and (pointer: fine)` `MediaQuery` (never a
 * bare `matchMedia` call) and `!prefersReducedMotion`, since momentum and
 * rubber-band are exactly the inertial motion that preference is about.
 *
 * Snap points are supplied by the caller (`getSnapPositions`) rather than
 * inferred from DOM shape, so this stays reusable across consumers with
 * different child structures (Carousel's slides, ScrollArea's arbitrary
 * content). Omit it for a non-snapping scroller — momentum still applies,
 * it just coasts to a natural stop instead of snapping.
 */
export function useDragScroll(
  options: import('./use-drag-scroll.types.ts').UseDragScrollOptions & {
    /** Which axis to drag-scroll along. Default `'x'`. */
    axis?: 'x' | 'y';
    getSnapPositions?: () => readonly number[];
  } = {},
): import('./use-drag-scroll.types.ts').DragScrollAttachment {
  const {
    enabled = () => true,
    snapMode = 'mandatory',
    axis = 'x',
    onSettle,
    getSnapPositions,
  } = options;
  const scrollProperty = axis === 'x' ? 'scrollLeft' : 'scrollTop';
  const clientSizeProperty = axis === 'x' ? 'clientWidth' : 'clientHeight';
  const clientAxisProperty = axis === 'x' ? 'clientX' : 'clientY';
  const movementAxisProperty = axis === 'x' ? 'movementX' : 'movementY';

  return (node: HTMLElement) => {
    let pointerId: number | null = null;
    let startClientPosition = 0;
    let target = 0;
    let virtualScroll = 0;
    let velocity = 0;
    let dragged = false;
    let rafId: number | null = null;
    let lastFrameTime = 0;
    let originalSnapType = '';
    let dragSuppressTimer: ReturnType<typeof setTimeout> | null = null;

    function tick(now: number): void {
      const frameDeltaMs = lastFrameTime === 0 ? 16 : now - lastFrameTime;
      lastFrameTime = now;

      if (pointerId === null) {
        // Released: friction decays velocity toward zero each frame.
        velocity *= DRAG_FRICTION;
        target += velocity;
      }
      virtualScroll = damp(virtualScroll, target, DRAG_DAMPING, frameDeltaMs);
      // Direct property assignment is always an immediate jump, unlike
      // `scrollTo({ behavior })` — `'smooth'` is the only standardized
      // non-default value, so there's no portable way to *force* instant via
      // the options object across browsers.
      node[scrollProperty] = virtualScroll;

      const settled = pointerId === null && Math.abs(velocity) < DRAG_SETTLE_VELOCITY_EPSILON;
      if (settled) {
        rafId = null;
        lastFrameTime = 0;
        node.removeAttribute('data-cinder-dragging');
        restoreSnapType();
        onSettle?.();
        return;
      }
      rafId = requestAnimationFrame(tick);
    }

    function startTicker(): void {
      if (rafId !== null) return;
      lastFrameTime = 0;
      rafId = requestAnimationFrame(tick);
    }

    function stopTicker(): void {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      lastFrameTime = 0;
    }

    function suppressSnapType(): void {
      originalSnapType = node.style.scrollSnapType;
      node.style.scrollSnapType = 'none';
    }

    function restoreSnapType(): void {
      node.style.scrollSnapType = originalSnapType;
    }

    function suppressNextClick(): void {
      node.setAttribute('data-cinder-dragged', '');
      // Cleared on the next macrotask, after the resulting `click` — capture-phase
      // listener below reads the attribute synchronously during that event.
      if (dragSuppressTimer !== null) clearTimeout(dragSuppressTimer);
      dragSuppressTimer = setTimeout(() => {
        dragSuppressTimer = null;
        node.removeAttribute('data-cinder-dragged');
      }, 0);
    }

    function onClickCapture(event: MouseEvent): void {
      if (node.hasAttribute('data-cinder-dragged')) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    function onPointerMove(event: PointerEvent): void {
      if (event.pointerId !== pointerId) return;
      const clientPosition = event[clientAxisProperty];
      const dragDistance = clientPosition - startClientPosition;
      if (!dragged && Math.abs(dragDistance) > DRAG_THRESHOLD_PX) {
        dragged = true;
        node.setAttribute('data-cinder-dragging', '');
      }
      if (!dragged) return;
      // Dragging the pointer forward reveals content behind it — the scroll
      // position decreases as the finger/cursor moves in the positive direction.
      const scrollDelta = -event[movementAxisProperty];
      target += scrollDelta;
      velocity += scrollDelta;
    }

    function onPointerUp(event: PointerEvent): void {
      if (event.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      if ('releasePointerCapture' in node && node.hasPointerCapture(event.pointerId)) {
        node.releasePointerCapture(event.pointerId);
      }
      pointerId = null;

      if (!dragged) {
        stopTicker();
        node.removeAttribute('data-cinder-dragging');
        restoreSnapType();
        return;
      }

      suppressNextClick();
      const snapPositions = getSnapPositions?.();
      if (snapPositions && snapPositions.length > 0) {
        const projected = project(target, velocity, DRAG_FRICTION);
        const snapTarget = snapSelect(projected, snapPositions);
        if (
          snapTarget !== null &&
          shouldSnap(snapTarget - projected, node[clientSizeProperty], snapMode)
        ) {
          // `target` stays where it is — the ticker below applies `velocity`
          // to it every frame, and `dragSnap` sizes that velocity so those
          // frame-by-frame additions sum to exactly `snapTarget - target`.
          // Jumping `target` to `snapTarget` directly here would double the
          // distance: the ticker would then add the same span again on top.
          velocity = dragSnap(snapTarget - target, DRAG_FRICTION);
        }
      }
      // The ticker (already running) carries the release through to settle,
      // snapped or not.
    }

    function onPointerDown(event: PointerEvent): void {
      if (event.pointerType !== 'mouse') return;
      if (!enabled()) return;
      pointerId = event.pointerId;
      startClientPosition = event[clientAxisProperty];
      const startScroll = node[scrollProperty];
      target = startScroll;
      virtualScroll = startScroll;
      velocity = 0;
      dragged = false;
      suppressSnapType();
      if ('setPointerCapture' in node) node.setPointerCapture(event.pointerId);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
      startTicker();
    }

    node.addEventListener('pointerdown', onPointerDown);
    node.addEventListener('click', onClickCapture, { capture: true });

    return () => {
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('click', onClickCapture, { capture: true });
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      stopTicker();
      if (dragSuppressTimer !== null) clearTimeout(dragSuppressTimer);
    };
  };
}
