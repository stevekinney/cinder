import { describe, expect, test } from 'bun:test';
import type { ChatStreamEvent } from './stream-event-codec.ts';
import { encodeChatStreamEvent } from './stream-event-codec.ts';

describe('legacy envelope is all-or-nothing at the type level', () => {
  test('accepts a bare legacy member and a fully-enveloped one', () => {
    const bare: ChatStreamEvent = { type: 'text', text: 'x' };
    const enveloped: ChatStreamEvent = { type: 'text', text: 'x', wireVersion: 1, sequence: 1 };

    expect(encodeChatStreamEvent(bare)).toContain('"text":"x"');
    expect(encodeChatStreamEvent(enveloped)).toContain('"wireVersion":1');
  });

  test('rejects a half-envelope at compile time', () => {
    // A plain `T` branch would ACCEPT this: excess-property checking does not
    // reject `wireVersion`, because that property is known to another member
    // of the same union. The `?: never` keys on the bare branch are what make
    // it match neither branch. If this stops erroring, the runtime contract
    // and the public type have silently diverged again.
    // @ts-expect-error — `wireVersion` without `sequence` is not a valid frame.
    const halfVersion: ChatStreamEvent = { type: 'text', text: 'x', wireVersion: 1 };
    // @ts-expect-error — `sequence` without `wireVersion` is not a valid frame.
    const halfSequence: ChatStreamEvent = { type: 'text', text: 'x', sequence: 1 };

    expect(() => encodeChatStreamEvent(halfVersion)).toThrow();
    expect(() => encodeChatStreamEvent(halfSequence)).toThrow();
  });
});
