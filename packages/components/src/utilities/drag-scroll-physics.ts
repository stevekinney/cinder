/**
 * Pure inertia/snap math for pointer-drag scrolling (Carousel, ScrollArea).
 * No DOM access — see `use-drag-scroll.svelte.ts` for the attachment that
 * drives a real scroll position with these functions.
 */

/** Per-frame velocity decay factor for released momentum. Closer to 1 coasts longer. */
export const DRAG_FRICTION = 0.95;
/**
 * Damping constant (per second) for smoothing the virtual scroll position
 * toward its target. High enough that the visible position tracks the
 * target closely every frame — this is a responsive follow, not an easing
 * animation; `DRAG_FRICTION` alone supplies the coast/glide feel.
 */
export const DRAG_DAMPING = 20;
/** Below this per-frame speed, released momentum reads as fully stopped. */
export const DRAG_SETTLE_VELOCITY_EPSILON = 0.01;

/**
 * Exponentially smooths `current` toward `target`, scaled by elapsed time so
 * the motion is frame-rate independent.
 */
export function damp(
  current: number,
  target: number,
  dampingConstant: number,
  deltaTimeMs: number,
): number {
  if (dampingConstant <= 0 || deltaTimeMs <= 0) return current;
  const t = 1 - Math.exp(-dampingConstant * (deltaTimeMs / 1000));
  return current + (target - current) * t;
}

/**
 * Predicts the resting position of an object at `current` moving at
 * `velocity`, decaying geometrically at `friction` per frame. `friction`
 * must be in `[0, 1)` — outside that range the projection cannot converge,
 * so `current` is returned unchanged.
 */
export function project(current: number, velocity: number, friction: number): number {
  if (friction <= 0 || friction >= 1) return current;
  return current + (velocity * friction) / (1 - friction);
}

/**
 * The inverse of `project`: the initial velocity needed for a `friction`-decaying
 * trajectory to travel exactly `distance` before coming to rest. Used to snap a
 * released drag onto a specific point by feeding the result back through the
 * same damping physics that already governs the coast.
 */
export function dragSnap(distance: number, friction: number): number {
  if (friction <= 0 || friction >= 1) return 0;
  return (distance * (1 - friction)) / friction;
}

/**
 * Picks the snap position nearest `position` from `snapPositions`. Returns
 * `null` when `snapPositions` is empty.
 */
export function snapSelect(position: number, snapPositions: readonly number[]): number | null {
  return snapPositions.reduce<number | null>((nearest, candidate) => {
    if (nearest === null) return candidate;
    return Math.abs(candidate - position) < Math.abs(nearest - position) ? candidate : nearest;
  }, null);
}

/**
 * Whether a release at `distance` from the nearest snap point should snap at
 * all. `'mandatory'` always snaps (matches CSS `scroll-snap-type: x mandatory`,
 * the default everywhere this engine attaches). `'proximity'` only snaps
 * within a third of the snapport — far enough from a snap point reads as an
 * intentional stop between slides, not toward one.
 */
export function shouldSnap(
  distance: number,
  snapportSize: number,
  mode: 'mandatory' | 'proximity' = 'mandatory',
): boolean {
  if (mode === 'mandatory') return true;
  if (snapportSize <= 0) return false;
  return Math.abs(distance) <= snapportSize / 3;
}
