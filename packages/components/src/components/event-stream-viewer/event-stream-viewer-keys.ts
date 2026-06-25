import type { StreamEvent, StreamReconnectedBoundary } from './event-stream-viewer.types.ts';

export function streamEventKey(event: StreamEvent): string {
  const parts = ['event', `id=${event.id}`];
  if (typeof event.sequence === 'number') parts.push(`sequence=${event.sequence}`);
  return parts.join('|');
}

export function reconnectedBoundaryKey(boundary: StreamReconnectedBoundary): string {
  return ['reconnected', `id=${boundary.id}`].join('|');
}

export function sequenceGapKey(
  previousEventId: string | undefined,
  event: StreamEvent,
  expectedSequence: number,
  actualSequence: number,
): string {
  return [
    'sequence-gap',
    `previous=${previousEventId ?? 'unknown'}`,
    `next=${event.id}`,
    `expected=${expectedSequence}`,
    `actual=${actualSequence}`,
  ].join('|');
}

export function uniqueRenderedKey(baseKey: string, occurrences: Map<string, number>): string {
  const occurrence = occurrences.get(baseKey) ?? 0;
  occurrences.set(baseKey, occurrence + 1);
  return occurrence === 0 ? baseKey : `${baseKey}|occurrence=${occurrence + 1}`;
}

export function detailsIdForKey(instanceId: string, key: string): string {
  return `${instanceId}-details-${hashString(key)}`;
}

function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return (hash >>> 0).toString(36);
}
