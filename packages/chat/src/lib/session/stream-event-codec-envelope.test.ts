import { describe, expect, test } from 'bun:test';
import { hostileEvent, inheritedRecord } from './stream-event-codec-test-helpers.ts';
import { decodeChatStreamEvent, encodeChatStreamEvent } from './stream-event-codec.ts';

describe('wire envelope (CIN-507)', () => {
  test('rejects an unsupported wireVersion on a legacy member', () => {
    expect(() =>
      decodeChatStreamEvent({ type: 'text', text: 'hi', wireVersion: 3, sequence: 0 }),
    ).toThrow('Invalid chat stream event');
  });

  test('rejects an unsupported wireVersion on a new member', () => {
    expect(() =>
      decodeChatStreamEvent({
        type: 'stream:text-delta',
        content: 'h',
        accumulated: 'h',
        wireVersion: 3,
        sequence: 0,
      }),
    ).toThrow('Invalid chat stream event');
  });

  test('accepts wire version 2 on a member that predates it', () => {
    expect(
      decodeChatStreamEvent({ type: 'text', text: 'hi', wireVersion: 2, sequence: 0 }),
    ).toEqual({ type: 'text', text: 'hi', wireVersion: 2, sequence: 0 });
  });

  test('new members require the envelope — missing sequence is rejected', () => {
    expect(() =>
      decodeChatStreamEvent({
        type: 'stream:text-delta',
        content: 'h',
        accumulated: 'h',
        wireVersion: 1,
      }),
    ).toThrow('Invalid chat stream event');
  });

  test('new members require the envelope — missing wireVersion is rejected', () => {
    expect(() =>
      decodeChatStreamEvent({
        type: 'stream:text-delta',
        content: 'h',
        accumulated: 'h',
        sequence: 0,
      }),
    ).toThrow('Invalid chat stream event');
  });

  test('an inherited envelope key is not part of the frame', () => {
    // `in` would see a polluted prototype's `wireVersion`; only own keys count.
    const frame = inheritedRecord({ wireVersion: 1, sequence: 0 });
    frame['type'] = 'text';
    frame['text'] = 'hi';
    const decoded = decodeChatStreamEvent(frame);
    expect(decoded.type).toBe('text');
    expect(Object.hasOwn(decoded, 'wireVersion')).toBe(false);
    expect(Object.hasOwn(decoded, 'sequence')).toBe(false);
    // The encoder applies the same rule, so the frame round-trips as bare.
    expect(encodeChatStreamEvent(hostileEvent(frame))).toBe('{"type":"text","text":"hi"}\n');
  });

  test('returns the sequence it validated when a getter answers differently per read', () => {
    const answers = [0, Number.NaN];
    const frame = { type: 'text', text: 'hi', wireVersion: 1 } as Record<string, unknown>;
    Object.defineProperty(frame, 'sequence', {
      enumerable: true,
      get: () => answers.shift() ?? Number.NaN,
    });
    const decoded = decodeChatStreamEvent(frame);
    expect(decoded.sequence).toBe(0);
  });

  test('an inherited type discriminator is not a frame', () => {
    // Serializing this object yields only the envelope, which the NDJSON
    // path rejects; the typed path must not accept what the wire would not.
    const frame = inheritedRecord({ type: 'run.aborted' });
    frame['wireVersion'] = 1;
    frame['sequence'] = 0;
    expect(() => decodeChatStreamEvent(frame)).toThrow('Invalid chat stream event');
  });

  test('rejects a legacy member carrying only wireVersion', () => {
    expect(() => decodeChatStreamEvent({ type: 'text', text: 'hi', wireVersion: 1 })).toThrow(
      'Invalid chat stream event',
    );
  });

  test('rejects a legacy member carrying only sequence', () => {
    expect(() => decodeChatStreamEvent({ type: 'text', text: 'hi', sequence: 0 })).toThrow(
      'Invalid chat stream event',
    );
  });

  test('rejects a sequence above Number.MAX_SAFE_INTEGER', () => {
    expect(() =>
      decodeChatStreamEvent({
        type: 'stream:text-delta',
        content: 'h',
        accumulated: 'h',
        wireVersion: 1,
        sequence: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toThrow('Invalid chat stream event');
  });

  test('accepts a sequence at exactly Number.MAX_SAFE_INTEGER', () => {
    const event = {
      type: 'stream:text-delta' as const,
      content: 'h',
      accumulated: 'h',
      wireVersion: 1 as const,
      sequence: Number.MAX_SAFE_INTEGER,
    };
    expect(decodeChatStreamEvent(encodeChatStreamEvent(event))).toEqual(event);
  });
});

test('still throws on a genuinely unrecognized type', () => {
  expect(() =>
    decodeChatStreamEvent({ type: 'not-a-real-event', wireVersion: 1, sequence: 0 }),
  ).toThrow('Invalid chat stream event');
});
