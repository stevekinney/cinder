import { expect } from 'bun:test';
import type { ChatStreamEvent } from './stream-event-codec.ts';

/** Builds runtime-hostile frames without weakening the public event type. */
export function hostileEvent(fields: Record<string, unknown>): ChatStreamEvent {
  const base: ChatStreamEvent = Object.create(Object.getPrototypeOf(fields));
  for (const key of Reflect.ownKeys(fields)) {
    const descriptor = Object.getOwnPropertyDescriptor(fields, key);
    if (descriptor !== undefined) Object.defineProperty(base, key, descriptor);
  }
  return base;
}

export function inheritedEvent(fields: Record<string, unknown>): ChatStreamEvent {
  const event: ChatStreamEvent = Object.create(fields);
  return event;
}

export function inheritedRecord(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.create(fields);
}

export async function expectRejected(
  operation: PromiseLike<unknown>,
  expected?: string | RegExp,
): Promise<void> {
  let rejection: unknown;
  try {
    await operation;
  } catch (error) {
    rejection = error;
  }
  if (rejection === undefined) throw new Error('Expected operation to reject');
  const message =
    rejection instanceof Error
      ? rejection.message
      : typeof rejection === 'string'
        ? rejection
        : (JSON.stringify(rejection) ?? '');
  if (expected === undefined) expect(rejection).toBeDefined();
  else if (typeof expected === 'string') expect(message).toContain(expected);
  else expect(message).toMatch(expected);
}
