import { describe, expect, test } from 'bun:test';
import { createConversationHistory } from '../components/chat/builders.ts';
import type { ConversationHistory } from '../components/chat/conversation-model.ts';
import { createChatSessionController } from './session-controller.ts';
import type { ChatStreamEvent } from './stream-event-codec.ts';

async function* events(values: ChatStreamEvent[]): AsyncGenerator<ChatStreamEvent> {
  yield* values;
}

function rolesOf(conversation: ConversationHistory): string[] {
  return conversation.ids.map((id) => conversation.messages[id]?.role ?? 'missing');
}

function contentOf(conversation: ConversationHistory, id: string): unknown {
  return conversation.messages[id]?.content;
}

/**
 * Every fixture here closes with `run.aborted`, which the wire contract
 * requires of a versioned stream and which is the one terminal frame that
 * carries no authoritative history. That keeps these assertions about what
 * the reducer builds from the step frames alone; reconciliation against a
 * terminal snapshot is covered separately.
 */
describe('assistant step boundaries', () => {
  test("a second step's reply lands in its own row, after the tool activity", async () => {
    let conversation = createConversationHistory({ id: 'steps' });
    const controller = createChatSessionController({
      executionOwner: 'server',
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () =>
        events([
          {
            type: 'assistant.step.started',
            step: 0,
            messageId: 'host-0',
            wireVersion: 2,
            sequence: 0,
          },
          { type: 'text', text: 'Saving that.', wireVersion: 2, sequence: 1 },
          {
            type: 'tool_call',
            id: 'call-1',
            name: 'remember_note',
            arguments: {},
            wireVersion: 2,
            sequence: 2,
          },
          {
            type: 'tool_result',
            callId: 'call-1',
            outcome: 'success',
            content: 'ok',
            wireVersion: 2,
            sequence: 3,
          },
          {
            type: 'assistant.step.completed',
            step: 0,
            messageId: 'host-0',
            wireVersion: 2,
            sequence: 4,
          },
          {
            type: 'assistant.step.started',
            step: 1,
            messageId: 'host-1',
            wireVersion: 2,
            sequence: 5,
          },
          { type: 'text', text: 'Saved that note.', wireVersion: 2, sequence: 6 },
          {
            type: 'assistant.step.completed',
            step: 1,
            messageId: 'host-1',
            wireVersion: 2,
            sequence: 7,
          },
          { type: 'run.aborted', wireVersion: 2, sequence: 8 },
        ]),
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'remember this' }, []);

    // The host's identifiers are the row identifiers — the controller's
    // provisional placeholder is remapped onto the first one rather than
    // living alongside it.
    expect(conversation.ids).toContain('host-0');
    expect(conversation.ids).toContain('host-1');
    expect(contentOf(conversation, 'host-0')).toBe('Saving that.');
    expect(contentOf(conversation, 'host-1')).toBe('Saved that note.');

    const first = conversation.ids.indexOf('host-0');
    const toolCall = conversation.ids.findIndex(
      (id) => conversation.messages[id]?.role === 'tool-call',
    );
    const second = conversation.ids.indexOf('host-1');
    expect(first).toBeLessThan(toolCall);
    expect(toolCall).toBeLessThan(second);
    expect(rolesOf(conversation)).toEqual([
      'user',
      'assistant',
      'tool-call',
      'tool-result',
      'assistant',
    ]);
  });

  test('a single-step response keeps one assistant row under the host identifier', async () => {
    let conversation = createConversationHistory({ id: 'one-step' });
    const controller = createChatSessionController({
      executionOwner: 'server',
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () =>
        events([
          {
            type: 'assistant.step.started',
            step: 0,
            messageId: 'host-only',
            wireVersion: 2,
            sequence: 0,
          },
          { type: 'text', text: 'Hello.', wireVersion: 2, sequence: 1 },
          {
            type: 'assistant.step.completed',
            step: 0,
            messageId: 'host-only',
            wireVersion: 2,
            sequence: 2,
          },
          { type: 'run.aborted', wireVersion: 2, sequence: 3 },
        ]),
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []);
    expect(rolesOf(conversation)).toEqual(['user', 'assistant']);
    expect(contentOf(conversation, 'host-only')).toBe('Hello.');
  });

  test('a tool-only first step leaves no empty assistant bubble behind', async () => {
    let conversation = createConversationHistory({ id: 'tool-only-step' });
    const controller = createChatSessionController({
      executionOwner: 'server',
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () =>
        events([
          {
            type: 'assistant.step.started',
            step: 0,
            messageId: 'host-0',
            wireVersion: 2,
            sequence: 0,
          },
          {
            type: 'tool_call',
            id: 'call-1',
            name: 'remember_note',
            arguments: {},
            wireVersion: 2,
            sequence: 1,
          },
          {
            type: 'tool_result',
            callId: 'call-1',
            outcome: 'success',
            content: 'ok',
            wireVersion: 2,
            sequence: 2,
          },
          {
            type: 'assistant.step.completed',
            step: 0,
            messageId: 'host-0',
            wireVersion: 2,
            sequence: 3,
          },
          {
            type: 'assistant.step.started',
            step: 1,
            messageId: 'host-1',
            wireVersion: 2,
            sequence: 4,
          },
          { type: 'text', text: 'Saved that note.', wireVersion: 2, sequence: 5 },
          { type: 'run.aborted', wireVersion: 2, sequence: 6 },
        ]),
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'remember this' }, []);
    // The model called the tool without saying anything first. That step owns
    // no prose, so it owns no row — an empty finalized bubble above the tool
    // activity is a row nothing will ever fill.
    expect(rolesOf(conversation)).toEqual(['user', 'tool-call', 'tool-result', 'assistant']);
    expect(contentOf(conversation, 'host-1')).toBe('Saved that note.');
  });

  test('a repeated step boundary for the same step does not open another row', async () => {
    let conversation = createConversationHistory({ id: 'repeat-step' });
    const controller = createChatSessionController({
      executionOwner: 'server',
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () =>
        events([
          {
            type: 'assistant.step.started',
            step: 0,
            messageId: 'host-0',
            wireVersion: 2,
            sequence: 0,
          },
          {
            type: 'assistant.step.started',
            step: 0,
            messageId: 'host-0',
            wireVersion: 2,
            sequence: 1,
          },
          { type: 'text', text: 'Once.', wireVersion: 2, sequence: 2 },
          { type: 'run.aborted', wireVersion: 2, sequence: 3 },
        ]),
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []);
    expect(rolesOf(conversation)).toEqual(['user', 'assistant']);
  });
});

describe('legacy and rich projections of the same content', () => {
  test('a rich text stream wins and the legacy echo of it is dropped', async () => {
    let conversation = createConversationHistory({ id: 'rich-first' });
    const controller = createChatSessionController({
      executionOwner: 'server',
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () =>
        events([
          {
            type: 'stream:text-delta',
            content: 'rich',
            accumulated: 'rich',
            wireVersion: 1,
            sequence: 0,
          },
          { type: 'text', text: ' and legacy', wireVersion: 1, sequence: 1 },
          { type: 'run.aborted', wireVersion: 1, sequence: 2 },
        ]),
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []);
    const assistant = conversation.ids.find(
      (id) => conversation.messages[id]?.role === 'assistant',
    );
    expect(assistant).toBeDefined();
    expect(contentOf(conversation, assistant ?? '')).toBe('rich');
  });

  test('a legacy text stream wins and the rich echo of it is dropped', async () => {
    let conversation = createConversationHistory({ id: 'legacy-first' });
    const controller = createChatSessionController({
      executionOwner: 'server',
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () =>
        events([
          { type: 'text', text: 'legacy', wireVersion: 1, sequence: 0 },
          {
            type: 'stream:text-delta',
            content: ' and rich',
            accumulated: 'legacy and rich',
            wireVersion: 1,
            sequence: 1,
          },
          { type: 'run.aborted', wireVersion: 1, sequence: 2 },
        ]),
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []);
    const assistant = conversation.ids.find(
      (id) => conversation.messages[id]?.role === 'assistant',
    );
    expect(contentOf(conversation, assistant ?? '')).toBe('legacy');
  });

  test('tool.settled produces a result row when nothing settled that call yet', async () => {
    let conversation = createConversationHistory({ id: 'settled-only' });
    const controller = createChatSessionController({
      executionOwner: 'server',
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () =>
        events([
          {
            type: 'tool_call',
            id: 'call-1',
            name: 'note',
            arguments: {},
            wireVersion: 1,
            sequence: 0,
          },
          {
            type: 'tool.settled',
            toolCallId: 'call-1',
            toolName: 'note',
            result: { callId: 'call-1', outcome: 'success', content: 'ok' },
            wireVersion: 1,
            sequence: 1,
          },
          { type: 'run.aborted', wireVersion: 1, sequence: 2 },
        ]),
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []);
    expect(rolesOf(conversation)).toEqual(['user', 'tool-call', 'tool-result']);
  });

  test('a call settled twice, once each way, produces exactly one result row', async () => {
    let conversation = createConversationHistory({ id: 'settled-twice' });
    const results: unknown[] = [];
    const controller = createChatSessionController({
      executionOwner: 'server',
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      hooks: { onToolResult: (result) => results.push(result) },
      transport: async () =>
        events([
          {
            type: 'tool_call',
            id: 'call-1',
            name: 'note',
            arguments: {},
            wireVersion: 1,
            sequence: 0,
          },
          {
            type: 'tool_result',
            callId: 'call-1',
            outcome: 'success',
            content: 'ok',
            wireVersion: 1,
            sequence: 1,
          },
          {
            type: 'tool.settled',
            toolCallId: 'call-1',
            toolName: 'note',
            result: { callId: 'call-1', outcome: 'success', content: 'ok again' },
            wireVersion: 1,
            sequence: 2,
          },
          { type: 'run.aborted', wireVersion: 1, sequence: 3 },
        ]),
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []);
    expect(rolesOf(conversation)).toEqual(['user', 'tool-call', 'tool-result']);
    expect(results).toHaveLength(1);
  });
});

describe('a settlement that outruns the call it settles', () => {
  test('tool.settled before its tool_call is left for the transcript-ordered frame', async () => {
    let conversation = createConversationHistory({ id: 'settled-early' });
    const results: unknown[] = [];
    const controller = createChatSessionController({
      executionOwner: 'server',
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      hooks: { onToolResult: (result) => results.push(result) },
      transport: async () =>
        events([
          // Emitted when the tool FINISHES EXECUTING, which is before the
          // step that owns it completes — so it reaches the wire ahead of the
          // `tool_call` frame describing the call it settles.
          {
            type: 'tool.settled',
            toolCallId: 'call-1',
            toolName: 'note',
            result: { callId: 'call-1', outcome: 'success', content: 'ok' },
            wireVersion: 1,
            sequence: 0,
          },
          {
            type: 'tool_call',
            id: 'call-1',
            name: 'note',
            arguments: {},
            wireVersion: 1,
            sequence: 1,
          },
          {
            type: 'tool_result',
            callId: 'call-1',
            outcome: 'success',
            content: 'ok',
            wireVersion: 1,
            sequence: 2,
          },
          { type: 'run.aborted', wireVersion: 1, sequence: 3 },
        ]),
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'hi' }, []);
    // A result row may not precede the call it belongs to: the conversation
    // model rejects a tool result that references a call it cannot see.
    expect(rolesOf(conversation)).toEqual(['user', 'tool-call', 'tool-result']);
    expect(results).toHaveLength(1);
  });
});
