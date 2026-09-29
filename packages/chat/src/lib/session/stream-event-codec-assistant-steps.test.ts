import { describe, expect, test } from 'bun:test';
import {
  decodeChatStreamEvent,
  encodeChatStreamEvent,
  type ChatStreamEvent,
} from './stream-event-codec.ts';

/**
 * `assistant.step.*` delineates one response's model steps so a client can
 * put each step's text in its own row instead of folding a follow-up reply
 * back into a row that already precedes the tool activity it is replying
 * about.
 *
 * The identifier is the HOST'S, taken from Operative's `StreamingHandle`
 * before the provider emits anything — never a provider block id, and never
 * something the client minted. These frames are the only way it crosses.
 */
describe('assistant.step.* frames', () => {
  test('round-trips a started frame carrying the host message identifier', () => {
    const event: ChatStreamEvent = {
      type: 'assistant.step.started',
      step: 0,
      messageId: 'message-from-the-host',
      wireVersion: 2,
      sequence: 3,
    };
    expect(decodeChatStreamEvent(JSON.parse(encodeChatStreamEvent(event)))).toEqual(event);
  });

  test('round-trips a completed frame', () => {
    const event: ChatStreamEvent = {
      type: 'assistant.step.completed',
      step: 1,
      messageId: 'message-from-the-host',
      wireVersion: 2,
      sequence: 4,
    };
    expect(decodeChatStreamEvent(JSON.parse(encodeChatStreamEvent(event)))).toEqual(event);
  });

  test('refuses a step frame at wire version 1', () => {
    expect(() =>
      decodeChatStreamEvent({
        type: 'assistant.step.started',
        step: 0,
        messageId: 'm',
        wireVersion: 1,
        sequence: 0,
      }),
    ).toThrow('Invalid chat stream event');
  });

  test('refuses a step frame with no envelope at all', () => {
    expect(() =>
      decodeChatStreamEvent({ type: 'assistant.step.started', step: 0, messageId: 'm' }),
    ).toThrow('Invalid chat stream event');
  });

  test('refuses a missing or non-string message identifier', () => {
    expect(() =>
      decodeChatStreamEvent({
        type: 'assistant.step.started',
        step: 0,
        wireVersion: 2,
        sequence: 0,
      }),
    ).toThrow('Invalid chat stream event');
    expect(() =>
      decodeChatStreamEvent({
        type: 'assistant.step.started',
        step: 0,
        messageId: 7,
        wireVersion: 2,
        sequence: 0,
      }),
    ).toThrow('Invalid chat stream event');
  });

  test('refuses a step that is not a non-negative safe integer', () => {
    for (const step of [-1, 1.5, Number.MAX_SAFE_INTEGER + 2, '0']) {
      expect(() =>
        decodeChatStreamEvent({
          type: 'assistant.step.started',
          step,
          messageId: 'm',
          wireVersion: 2,
          sequence: 0,
        }),
      ).toThrow('Invalid chat stream event');
    }
  });

  test('still refuses an unsupported wire version', () => {
    expect(() =>
      decodeChatStreamEvent({ type: 'text', text: 'hi', wireVersion: 3, sequence: 0 }),
    ).toThrow('Invalid chat stream event');
  });

  test('a version 2 envelope is preserved rather than rewritten to version 1', () => {
    const decoded = decodeChatStreamEvent({
      type: 'run.aborted',
      wireVersion: 2,
      sequence: 9,
    });
    expect(decoded.wireVersion).toBe(2);
    expect(JSON.parse(encodeChatStreamEvent(decoded))).toMatchObject({ wireVersion: 2 });
  });
});
