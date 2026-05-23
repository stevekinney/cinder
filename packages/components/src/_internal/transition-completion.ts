type TransitionCompletionOptions = {
  element: HTMLElement;
  reducedMotion: boolean;
  onComplete: () => void;
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
    if (property === 'all') return null;
    trackedProperties.add(property);
  }

  return trackedProperties;
}

export function waitForTransitionCompletion({
  element,
  reducedMotion,
  onComplete,
}: TransitionCompletionOptions): () => void {
  let completed = false;
  let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

  const finish = () => {
    if (completed) return;
    completed = true;
    element.removeEventListener('transitionend', handleTransitionEnd);
    element.removeEventListener('transitioncancel', finish);
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

  const totalTransitionTime = reducedMotion ? 0 : getLongestTransitionTime(element);
  const pendingProperties = reducedMotion
    ? new Set<string>()
    : getTrackedTransitionProperties(element);

  if (totalTransitionTime <= 0) {
    queueMicrotask(finish);
    return finish;
  }

  element.addEventListener('transitionend', handleTransitionEnd);
  element.addEventListener('transitioncancel', finish);
  fallbackTimer = setTimeout(finish, totalTransitionTime + 50);

  return finish;
}
