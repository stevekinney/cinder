import { describe, expect, test } from 'bun:test';
import { createConversationHistory } from '../components/chat/builders.ts';
import { createChatSessionController } from './session-controller.ts';
import type { ChatStreamEvent } from './stream-event-codec.ts';

async function* events(values: ChatStreamEvent[]): AsyncGenerator<ChatStreamEvent> {
  yield* values;
}

describe('chat session controller', () => {
  test('stop cancels the active stream and transitions streaming hooks', async () => {
    let conversation = createConversationHistory({ id: 'stop' });
    const transitions: boolean[] = [];
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async ({ signal }) => {
        async function* partial(): AsyncGenerator<ChatStreamEvent> {
          yield { type: 'text', text: 'partial' };
          await new Promise<void>((resolve) => {
            signal.addEventListener('abort', () => resolve(), { once: true });
          });
        }
        return partial();
      },
      hooks: { onStreamingChange: (value) => transitions.push(value) },
    });
    const pending = controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await controller.adapter.stopGenerating?.(conversation.ids[0]!);
    await pending;
    await controller.stop();
    expect(transitions).toEqual([true, false]);
    expect(Object.values(conversation.messages).at(-1)?.content).toBe('partial');
  });

  test('awaiting stop waits for the active run before allowing the next send', async () => {
    let conversation = createConversationHistory({ id: 'stop-settlement' });
    let calls = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async ({ signal }) => {
        calls += 1;
        if (calls === 1)
          return new Promise<AsyncIterable<ChatStreamEvent>>((resolve) =>
            signal.addEventListener('abort', () => resolve(events([])), { once: true }),
          );
        return events([{ type: 'text', text: 'next' }]);
      },
    });
    const first = controller.adapter.sendMessage({ role: 'user', content: 'first' }, []);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await controller.adapter.stopGenerating?.('in-flight-assistant');
    await first;
    await controller.adapter.sendMessage({ role: 'user', content: 'second' }, []);
    expect(calls).toBe(2);
  });

  test('streaming observers cannot interrupt the session lifecycle', async () => {
    let conversation = createConversationHistory({ id: 'observer-errors' });
    const observedErrors: unknown[] = [];
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => events([{ type: 'text', text: 'still completes' }]),
      hooks: {
        onStreamingChange: () => {
          throw new Error('observer failed');
        },
        onError: (error) => {
          observedErrors.push(error);
          throw new Error('error observer failed');
        },
      },
    });

    await controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []);

    expect(observedErrors).toHaveLength(2);
    expect(observedErrors.every((error) => error instanceof Error)).toBe(true);
    expect(Object.values(conversation.messages).at(-1)?.content).toBe('still completes');
  });

  test('preserves partial output when an aborted transport throws', async () => {
    let conversation = createConversationHistory({ id: 'abort-error' });
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async ({ signal }) => {
        async function* partialThenAbort(): AsyncGenerator<ChatStreamEvent> {
          yield { type: 'text', text: 'partial' };
          await new Promise<void>((resolve) => {
            signal.addEventListener('abort', () => resolve(), { once: true });
          });
          throw new Error('transport aborted');
        }
        return partialThenAbort();
      },
    });
    const pending = controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await controller.adapter.stopGenerating?.(conversation.ids[0]!);
    await pending;
    expect(Object.values(conversation.messages).at(-1)?.content).toBe('partial');
  });

  test('removes an empty assistant placeholder when an aborted transport throws', async () => {
    let conversation = createConversationHistory({ id: 'abort-empty-error' });
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async ({ signal }) => {
        async function* abortBeforeText(): AsyncGenerator<ChatStreamEvent> {
          yield* [] as ChatStreamEvent[];
          await new Promise<void>((resolve) => {
            signal.addEventListener('abort', () => resolve(), { once: true });
          });
          throw new Error('transport aborted');
        }
        return abortBeforeText();
      },
    });
    const pending = controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await controller.adapter.stopGenerating?.(conversation.ids[0]!);
    await pending;
    expect(conversation.ids).toHaveLength(1);
  });
});
