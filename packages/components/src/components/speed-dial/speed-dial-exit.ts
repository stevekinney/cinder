import { waitForTransitionCompletion } from '../../_internal/transition-completion.ts';

/**
 * Waits for every one of Speed Dial's individually-transitioning action
 * elements to finish its own exit transition before calling `onComplete`.
 *
 * Speed Dial's actions each play their own staggered exit transition (see
 * `speed-dial.css`), so unlike the single-panel anchored overlays this
 * cannot delegate directly to `AnchoredOverlayExitState`
 * (`_internal/anchored-overlay-exit.svelte.ts`) — there is no single panel
 * element to await. It instead fans the shared single-element primitive,
 * `waitForTransitionCompletion` (`_internal/transition-completion.ts`), out
 * across every action and completes once all of them have. See
 * `_internal/OVERLAY-POLICY.md` § "Transition lifecycle".
 */
export function waitForSpeedDialExit(
  elements: HTMLElement | readonly HTMLElement[],
  reducedMotion: boolean,
  onComplete: () => void,
): () => void {
  const pendingElements = Array.isArray(elements) ? elements : [elements];
  if (pendingElements.length === 0) {
    onComplete();
    return () => {};
  }

  let pending = pendingElements.length;
  let cancelled = false;
  const cleanups = pendingElements.map((element) =>
    waitForTransitionCompletion({
      element,
      reducedMotion,
      onComplete: () => {
        pending -= 1;
        if (!cancelled && pending === 0) onComplete();
      },
    }),
  );

  return () => {
    cancelled = true;
    cleanups.forEach((cleanup) => cleanup());
  };
}
