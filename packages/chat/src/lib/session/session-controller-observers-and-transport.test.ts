import { throwingRejectionOf } from '@lostgradient/testing';
import { describe, expect, test } from 'bun:test';
import { createConversationHistory } from '../components/chat/builders.ts';
import type { ConversationHistory } from '../components/chat/conversation-model.ts';
import { createChatSessionController } from './session-controller.ts';
import type { ChatStreamEvent } from './stream-event-codec.ts';

async function* events(values: ChatStreamEvent[]): AsyncGenerator<ChatStreamEvent> {
  yield* values;
}

function makeTypedController(transport: () => Promise<AsyncIterable<ChatStreamEvent>>) {
  let conversation: ConversationHistory = createConversationHistory({ id: 'typed' });
  return createChatSessionController({
    getConversation: () => conversation,
    setConversation: (next) => {
      conversation = next;
    },
    transport,
  });
}

describe('chat session controller', () => {
  test('isolates throwing stream observers and unsubscribe removes them', async () => {
    let conversation = createConversationHistory({ id: 'observer-errors' });
    const errors: unknown[] = [];
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => events([{ type: 'text', text: 'ok' }]),
      hooks: {
        onError: (error) => {
          errors.push(error);
          throw new Error('error observer failed');
        },
      },
    });
    const handler = {
      onMessage: () => undefined,
      onTypingChange: () => undefined,
      onReadReceipt: () => undefined,
      onStreamBegin: () => {
        throw new Error('begin observer failed');
      },
      onTokenPush: () => undefined,
      onStreamEnd: () => undefined,
    };
    const unsubscribe = controller.adapter.subscribe?.('observer-errors', handler);
    unsubscribe?.();
    await controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []);
    expect(errors).toHaveLength(0);
    controller.adapter.subscribe?.('observer-errors', handler);
    await controller.adapter.sendMessage({ role: 'user', content: 'again' }, []);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('isolates throwing tool observers and continues the turn', async () => {
    let conversation = createConversationHistory({ id: 'tool-observer-errors' });
    let calls = 0;
    const errors: unknown[] = [];
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () =>
        calls++ === 0
          ? events([
              { type: 'tool_call', id: 'call', name: 'read', arguments: {} },
              { type: 'tool_result', callId: 'call', outcome: 'success', content: 'ok' },
            ])
          : events([{ type: 'text', text: 'continued' }]),
      hooks: {
        onToolResult: () => {
          throw new Error('tool observer failed');
        },
        onError: (error) => {
          errors.push(error);
          throw new Error('error observer failed');
        },
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'read' }, []);
    expect(calls).toBe(2);
    expect(errors).toHaveLength(1);
  });

  test('rejects an approval whose hook returns undefined', async () => {
    let conversation = createConversationHistory({ id: 'undefined-approval' });
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () =>
        events([
          { type: 'tool_call', id: 'call', name: 'write', arguments: {} },
          {
            type: 'tool_result',
            callId: 'call',
            outcome: 'action_required',
            content: null,
            action: {
              type: 'approval',
              message: 'Approve this tool call',
              risk: 'high',
              operation: { kind: 'command', command: 'echo approval', argsPreview: { ok: true } },
              policyVersion: 'test-policy',
              idempotencyKey: 'test-approval',
            },
          },
        ]),
      hooks: { resolveToolApproval: async () => undefined },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'write' }, []);
    await Promise.resolve(
      expect(
        await throwingRejectionOf(
          controller.adapter.resolveToolApproval?.('call', {
            decision: 'approve',
            remember: false,
          }),
        ),
      ).toThrow('must return'),
    );
  });

  test('emits stream end on abort and transport error', async () => {
    let conversation = createConversationHistory({ id: 'terminal-events' });
    const ends: string[] = [];
    let rejectStream!: (error: Error) => void;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async ({ signal }) =>
        new Promise<AsyncIterable<ChatStreamEvent>>((resolve) => {
          signal.addEventListener(
            'abort',
            () => resolve(events([{ type: 'text', text: 'partial' }])),
            { once: true },
          );
          rejectStream = () =>
            resolve(
              (async function* () {
                yield* [] as ChatStreamEvent[];
                throw new Error('broken');
              })(),
            );
        }),
    });
    controller.adapter.subscribe?.('terminal-events', {
      onMessage: () => undefined,
      onTypingChange: () => undefined,
      onReadReceipt: () => undefined,
      onStreamBegin: () => undefined,
      onTokenPush: () => undefined,
      onStreamEnd: () => ends.push('end'),
    });
    const pending = controller.adapter.sendMessage({ role: 'user', content: 'stop' }, []);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await controller.adapter.stopGenerating?.('user');
    await pending;
    expect(ends).toEqual(['end']);
    void rejectStream;
  });

  test('holds a typed event iterable to the same stream guard as NDJSON bytes', async () => {
    // A versioned stream that ends without a terminal frame.
    const unterminated = makeTypedController(async () =>
      events([{ type: 'text', text: 'hello', wireVersion: 1, sequence: 0 }]),
    );
    await Promise.resolve(
      expect(
        await throwingRejectionOf(
          unterminated.adapter.sendMessage({ role: 'user', content: 'hi' }, []),
        ),
      ).toThrow('Invalid chat stream event: stream ended without a terminal frame'),
    );

    // A frame after the terminal frame.
    const afterTerminal = makeTypedController(async () =>
      events([
        { type: 'run.aborted', wireVersion: 1, sequence: 0 },
        { type: 'text', text: 'late', wireVersion: 1, sequence: 1 },
      ]),
    );
    await Promise.resolve(
      expect(
        await throwingRejectionOf(
          afterTerminal.adapter.sendMessage({ role: 'user', content: 'hi' }, []),
        ),
      ).toThrow('Invalid chat stream event: frame arrived after the terminal frame'),
    );

    // A bare frame following a versioned one.
    const mixed = makeTypedController(async () =>
      events([
        { type: 'text', text: 'hello', wireVersion: 1, sequence: 0 },
        { type: 'text', text: 'bare' },
      ]),
    );
    await Promise.resolve(
      expect(
        await throwingRejectionOf(mixed.adapter.sendMessage({ role: 'user', content: 'hi' }, [])),
      ).toThrow('Invalid chat stream event'),
    );
  });
});
