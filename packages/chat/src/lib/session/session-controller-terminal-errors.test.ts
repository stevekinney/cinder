import { rejectionOf } from '@lostgradient/testing';
import { describe, expect, test } from 'bun:test';
import { createConversationHistory } from '../components/chat/builders.ts';
import type { ConversationHistory } from '../components/chat/conversation-model.ts';
import { ChatRunFailureError } from './session-controller-support.ts';
import { createChatSessionController } from './session-controller.ts';
import type { ChatStreamEvent } from './stream-event-codec.ts';

async function* events(values: ChatStreamEvent[]): AsyncGenerator<ChatStreamEvent> {
  yield* values;
}

function requireRunFailure(value: unknown): ChatRunFailureError {
  if (value instanceof ChatRunFailureError) return value;
  throw new Error('Expected a ChatRunFailureError');
}

describe('chat session controller', () => {
  describe('terminal error frames', () => {
    const runError = {
      name: 'AgentRunError',
      message: 'The provider rejected the request.',
      kind: 'generate' as const,
      code: 'UNKNOWN' as const,
      retryable: true,
    };

    async function sendThrough(
      values: ChatStreamEvent[],
    ): Promise<{ conversation: ConversationHistory; reported: unknown[]; thrown: unknown }> {
      let conversation = createConversationHistory({ id: 'test' });
      const reported: unknown[] = [];
      const controller = createChatSessionController({
        getConversation: () => conversation,
        setConversation: (next) => {
          conversation = next;
        },
        transport: async () => events(values),
        hooks: { onError: (error) => reported.push(error) },
      });
      let thrown: unknown;
      try {
        await controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []);
      } catch (error) {
        thrown = error;
      }
      return { conversation, reported, thrown };
    }

    test('reports a run.error through onError with the frame intact', async () => {
      // Before this reducer existed the frame was decoded and dropped, so a
      // provider failure mid-stream never reached `onError` at all.
      const { reported, thrown } = await sendThrough([
        { type: 'text', text: 'partial', wireVersion: 1, sequence: 1 },
        { type: 'run.error', error: runError, wireVersion: 1, sequence: 2 },
      ]);
      expect(reported).toHaveLength(1);
      expect(reported[0]).toBeInstanceOf(ChatRunFailureError);
      expect(thrown).toBe(reported[0]);
      const failure = requireRunFailure(reported[0]);
      // The whole point of the frame: a host can render what it was told
      // rather than a flattened string.
      expect(failure.runError).toEqual(runError);
      expect(failure.message).toBe(runError.message);
    });

    test('leaves no dangling assistant row behind a failed turn', async () => {
      const { conversation } = await sendThrough([
        { type: 'text', text: 'partial', wireVersion: 1, sequence: 1 },
        { type: 'run.error', error: runError, wireVersion: 1, sequence: 2 },
      ]);
      // The streaming placeholder is cancelled rather than finalized: a half
      // sentence frozen in the transcript reads as an answer the assistant
      // gave, which it did not.
      const contents = Object.values(conversation.messages).map((message) => message.content);
      expect(contents).not.toContain('partial');
      expect(contents).toEqual(['hi']);
    });

    test('treats run.tripwire the same way', async () => {
      const tripwire = { ...runError, code: 'TRIPWIRE' as const, retryable: false };
      const { reported, conversation } = await sendThrough([
        { type: 'run.tripwire', error: tripwire, wireVersion: 1, sequence: 1 },
      ]);
      expect(requireRunFailure(reported[0]).runError).toEqual(tripwire);
      expect(Object.values(conversation.messages).map((message) => message.content)).toEqual([
        'hi',
      ]);
    });

    test('aborts the transport before throwing, so cleanup cannot deadlock', async () => {
      // A transport whose cleanup waits on its own `AbortSignal` is the
      // failure mode: throwing out of a `for await` invokes the iterator's
      // `return()` and AWAITS it, so cleanup that waits for an abort issued
      // only in the catch block would never be reached. `sendMessage` would
      // hang for good rather than reporting the failure it already had.
      let cleanupSawAbort = false;
      const transport = async ({ signal }: { signal: AbortSignal }) => {
        async function* stream(): AsyncGenerator<ChatStreamEvent> {
          try {
            yield { type: 'run.error', error: runError, wireVersion: 1, sequence: 1 };
          } finally {
            // Resolves only once the signal is aborted, which is exactly what
            // a real cleanup awaiting in-flight work would do.
            await new Promise<void>((resolve) => {
              if (signal.aborted) {
                cleanupSawAbort = true;
                resolve();
                return;
              }
              signal.addEventListener('abort', () => {
                cleanupSawAbort = true;
                resolve();
              });
            });
          }
        }
        return stream();
      };

      let conversation = createConversationHistory({ id: 'test' });
      const controller = createChatSessionController({
        getConversation: () => conversation,
        setConversation: (next) => {
          conversation = next;
        },
        transport,
        hooks: { onError: () => undefined },
      });

      // The assertion is that this settles at all. Before the abort moved
      // ahead of the throw, it never did.
      await Promise.resolve(
        expect(
          await rejectionOf(controller.adapter.sendMessage({ role: 'user', content: 'hi' }, [])),
        ).toBeInstanceOf(ChatRunFailureError),
      );
      expect(cleanupSawAbort).toBe(true);
    });

    test('does not treat run.aborted as a failure', async () => {
      // An abort is a user decision, carries no error, and must not reach the
      // error path — a banner on every Stop press would be wrong.
      const { reported, thrown } = await sendThrough([
        { type: 'text', text: 'partial', wireVersion: 1, sequence: 1 },
        { type: 'run.aborted', reason: 'user stopped', wireVersion: 1, sequence: 2 },
      ]);
      expect(reported).toEqual([]);
      expect(thrown).toBeUndefined();
    });
  });
});
