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

function parseTransitionPropertyList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function getRepeatedValue<T>(values: T[], index: number, fallback: T): T {
  if (values.length === 0) return fallback;
  return values[index % values.length] ?? fallback;
}

function getTransitionBoundary(element: HTMLElement): {
  activeProperties: Set<string> | null;
  totalTransitionTime: number;
} {
  const style = window.getComputedStyle(element);
  const properties = parseTransitionPropertyList(style.transitionProperty);
  const durations = parseTimeValueList(style.transitionDuration);
  const delays = parseTimeValueList(style.transitionDelay);
  const count = Math.max(properties.length, durations.length, delays.length);
  const activeProperties = new Set<string>();

  let longest = 0;
  let hasUnknownPropertyBoundary = false;

  for (let index = 0; index < count; index += 1) {
    const property = getRepeatedValue(properties, index, 'all');
    const duration = getRepeatedValue(durations, index, 0);
    const delay = getRepeatedValue(delays, index, 0);
    const total = duration + delay;
    longest = Math.max(longest, total);

    if (total <= 0 || property === 'none') continue;
    if (property === 'all') {
      hasUnknownPropertyBoundary = true;
      continue;
    }
    activeProperties.add(property);
  }

  return {
    activeProperties: hasUnknownPropertyBoundary ? null : activeProperties,
    totalTransitionTime: longest,
  };
}

export function waitForSpeedDialExit(element: HTMLElement, onComplete: () => void): () => void {
  const { activeProperties, totalTransitionTime } = getTransitionBoundary(element);
  let completed = false;
  let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

  const finish = () => {
    if (completed) return;
    completed = true;
    element.removeEventListener('transitionend', handleTransitionEnd);
    element.removeEventListener('transitioncancel', handleTransitionEnd);
    if (fallbackTimer) clearTimeout(fallbackTimer);
    onComplete();
  };

  const handleTransitionEnd = (event: TransitionEvent) => {
    if (event.target !== element) return;
    if (!activeProperties) return;
    if (!activeProperties.delete(event.propertyName)) return;
    if (activeProperties.size === 0) finish();
  };

  if (totalTransitionTime <= 0) {
    fallbackTimer = setTimeout(finish, 0);
    return () => {
      completed = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }

  element.addEventListener('transitionend', handleTransitionEnd);
  element.addEventListener('transitioncancel', handleTransitionEnd);
  fallbackTimer = setTimeout(finish, totalTransitionTime + 50);

  return () => {
    completed = true;
    element.removeEventListener('transitionend', handleTransitionEnd);
    element.removeEventListener('transitioncancel', handleTransitionEnd);
    if (fallbackTimer) clearTimeout(fallbackTimer);
  };
}
