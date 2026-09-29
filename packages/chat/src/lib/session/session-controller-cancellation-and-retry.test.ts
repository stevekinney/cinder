import { throwingRejectionOf } from '@lostgradient/testing';
import { describe, expect, test } from 'bun:test';
import { createConversationHistory } from '../components/chat/builders.ts';
import type { ConversationHistory } from '../components/chat/conversation-model.ts';
import { createChatSessionController } from './session-controller.ts';
import type { ChatStreamEvent } from './stream-event-codec.ts';

async function* events(values: ChatStreamEvent[]): AsyncGenerator<ChatStreamEvent> {
  yield* values;
}

describe('chat session controller', () => {
  test('aborts the transport signal when the typed stream guard rejects', async () => {
    let conversation: ConversationHistory = createConversationHistory({ id: 'typed' });
    let signal: AbortSignal | undefined;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async (request) => {
        signal = request.signal;
        return events([
          { type: 'text', text: 'hello', wireVersion: 1, sequence: 0 },
          { type: 'text', text: 'bare' },
        ]);
      },
    });
    await Promise.resolve(
      expect(
        await throwingRejectionOf(
          controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []),
        ),
      ).toThrow('Invalid chat stream event'),
    );
    // A transport whose provider work hangs off `request.signal` would otherwise
    // keep running after the command has already failed.
    expect(signal?.aborted).toBe(true);
  });

  test('aborts the transport before awaiting its cleanup when a frame is invalid', async () => {
    let conversation: ConversationHistory = createConversationHistory({ id: 'typed' });
    let signal: AbortSignal | undefined;
    let cleanupSawAbort = false;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async (request) => {
        signal = request.signal;
        // A transport whose cleanup waits on the signal — the shape that
        // deadlocks if the abort cannot be raised until the rejection has
        // already propagated through this `finally`.
        return (async function* () {
          try {
            yield { type: 'text', text: 'hello', wireVersion: 1, sequence: 0 };
            yield { type: 'text', text: 'bare' };
          } finally {
            cleanupSawAbort = request.signal.aborted;
            await new Promise<void>((resolve) => {
              if (request.signal.aborted) resolve();
              else request.signal.addEventListener('abort', () => resolve(), { once: true });
            });
          }
        })();
      },
    });
    await Promise.resolve(
      expect(
        await throwingRejectionOf(
          controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []),
        ),
      ).toThrow('Invalid chat stream event'),
    );
    expect(cleanupSawAbort).toBe(true);
    expect(signal?.aborted).toBe(true);
  });

  test('a malformed frame arriving after stopGenerating is still a cancellation', async () => {
    let conversation: ConversationHistory = createConversationHistory({ id: 'typed' });
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () =>
        (async function* () {
          yield { type: 'text', text: 'hello', wireVersion: 1, sequence: 0 };
          // The user stops while this queued frame is already in flight; it
          // fails validation, but the turn was cancelled, not broken.
          void controller.adapter.stopGenerating?.('user');
          yield { type: 'text', text: 'bare' };
        })(),
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []);
  });

  test('marks the initiating message failed when transport rejects', async () => {
    let conversation: ConversationHistory = createConversationHistory({ id: 'test' });
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        throw new Error('offline');
      },
    });
    await Promise.resolve(
      expect(
        await throwingRejectionOf(
          controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []),
        ),
      ).toThrow('offline'),
    );
    expect(Object.values(conversation.messages)[0]?.metadata['_deliveryStatus']).toBe('failed');
  });

  test('retries a failed message and clears its delivery marker', async () => {
    let conversation = createConversationHistory({ id: 'retry' });
    let attempts = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('offline');
        return events([{ type: 'text', text: 'back' }]);
      },
    });
    await Promise.resolve(
      expect(
        await throwingRejectionOf(
          controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []),
        ),
      ).toThrow(),
    );
    const messageId = conversation.ids[0]!;
    await controller.adapter.retryMessage?.(messageId);
    expect(conversation.messages[messageId]?.metadata['_deliveryStatus']).toBeUndefined();
  });
});
