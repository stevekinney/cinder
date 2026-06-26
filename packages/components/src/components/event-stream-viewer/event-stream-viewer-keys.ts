import type { StreamEvent, StreamReconnectedBoundary } from './event-stream-viewer.types.ts';

export function streamEventKey(event: StreamEvent): string {
  const parts = [keyType('event'), keyField('id', event.id)];
  if (typeof event.sequence === 'number') parts.push(keyField('sequence', event.sequence));
  return parts.join('|');
}

export function reconnectedBoundaryKey(boundary: StreamReconnectedBoundary): string {
  return [keyType('reconnected'), keyField('id', boundary.id)].join('|');
}

export function sequenceGapKey(
  previousEventId: string | undefined,
  event: StreamEvent,
  expectedSequence: number,
  actualSequence: number,
): string {
  return [
    keyType('sequence-gap'),
    previousEventId === undefined
      ? keyField('previous-missing', true)
      : keyField('previous', previousEventId),
    keyField('next', event.id),
    keyField('expected', expectedSequence),
    keyField('actual', actualSequence),
  ].join('|');
}

export function uniqueRenderedKey(baseKey: string, occurrences: Map<string, number>): string {
  const occurrence = occurrences.get(baseKey) ?? 0;
  occurrences.set(baseKey, occurrence + 1);
  return occurrence === 0 ? baseKey : `${baseKey}|occurrence=${occurrence + 1}`;
}

export function detailsIdForKey(instanceId: string, key: string): string {
  return `${escapeDomIdPart(instanceId)}-details-${hashString(key)}-${hashString(reverseString(key))}-${key.length}`;
}

function keyType(type: string): string {
  return keyField('type', type);
}

function keyField(name: string, value: string | number | boolean): string {
  const stringValue = String(value);
  return `${name.length}:${name}:${stringValue.length}:${stringValue}`;
}

function escapeDomIdPart(value: string): string {
  let result = '';
  for (const character of value) {
    result += /^[A-Za-z0-9_-]$/.test(character)
      ? character
      : `_${character.codePointAt(0)?.toString(16) ?? '0'}_`;
  }
  return result === '' ? 'empty' : result;
}

function reverseString(value: string): string {
  let result = '';
  for (const character of value) {
    result = character + result;
  }
  return result;
}

function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return (hash >>> 0).toString(36);
}
