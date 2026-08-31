import { describe, expect, test } from 'bun:test';
import {
  appendAssistantMessage,
  appendToolCall,
  appendToolResult,
  appendUserMessage,
  createConversationHistory,
} from '../components/chat/builders.ts';
import type { ConversationHistory } from '../components/chat/conversation-model.ts';
import type { ChatAttachment } from '../components/chat/input/chat-attachment.ts';
import { createChatSessionController } from './session-controller.ts';
import type { ChatStreamEvent } from './stream-event-codec.ts';

async function* events(values: ChatStreamEvent[]): AsyncGenerator<ChatStreamEvent> {
  yield* values;
}

describe('chat session controller', () => {
  test('sends and finalizes a streamed assistant response', async () => {
    let conversation = createConversationHistory({ id: 'test' });
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => events([{ type: 'text', text: 'hello' }]),
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []);
    expect(Object.values(conversation.messages).map((message) => message.content)).toEqual([
      'hi',
      'hello',
    ]);
    expect(
      Object.values(conversation.messages).some(
        (message) => message.metadata['streaming'] === true,
      ),
    ).toBe(false);
  });

  test('synchronizes subscribed stream lifecycle with the controller placeholder', async () => {
    let conversation = createConversationHistory({ id: 'subscribe' });
    const eventsSeen: string[] = [];
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => events([{ type: 'text', text: 'hello' }]),
    });
    controller.adapter.subscribe?.('subscribe', {
      onMessage: () => undefined,
      onTypingChange: () => undefined,
      onReadReceipt: () => undefined,
      onStreamBegin: (id) => eventsSeen.push(`begin:${id}`),
      onTokenPush: (token) => eventsSeen.push(`token:${token}`),
      onStreamEnd: () => eventsSeen.push('end'),
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []);
    expect(eventsSeen).toEqual([`begin:${conversation.ids[1]}`, 'token:hello', 'end']);
  });

  test('ignores subscriptions for another conversation', async () => {
    let conversation = createConversationHistory({ id: 'current' });
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => events([{ type: 'text', text: 'hello' }]),
    });
    const unsubscribe = controller.adapter.subscribe?.('another-conversation', {
      onMessage: () => undefined,
      onTypingChange: () => undefined,
      onReadReceipt: () => undefined,
      onStreamBegin: () => {
        throw new Error('wrong conversation received stream events');
      },
      onTokenPush: () => undefined,
      onStreamEnd: () => undefined,
    });

    unsubscribe?.();
    await controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []);
    expect(Object.values(conversation.messages).at(-1)?.content).toBe('hello');
  });

  test('does not continue while any emitted tool call lacks a result', async () => {
    let conversation = createConversationHistory({ id: 'unresolved-tool-call' });
    let calls = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        calls += 1;
        return events([
          { type: 'tool_call', id: 'resolved', name: 'read', arguments: {} },
          { type: 'tool_result', callId: 'resolved', outcome: 'success', content: 'ok' },
          { type: 'tool_call', id: 'pending', name: 'external', arguments: {} },
        ]);
      },
    });

    await controller.adapter.sendMessage({ role: 'user', content: 'run tools' }, []);
    expect(calls).toBe(1);
  });

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
          { type: 'tool_result', callId: 'call', outcome: 'action_required', content: null },
        ]),
      hooks: { approveToolCall: async () => undefined },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'write' }, []);
    await expect(controller.adapter.approveToolCall?.('call')).rejects.toThrow('must return');
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
    await expect(
      controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []),
    ).rejects.toThrow('offline');
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
    await expect(
      controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []),
    ).rejects.toThrow();
    const messageId = conversation.ids[0]!;
    await controller.adapter.retryMessage?.(messageId);
    expect(conversation.messages[messageId]?.metadata['_deliveryStatus']).toBeUndefined();
  });

  test('retries the latest user turn when retained tool rows follow it', async () => {
    let conversation = createConversationHistory({ id: 'retry-retained-tools' });
    let attempts = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('failed after tool execution');
        return events([{ type: 'text', text: 'recovered' }]);
      },
    });
    await expect(
      controller.adapter.sendMessage({ role: 'user', content: 'run' }, []),
    ).rejects.toThrow('failed after tool execution');
    const userMessageId = conversation.ids[0]!;
    conversation = appendToolResult(
      appendToolCall(conversation, { id: 'retained-call', name: 'read', arguments: {} }),
      { callId: 'retained-call', outcome: 'success', content: 'retained' },
    );

    await controller.adapter.retryMessage?.(userMessageId);

    expect(Object.values(conversation.messages).at(-1)?.content).toBe('recovered');
  });

  test('rewinds an edited message and discards its superseded branch', async () => {
    let conversation = createConversationHistory({ id: 'edit' });
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => events([{ type: 'text', text: 'new reply' }]),
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'old' }, []);
    const oldId = conversation.ids[0]!;
    await controller.adapter.editMessage?.({ messageId: oldId, content: 'new' });
    expect(Object.values(conversation.messages).map((message) => message.content)).toEqual([
      'new',
      'new reply',
    ]);
  });

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

  test('continues after a tool result and invokes approval hooks', async () => {
    let conversation = createConversationHistory({ id: 'tools' });
    let calls = 0;
    let approved = '';
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        calls += 1;
        return calls === 1
          ? events([
              { type: 'tool_call', id: 'call', name: 'read', arguments: {} },
              { type: 'tool_result', callId: 'call', outcome: 'success', content: 'ok' },
            ])
          : events([{ type: 'text', text: 'done' }]);
      },
      hooks: {
        approveToolCall: async (id) => {
          approved = id;
          return undefined;
        },
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'run' }, []);
    expect(calls).toBe(2);
    expect(approved).toBe('');
    expect(Object.values(conversation.messages).some((message) => message.content === 'done')).toBe(
      true,
    );
  });

  test('waits for approval before continuing a tool turn', async () => {
    let conversation = createConversationHistory({ id: 'approval' });
    let calls = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        calls += 1;
        return calls === 1
          ? events([
              { type: 'tool_call', id: 'call', name: 'write', arguments: {} },
              { type: 'tool_result', callId: 'call', outcome: 'action_required', content: null },
            ])
          : events([{ type: 'text', text: 'approved' }]);
      },
      hooks: {
        approveToolCall: async (toolCallId) => ({
          callId: toolCallId,
          outcome: 'success',
          content: 'allowed',
        }),
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'write' }, []);
    expect(calls).toBe(1);
    await controller.adapter.approveToolCall?.('call');
    expect(calls).toBe(2);
    expect(
      Object.values(conversation.messages).some((message) => message.content === 'approved'),
    ).toBe(true);
  });

  test('continues a persisted approval from its owning user turn', async () => {
    let conversation = appendToolResult(
      appendToolCall(
        appendAssistantMessage(
          appendUserMessage(createConversationHistory({ id: 'persisted-approval' }), 'write'),
          'I need approval first.',
        ),
        { id: 'call', name: 'write', arguments: {} },
      ),
      { callId: 'call', outcome: 'action_required', content: null },
    );
    let calls = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        calls += 1;
        return events([{ type: 'text', text: 'approved after reload' }]);
      },
      hooks: {
        approveToolCall: async (toolCallId) => ({
          callId: toolCallId,
          outcome: 'success',
          content: 'allowed',
        }),
      },
    });

    await controller.adapter.approveToolCall?.('call');

    expect(calls).toBe(1);
    expect(
      Object.values(conversation.messages).some(
        (message) => message.content === 'approved after reload',
      ),
    ).toBe(true);
  });

  test('resolves a persisted orphan approval without inventing a user owner', async () => {
    let conversation = appendToolResult(
      appendToolCall(
        appendAssistantMessage(createConversationHistory({ id: 'orphan-approval' }), 'Working.'),
        { id: 'call', name: 'write', arguments: {} },
      ),
      { callId: 'call', outcome: 'action_required', content: null },
    );
    let calls = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        calls += 1;
        return events([{ type: 'text', text: 'unexpected' }]);
      },
      hooks: {
        approveToolCall: async (toolCallId) => ({
          callId: toolCallId,
          outcome: 'success',
          content: 'allowed',
        }),
      },
    });

    await controller.adapter.approveToolCall?.('call');

    expect(calls).toBe(0);
  });

  test('does not continue when action_required is followed by success in one batch', async () => {
    let conversation = createConversationHistory({ id: 'mixed-batch' });
    let calls = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => {
        calls += 1;
        return events([
          { type: 'tool_call', id: 'a', name: 'write', arguments: {} },
          { type: 'tool_result', callId: 'a', outcome: 'action_required', content: null },
          { type: 'tool_call', id: 'b', name: 'read', arguments: {} },
          { type: 'tool_result', callId: 'b', outcome: 'success', content: 'late' },
        ]);
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'write' }, []);
    expect(calls).toBe(1);
  });

  test('rolls back partial output on a non-abort stream failure', async () => {
    let conversation = createConversationHistory({ id: 'rollback' });
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async function* () {
        yield { type: 'text', text: 'partial' } as const;
        throw new Error('broken stream');
      },
    });
    await expect(
      controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []),
    ).rejects.toThrow('broken stream');
    expect(Object.values(conversation.messages).map((message) => message.content)).toEqual(['hi']);
    expect(Object.values(conversation.messages)[0]?.metadata['_deliveryStatus']).toBe('failed');
  });

  test('passes attachments to the transport', async () => {
    let conversation = createConversationHistory({ id: 'attachments' });
    let received = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async ({ attachments }) => {
        received = attachments.length;
        return events([{ type: 'text', text: 'ok' }]);
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'hi' }, [
      {
        id: 'attachment-1',
        file: new File(['x'], 'x.txt', { type: 'text/plain' }),
        previewUrl: 'blob:attachment-1',
        kind: 'document',
        status: 'ready',
      },
    ]);
    expect(received).toBe(1);
  });

  test('marks the initiating user message when approval continuation fails', async () => {
    let conversation = createConversationHistory({ id: 'approval-failure' });
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () =>
        events([
          { type: 'tool_call', id: 'call', name: 'write', arguments: {} },
          { type: 'tool_result', callId: 'call', outcome: 'action_required', content: null },
        ]),
      hooks: {
        approveToolCall: async () => {
          throw new Error('approval unavailable');
        },
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'write' }, []);
    await expect(controller.adapter.approveToolCall?.('call')).rejects.toThrow(
      'approval unavailable',
    );
    expect(Object.values(conversation.messages)[0]?.metadata['_deliveryStatus']).toBeUndefined();
  });

  test('marks the initiating user message when denial continuation fails', async () => {
    let conversation = createConversationHistory({ id: 'denial-failure' });
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () =>
        events([
          { type: 'tool_call', id: 'call', name: 'write', arguments: {} },
          { type: 'tool_result', callId: 'call', outcome: 'action_required', content: null },
        ]),
      hooks: {
        denyToolCall: async () => {
          throw new Error('denial unavailable');
        },
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'write' }, []);
    await expect(controller.adapter.denyToolCall?.('call')).rejects.toThrow('denial unavailable');
    expect(Object.values(conversation.messages)[0]?.metadata['_deliveryStatus']).toBeUndefined();
  });

  test('rejects every mutating adapter command after disposal without changing history', async () => {
    let conversation = createConversationHistory({ id: 'disposed' });
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () => events([{ type: 'text', text: 'unexpected' }]),
      hooks: { approveToolCall: async () => undefined, denyToolCall: async () => undefined },
    });
    const original = conversation;
    controller.dispose();
    await expect(
      controller.adapter.sendMessage({ role: 'user', content: 'x' }, []),
    ).rejects.toThrow('disposed');
    await expect(controller.adapter.retryMessage?.('missing')).rejects.toThrow('disposed');
    await expect(
      controller.adapter.editMessage?.({ messageId: 'missing', content: 'x' }),
    ).rejects.toThrow('disposed');
    await expect(controller.adapter.approveToolCall?.('missing')).rejects.toThrow('disposed');
    await expect(controller.adapter.denyToolCall?.('missing')).rejects.toThrow('disposed');
    await expect(controller.adapter.stopGenerating?.('missing')).rejects.toThrow('disposed');
    expect(conversation).toBe(original);
  });

  test('decodes Response transports and resumes through denial hooks', async () => {
    let conversation = createConversationHistory({ id: 'denial' });
    let calls = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () =>
        new Response(
          calls++ === 0
            ? '{"type":"tool_call","id":"call","name":"delete","arguments":{}}\n{"type":"tool_result","callId":"call","outcome":"action_required","content":null}\n'
            : '{"type":"text","text":"denied"}\n',
          { headers: { 'Content-Type': 'application/x-ndjson' } },
        ),
      hooks: {
        denyToolCall: async (toolCallId) => ({
          callId: toolCallId,
          outcome: 'error',
          content: null,
          error: { code: 'denied', category: 'permission', retryable: false, message: 'Denied' },
        }),
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'delete' }, []);
    await controller.adapter.denyToolCall?.('call');
    expect(calls).toBe(2);
    expect(
      Object.values(conversation.messages).some((message) => message.content === 'denied'),
    ).toBe(true);
  });

  test('fails after the bounded continuation limit and disposes future commands', async () => {
    let conversation = createConversationHistory({ id: 'limit' });
    const errors: unknown[] = [];
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      maxContinuationTurns: 1,
      transport: async () =>
        events([
          { type: 'tool_call', id: 'call', name: 'read', arguments: {} },
          { type: 'tool_result', callId: 'call', outcome: 'success', content: 'ok' },
        ]),
      hooks: { onError: (error) => errors.push(error) },
    });
    await expect(
      controller.adapter.sendMessage({ role: 'user', content: 'run' }, []),
    ).rejects.toThrow('continuation limit');
    expect(errors).toHaveLength(1);
    controller.dispose();
    await expect(
      controller.adapter.sendMessage({ role: 'user', content: 'again' }, []),
    ).rejects.toThrow('disposed');
  });

  test('clears a stale delivery failure after approval recovery succeeds', async () => {
    let conversation = createConversationHistory({ id: 'approval-recovery' });
    let calls = 0;
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () =>
        calls++ === 0
          ? events([
              { type: 'tool_call', id: 'call', name: 'write', arguments: {} },
              { type: 'tool_result', callId: 'call', outcome: 'action_required', content: null },
            ])
          : events([{ type: 'text', text: 'recovered' }]),
      hooks: {
        approveToolCall: async (id) => ({ callId: id, outcome: 'success', content: 'allowed' }),
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'write' }, []);
    const userId = conversation.ids[0]!;
    conversation = {
      ...conversation,
      messages: {
        ...conversation.messages,
        [userId]: {
          ...conversation.messages[userId]!,
          metadata: { ...conversation.messages[userId]!.metadata, _deliveryStatus: 'failed' },
        },
      },
    };
    await controller.adapter.approveToolCall?.('call');
    expect(conversation.messages[userId]?.metadata['_deliveryStatus']).toBeUndefined();
  });

  test('stores attachments under an edited replacement id for retry', async () => {
    let conversation = createConversationHistory({ id: 'edit-attachments' });
    let calls = 0;
    const attachment = {
      id: 'attachment-1',
      file: new File(['x'], 'note.txt', { type: 'text/plain' }),
      previewUrl: 'blob:attachment-1',
      kind: 'document',
      status: 'ready',
    } satisfies ChatAttachment;
    const received: number[] = [];
    const controller = createChatSessionController({
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async ({ attachments }) => {
        received.push(attachments.length);
        if (calls++ === 1) throw new Error('failed edit');
        return events([{ type: 'text', text: 'ok' }]);
      },
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'old' }, [attachment]);
    const originalId = conversation.ids[0]!;
    await expect(
      controller.adapter.editMessage?.({ messageId: originalId, content: 'edited' }),
    ).rejects.toThrow('failed edit');
    const replacementId = conversation.ids[0]!;
    await controller.adapter.retryMessage?.(replacementId);
    expect(received).toEqual([1, 1, 1]);
  });
});
