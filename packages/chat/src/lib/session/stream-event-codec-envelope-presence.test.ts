import { describe, expect, test } from 'bun:test';
import { hostileEvent } from './stream-event-codec-test-helpers.ts';
import { encodeChatStreamEvent } from './stream-event-codec.ts';

describe('encoder treats present envelope keys as an attempted envelope', () => {
  test('rejects a legacy event whose envelope keys are present but undefined', () => {
    // A runtime cast or a spread of a partial object can leave both keys
    // present with `undefined` values. `readWireEnvelope` rejects that frame
    // on key presence, so the encoder must not quietly downgrade it to bare.
    const event = hostileEvent({
      type: 'text',
      text: 'hi',
      wireVersion: undefined,
      sequence: undefined,
    });
    expect(() => encodeChatStreamEvent(event)).toThrow(
      'Invalid chat stream event: cannot encode a malformed wire envelope',
    );
  });

  test('still encodes a legacy event with no envelope keys at all', () => {
    const encoded = encodeChatStreamEvent({ type: 'text', text: 'hi' });
    expect(JSON.parse(encoded)).toEqual({ type: 'text', text: 'hi' });
  });
});
