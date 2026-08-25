type TransitionCompletionOptions = {
  element: HTMLElement;
  reducedMotion: boolean;
  onComplete: () => void;
  /**
   * Skip the `transitioncancel`-completes-immediately behavior documented in
   * `_internal/OVERLAY-POLICY.md` § "Transition lifecycle". Default `false`
   * (the canonical, policy-documented semantics every single-panel anchored
   * overlay relies on: `SlidingDialogState`, `AnchoredOverlayExitState`, ...).
   *
   * Speed Dial's per-action fan-out (`speed-dial/speed-dial-exit.ts`) is the
   * one caller that opts in: each action can still be mid-ENTER-transition
   * (its own staggered delay not yet elapsed) when the panel starts closing.
   * The browser cancels that in-flight enter transition the instant the
   * style target changes, firing `transitioncancel` for it — which, under
   * the default semantics, this helper would mistake for "the exit already
   * finished" and resolve prematurely, before the exit transition has even
   * started. The old bespoke `waitForSpeedDialExit` never listened for
   * `transitioncancel` at all; this flag restores that exact behavior for
   * Speed Dial while every other caller keeps the canonical contract.
   */
  ignoreCancel?: boolean;
  /**
   * Skip the "first `transitionend` completes immediately" behavior this
   * helper applies when `transition-property` resolves to `all` (an
   * unenumerable set — see `getTrackedTransitionProperties`), documented in
   * `_internal/OVERLAY-POLICY.md` § "Transition lifecycle" as the intended
   * cost of a caller using `all` instead of naming properties explicitly.
   * Default `false` (the canonical semantics every Cinder-authored exit
   * style relies on, since Cinder's own CSS never uses `all`).
   *
   * Speed Dial's per-action fan-out is the one caller that opts in: an
   * action's transition list is arbitrary consumer CSS, not Cinder's own,
   * and can legitimately contain `all` (e.g. `transition: all 500ms, opacity
   * 100ms`). Finishing on the first `transitionend` there would let the
   * 100ms `opacity` boundary complete the exit while a `transform` covered
   * by `all` is still transitioning for the full 500ms. With this flag, an
   * unenumerable `all` boundary is instead ignored entirely and completion
   * relies solely on the computed-longest-duration fallback timer — matching
   * the old bespoke `waitForSpeedDialExit`'s exact behavior for this case.
   */
  ignoreUnknownPropertyEvents?: boolean;
};

function parseTimeValueList(value: string): number[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .map((part) => {
      if (part.endsWith('ms')) return Number.parseFloat(part);
      if (part.endsWith('s')) return Number.parseFloat(part) * 1000;
      return 0;
    })
    .filter((part) => Number.isFinite(part));
}

/**
 * Per the CSS spec, when `transition-property`/`transition-duration`/
 * `transition-delay` lists have different lengths, the SHORTER lists repeat
 * CYCLICALLY from the beginning — not "hold the last value". E.g. three
 * properties with only two durations (`100ms, 0ms`) resolve to `100ms, 0ms,
 * 100ms` for the third property (index 2 % 2 = 0), not `100ms, 0ms, 0ms`.
 */
function getRepeatedValue<T>(values: readonly T[], index: number, fallback: T): T {
  if (values.length === 0) return fallback;
  return values[index % values.length] ?? fallback;
}

function getLongestTransitionTime(element: HTMLElement): number {
  const style = window.getComputedStyle(element);
  const properties = style.transitionProperty
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const durations = parseTimeValueList(style.transitionDuration);
  const delays = parseTimeValueList(style.transitionDelay);
  // The EFFECTIVE number of transition slots is always `properties.length`
  // — per the CSS Transitions spec, `transition-property` defines how many
  // transitions exist; `transition-duration`/`transition-delay` only ever
  // cyclically REPEAT into that many slots when shorter, or have their
  // EXCESS entries ignored entirely when longer (round 18 review: `all`
  // with durations `100ms, 10s` has only ONE effective slot — properties.length
  // is 1 — so the `10s` second duration entry is simply unused, never
  // paired with any real transition. `Math.max(durations.length,
  // delays.length, properties.length)` previously let that unused entry
  // inflate the loop to a phantom second iteration via
  // `getRepeatedValue`'s cyclical wrap-around, producing a bogus 10s
  // "longest" boundary instead of the real ~100ms one). A property list
  // LONGER than the duration/delay lists is still fully covered by this —
  // `properties.length` IS the count in that case too, e.g. `all, opacity,
  // transform, width, color` with only 3 durations/delays still iterates
  // all 5 property slots, each cyclically resolving its own duration+delay
  // from the shorter lists.
  const count = properties.length;

  let longest = 0;

  for (let index = 0; index < count; index += 1) {
    // `transition-property: none` (or a slot that cyclically resolves to
    // `none`) can never produce a transition, however long its paired
    // duration happens to be — e.g. `all, none` with durations `100ms, 10s`
    // would otherwise let this fallback wait out the unreachable 10s
    // instead of the real ~100ms boundary. Speed Dial's per-action fan-out
    // (the one caller relying on this fallback exclusively, via
    // `ignoreUnknownPropertyEvents`) is exactly where consumer CSS can shape
    // like this. Mirrors the same exclusion `getTrackedTransitionProperties`
    // below already applies.
    const property = getRepeatedValue(properties, index, 'all');
    if (property === 'none') continue;
    const duration = getRepeatedValue(durations, index, 0);
    const delay = getRepeatedValue(delays, index, 0);
    longest = Math.max(longest, duration + delay);
  }

  return longest;
}

function getTrackedTransitionProperties(element: HTMLElement): Set<string> | null {
  const style = window.getComputedStyle(element);
  const properties = style.transitionProperty
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const durations = parseTimeValueList(style.transitionDuration);
  const delays = parseTimeValueList(style.transitionDelay);
  const count = Math.max(properties.length, durations.length, delays.length);

  const trackedProperties = new Set<string>();

  for (let index = 0; index < count; index += 1) {
    const property = getRepeatedValue(properties, index, 'all');
    const duration = getRepeatedValue(durations, index, 0);
    const delay = getRepeatedValue(delays, index, 0);
    if (duration + delay <= 0) continue;
    // `transition-property: none` means no property actually transitions,
    // whatever duration/delay a shorthand happens to leave behind — skip it
    // rather than waiting on a `transitionend` that can never fire.
    if (property === 'none') continue;
    if (property === 'all') return null;
    trackedProperties.add(property);
  }

  return trackedProperties;
}

export function waitForTransitionCompletion({
  element,
  reducedMotion,
  onComplete,
  ignoreCancel = false,
  ignoreUnknownPropertyEvents = false,
}: TransitionCompletionOptions): () => void {
  let completed = false;
  let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
  let cancelListenerFrame: number | undefined;

  const finish = () => {
    if (completed) return;
    completed = true;
    element.removeEventListener('transitionend', handleTransitionEnd);
    if (!ignoreCancel) element.removeEventListener('transitioncancel', handleTransitionCancel);
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = undefined;
    }
    if (cancelListenerFrame !== undefined) {
      cancelAnimationFrame(cancelListenerFrame);
      cancelListenerFrame = undefined;
    }
    onComplete();
  };

  const handleTransitionEnd = (event: TransitionEvent) => {
    if (event.target instanceof Element && event.target !== element) return;
    if (!pendingProperties) {
      if (ignoreUnknownPropertyEvents) return;
      finish();
      return;
    }

    pendingProperties.delete(event.propertyName);
    if (pendingProperties.size === 0) {
      finish();
    }
  };

  // A descendant's own canceled transition bubbles `transitioncancel` up to
  // this listener too (transition events bubble like most others) — without
  // this guard, a completely unrelated child transition being interrupted
  // would force-complete the panel's own exit. Same target-identity filter
  // `handleTransitionEnd` already applies above.
  const handleTransitionCancel = (event: TransitionEvent) => {
    if (event.target instanceof Element && event.target !== element) return;
    finish();
  };

  const totalTransitionTime = reducedMotion ? 0 : getLongestTransitionTime(element);
  const pendingProperties = reducedMotion
    ? new Set<string>()
    : getTrackedTransitionProperties(element);

  // No duration at all, or every named property resolved to `none` (see
  // getTrackedTransitionProperties above) — nothing will ever transition, so
  // don't wait on a `transitionend` that can never fire.
  if (totalTransitionTime <= 0 || pendingProperties?.size === 0) {
    queueMicrotask(finish);
    return finish;
  }

  element.addEventListener('transitionend', handleTransitionEnd);

  // Defer attaching `transitioncancel` until AFTER the browser has actually
  // recalculated style for this exit, rather than listening for it
  // immediately. Closing an element mid-ENTER-transition retargets the same
  // property to its exit value, which cancels that in-flight entrance
  // transition — the browser dispatches `transitioncancel` for it once it
  // next recalculates style, which can be well before this listener would
  // otherwise attach. Since that event's target is this same element, an
  // immediately attached listener can't tell it apart from a genuine
  // cancellation of the EXIT itself, and would call `finish()` on the
  // strength of the stale ENTER's cancellation before the new exit
  // transition has even started — the retained panel would snap away
  // instead of animating out on a rapid open-then-close.
  //
  // A SINGLE `requestAnimationFrame` is not enough (CIN-376 round 16 review):
  // `isClosing` (which drives the `data-cinder-closing` attribute that
  // starts this exit's styles) is set from a Svelte `$effect`, which does
  // not force a style/layout flush — and animation-frame callbacks
  // themselves run BEFORE the browser's rendering/style-recalculation step
  // for that frame, not after it. So a single rAF can still fire before the
  // browser has actually applied the exit style and dispatched the leftover
  // ENTER's `transitioncancel`, leaving the same race. The standard
  // "wait until a style change has actually been rendered" technique is a
  // DOUBLE rAF: the first callback runs before the upcoming frame's
  // style/layout work, and by the time ITS OWN nested rAF callback runs, the
  // browser has committed to and rendered that frame — guaranteeing any
  // `transitioncancel` from the interrupted enter transition has already
  // been dispatched and missed (nothing was listening yet).
  if (!ignoreCancel) {
    if (typeof requestAnimationFrame === 'function') {
      cancelListenerFrame = requestAnimationFrame(() => {
        cancelListenerFrame = requestAnimationFrame(() => {
          cancelListenerFrame = undefined;
          if (completed) return;
          element.addEventListener('transitioncancel', handleTransitionCancel);
        });
      });
    } else {
      // No `requestAnimationFrame` (SSR/non-browser environment) — attach
      // immediately, matching the prior behavior there.
      element.addEventListener('transitioncancel', handleTransitionCancel);
    }
  }

  fallbackTimer = setTimeout(finish, totalTransitionTime + 50);

  return finish;
}
