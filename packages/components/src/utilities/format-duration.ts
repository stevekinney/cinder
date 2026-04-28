/** Format a duration in milliseconds to a human-readable string (e.g., "45s", "3m 12s", "2h 15m"). */
export function formatDuration(milliseconds: number | null): string;
export function formatDuration(
  start: Date | string | number | null,
  end: Date | string | number | null,
): string;
export function formatDuration(
  startOrMilliseconds: number | Date | string | null,
  end?: Date | string | number | null,
): string {
  let milliseconds: number;

  if (end !== undefined) {
    if (startOrMilliseconds === null || end === null) return '-';

    const startTime =
      typeof startOrMilliseconds === 'number'
        ? startOrMilliseconds
        : new Date(startOrMilliseconds).getTime();
    const endTime = typeof end === 'number' ? end : new Date(end).getTime();
    milliseconds = endTime - startTime;
  } else {
    if (startOrMilliseconds === null) return '-';
    milliseconds = typeof startOrMilliseconds === 'number' ? startOrMilliseconds : 0;
  }

  if (milliseconds < 0) return '-';

  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  if (seconds > 0) return `${seconds}s`;

  return `${milliseconds}ms`;
}
