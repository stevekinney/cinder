import { describe, expect, test } from 'bun:test';
import { createConversationHistory } from 'conversationalist';
import { hostileEvent } from './stream-event-codec-test-helpers.ts';
import type { ChatStreamEvent } from './stream-event-codec.ts';
import { encodeChatStreamEvent } from './stream-event-codec.ts';

describe('encoder refuses to emit frames its decoder would reject', () => {
  const envelope = { wireVersion: 1 as const, sequence: 1 };

  test('rejects an unsupported discriminator instead of emitting "undefined"', () => {
    // A JavaScript caller, or any runtime-cast value, can arrive with a type
    // the union does not contain. Falling through the switch returned
    // `undefined`, and `JSON.stringify(undefined)` is `undefined` — so the
    // encoder emitted the literal frame `undefined\n`.
    const smuggled = hostileEvent({ type: 'run.exploded', ...envelope });
    expect(() => encodeChatStreamEvent(smuggled)).toThrow(/unsupported type run\.exploded/);
  });

  test('rejects a run error whose kind or code is outside the vocabulary', () => {
    const base = { name: 'AgentRunError', message: 'boom' };
    const badKind = hostileEvent({
      type: 'run.error',
      error: { ...base, kind: 'meltdown', code: 'UNKNOWN' },
      ...envelope,
    });
    const badCode = hostileEvent({
      type: 'run.error',
      error: { ...base, kind: 'generate', code: 'KABOOM' },
      ...envelope,
    });

    expect(() => encodeChatStreamEvent(badKind)).toThrow(/unsupported run error kind meltdown/);
    expect(() => encodeChatStreamEvent(badCode)).toThrow(/unsupported run error code KABOOM/);
  });

  test('rejects a run error whose name or message is not a string', () => {
    const event = hostileEvent({
      type: 'run.error',
      error: { name: 'AgentRunError', message: 42, kind: 'generate', code: 'UNKNOWN' },
      ...envelope,
    });

    expect(() => encodeChatStreamEvent(event)).toThrow(/name and message must be strings/);
  });

  test('refuses a completed conversation carrying extra top-level fields', () => {
    const conversation = {
      ...createConversationHistory({ id: 'c1' }),
      // Structural typing lets this ride along on an assigned variable.
      providerTrace: { apiKeyHint: 'sk-should-never-cross-the-wire' },
    };
    const event = hostileEvent({
      type: 'run.completed',
      conversation,
      content: 'done',
      usage: { prompt: 1, completion: 1, total: 2 },
      finishReason: 'stop',
      ...envelope,
    });

    // `isConversationHistory` rejects extra top-level keys, not just missing
    // required ones, so validating IS the projection here — the frame never
    // gets built and the metadata never reaches the wire.
    expect(() => encodeChatStreamEvent(event)).toThrow(/not a valid ConversationHistory/);

    const clean = hostileEvent({
      ...event,
      conversation: createConversationHistory({ id: 'c1' }),
    });
    expect(encodeChatStreamEvent(clean)).toContain('"id":"c1"');
  });

  const completedWith = (conversation: unknown): ChatStreamEvent =>
    hostileEvent({
      type: 'run.completed',
      conversation,
      content: 'done',
      usage: { prompt: 1, completion: 1, total: 2 },
      finishReason: 'stop',
      ...envelope,
    });

  test('refuses a completed conversation carrying a non-enumerable toJSON hook', () => {
    // A non-enumerable own property is invisible to the strict key check but
    // is exactly what JSON.stringify consults, so the wire would carry the
    // hook's return value instead of the validated history. (Histories are
    // frozen, so the hook goes on an unfrozen structural copy.)
    const conversation = { ...createConversationHistory({ id: 'c1' }) };
    Object.defineProperty(conversation, 'toJSON', {
      value: () => ({ leaked: 'sk-should-never-cross-the-wire' }),
      enumerable: false,
    });
    expect(() => encodeChatStreamEvent(completedWith(conversation))).toThrow(
      'Invalid chat stream event: conversation carries a toJSON serialization hook',
    );
  });

  test('refuses a completed conversation whose prototype carries a toJSON hook', () => {
    const conversation = Object.assign(
      Object.create({ toJSON: () => ({ leaked: 'sk-should-never-cross-the-wire' }) }),
      createConversationHistory({ id: 'c1' }),
    );
    // Either the schema guard (which insists on a plain object) or the
    // projection refuses it — what matters is that the hook never runs.
    expect(() => encodeChatStreamEvent(completedWith(conversation))).toThrow(
      /not a valid ConversationHistory|carries a toJSON serialization hook/,
    );
  });

  test('refuses a toJSON hook nested inside a completed conversation', () => {
    const history = createConversationHistory({ id: 'c1' });
    const conversation = { ...history, metadata: { ...history.metadata } };
    Object.defineProperty(conversation.metadata, 'toJSON', {
      value: () => ({ leaked: 'sk-should-never-cross-the-wire' }),
      enumerable: false,
    });
    expect(() => encodeChatStreamEvent(completedWith(conversation))).toThrow(
      'Invalid chat stream event: conversation.metadata carries a toJSON serialization hook',
    );
  });
});
