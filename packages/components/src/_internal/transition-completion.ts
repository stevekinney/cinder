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

function getLongestTransitionTime(element: HTMLElement): number {
  const style = window.getComputedStyle(element);
  const durations = parseTimeValueList(style.transitionDuration);
  const delays = parseTimeValueList(style.transitionDelay);
  const count = Math.max(durations.length, delays.length);

  let longest = 0;

  for (let index = 0; index < count; index += 1) {
    const duration = durations[index] ?? durations.at(-1) ?? 0;
    const delay = delays[index] ?? delays.at(-1) ?? 0;
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
    const property = properties[index] ?? properties.at(-1) ?? 'all';
    const duration = durations[index] ?? durations.at(-1) ?? 0;
    const delay = delays[index] ?? delays.at(-1) ?? 0;
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
}: TransitionCompletionOptions): () => void {
  let completed = false;
  let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

  const finish = () => {
    if (completed) return;
    completed = true;
    element.removeEventListener('transitionend', handleTransitionEnd);
    if (!ignoreCancel) element.removeEventListener('transitioncancel', handleTransitionCancel);
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = undefined;
    }
    onComplete();
  };

  const handleTransitionEnd = (event: TransitionEvent) => {
    if (event.target instanceof Element && event.target !== element) return;
    if (!pendingProperties) {
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
  if (!ignoreCancel) element.addEventListener('transitioncancel', handleTransitionCancel);
  fallbackTimer = setTimeout(finish, totalTransitionTime + 50);

  return finish;
}
