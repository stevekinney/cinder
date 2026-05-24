function parseTimeToken(value: string): number {
  const trimmed = value.trim();
  if (trimmed === '') return 0;
  if (trimmed.endsWith('ms')) return Number(trimmed.slice(0, -2)) || 0;
  if (trimmed.endsWith('s')) return (Number(trimmed.slice(0, -1)) || 0) * 1000;
  return Number(trimmed) || 0;
}

function parseCommaList(value: string): number[] {
  return value.split(',').map(parseTimeToken);
}

function pickCyclicValue(values: number[], index: number): number {
  if (values.length === 0) return 0;
  return values[index % values.length] ?? 0;
}

function parseIterationCount(value: string): number[] {
  return value.split(',').map((entry) => {
    const trimmed = entry.trim();
    if (trimmed === 'infinite') return Number.POSITIVE_INFINITY;
    return Number(trimmed) || 0;
  });
}

export function getPresenceExitDuration(node: HTMLElement): number {
  const styles = getComputedStyle(node);
  const transitionDurations = parseCommaList(styles.transitionDuration);
  const transitionDelays = parseCommaList(styles.transitionDelay);
  const animationDurations = parseCommaList(styles.animationDuration);
  const animationDelays = parseCommaList(styles.animationDelay);
  const animationIterations = parseIterationCount(styles.animationIterationCount);

  const transitionMax = Array.from(
    { length: Math.max(transitionDurations.length, transitionDelays.length) },
    (_, index) =>
      pickCyclicValue(transitionDurations, index) + pickCyclicValue(transitionDelays, index),
  ).reduce((max, value) => Math.max(max, value), 0);

  const animationMax = Array.from(
    {
      length: Math.max(
        animationDurations.length,
        animationDelays.length,
        animationIterations.length,
      ),
    },
    (_, index) => {
      const iterationCount = pickCyclicValue(animationIterations, index);
      if (!Number.isFinite(iterationCount)) return 0;
      return (
        pickCyclicValue(animationDelays, index) +
        pickCyclicValue(animationDurations, index) * iterationCount
      );
    },
  ).reduce((max, value) => Math.max(max, value), 0);

  return Math.max(transitionMax, animationMax);
}
