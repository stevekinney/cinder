/**
 * Shared reactive interaction state for all chart components.
 *
 * Encapsulates the pointer/keyboard target tracking, resize observation, and
 * target-staleness cleanup that are identical across LineChart, AreaChart, and
 * BarChart. Each chart component instantiates ChartInteraction once and reads
 * `activeTarget`, `measuredWidth`, and the handler functions from it.
 *
 * Series-specific logic (model creation, crosshair direction, focus-target
 * element shape) stays in each individual chart component.
 */

import { nearestTarget, toggleSeriesId, type ChartTarget } from './chart-utilities.ts';

export type ChartInteractionOptions = {
  /**
   * Pixel axis used by nearestTarget when the pointer moves. Defaults to 'x'.
   * Bar charts switch this to 'y' when orientation is 'horizontal'. Pass a
   * reactive getter (e.g. `() => orientation === 'vertical' ? 'x' : 'y'`) to
   * follow orientation changes without re-instantiating the class.
   */
  pointerAxis?: 'x' | 'y' | (() => 'x' | 'y');
};

export class ChartInteraction {
  /** Current measured container width in pixels. Starts at 640 as a reasonable SSR default. */
  measuredWidth = $state(640);

  /** Target activated by pointer movement. Cleared on pointer-leave. */
  pointerTarget = $state<ChartTarget | undefined>();

  /** Target activated by keyboard navigation. Cleared on Escape or blur. */
  focusedTarget = $state<ChartTarget | undefined>();

  /**
   * The active target visible to the tooltip and crosshair.
   * Keyboard focus wins over pointer so screen-reader users are never
   * overridden by incidental pointer events.
   */
  activeTarget = $derived(this.focusedTarget ?? this.pointerTarget);

  readonly #pointerAxisSource: () => 'x' | 'y';

  constructor(options: ChartInteractionOptions = {}) {
    const axis = options.pointerAxis ?? 'x';
    this.#pointerAxisSource = typeof axis === 'function' ? axis : () => axis;
  }

  /**
   * Attaches a ResizeObserver to the chart root element and updates
   * `measuredWidth` whenever the element's content rect changes.
   * Returns a cleanup function for use inside `$effect`.
   */
  observeResize(element: HTMLElement): () => void {
    if (typeof ResizeObserver === 'undefined') return () => {};
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      this.measuredWidth = Math.max(1, Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }

  /**
   * Clears stale targets when the model's target set changes (e.g. after a
   * legend toggle that removes the currently active series). Also clears both
   * targets when the chart enters a loading or empty state.
   *
   * Call inside a `$effect` that reads `loading`, `empty`, and `targets`.
   */
  clearStaleTargets(loading: boolean, empty: boolean, targets: readonly ChartTarget[]): void {
    if (loading || empty) {
      this.pointerTarget = undefined;
      this.focusedTarget = undefined;
      return;
    }
    if (!this.#includesTarget(this.pointerTarget, targets)) this.pointerTarget = undefined;
    if (!this.#includesTarget(this.focusedTarget, targets)) this.focusedTarget = undefined;
  }

  #includesTarget(candidate: ChartTarget | undefined, targets: readonly ChartTarget[]): boolean {
    return Boolean(candidate && targets.some((target) => target.id === candidate.id));
  }

  /**
   * Updates `pointerTarget` from a PointerEvent fired on the SVG hit surface.
   * The hit surface must be an SVGRectElement.
   */
  activateByPointer(event: PointerEvent, targets: readonly ChartTarget[]): void {
    if (!(event.currentTarget instanceof SVGRectElement)) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    this.pointerTarget = nearestTarget(
      targets,
      event.clientX - bounds.left,
      event.clientY - bounds.top,
      this.#pointerAxisSource(),
    );
  }

  /**
   * Clears `pointerTarget` on pointer-leave of the hit surface.
   */
  clearPointerTarget(): void {
    this.pointerTarget = undefined;
  }

  /**
   * Moves DOM focus to the SVG element carrying the given `data-cinder-target-id`
   * attribute. Keeps `:focus-visible`, `aria-describedby`, and `aria-label`
   * synchronized with the keyboard-active target.
   */
  focusDomTarget(rootElement: HTMLElement, targetId: string | undefined): void {
    if (!rootElement || !targetId) return;
    const next = rootElement.querySelector<SVGGraphicsElement>(
      `[data-cinder-target-id="${CSS.escape(targetId)}"]`,
    );
    next?.focus();
  }

  /**
   * Handles keyboard navigation across chart targets.
   *
   * - ArrowRight / ArrowDown — advance one target
   * - ArrowLeft / ArrowUp — retreat one target
   * - Home — jump to first target
   * - End — jump to last target
   * - Escape — clear focused target
   *
   * All navigating keys call `event.preventDefault()` so the page does not
   * scroll during chart keyboard navigation.
   */
  activateByKeyboard(
    event: KeyboardEvent,
    rootElement: HTMLElement,
    targets: readonly ChartTarget[],
    keyboardEnabled: boolean,
  ): void {
    if (!keyboardEnabled) return;
    const currentTargetId =
      event.currentTarget instanceof Element
        ? event.currentTarget.getAttribute('data-cinder-target-id')
        : undefined;
    const currentIndex = Math.max(
      0,
      targets.findIndex((target) => target.id === (currentTargetId ?? this.focusedTarget?.id)),
    );
    if (event.key === 'Escape') {
      this.focusedTarget = undefined;
      event.preventDefault();
      return;
    }
    const keyOffsets: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    let next: ChartTarget | undefined;
    if (event.key === 'Home') {
      next = targets[0];
    } else if (event.key === 'End') {
      next = targets.at(-1);
    } else if (event.key in keyOffsets) {
      const nextIndex =
        (currentIndex + (keyOffsets[event.key] ?? 0) + targets.length) % targets.length;
      next = targets[nextIndex] ?? this.activeTarget;
    } else {
      return;
    }
    this.focusedTarget = next;
    event.preventDefault();
    this.focusDomTarget(rootElement, next?.id);
  }

  /**
   * Toggles a series in the hidden set and returns the updated array.
   * Pure — does not mutate its argument.
   */
  toggleSeries(hiddenSeriesIds: string[], seriesId: string): string[] {
    return toggleSeriesId(hiddenSeriesIds, seriesId);
  }
}
