import { describe, expect, test } from 'bun:test';
import {
  appendMessages,
  createConversationHistory,
  markMessageDeliveryFailed,
} from '../components/chat/builders.ts';
import type { ConversationHistory, MessageInput } from '../components/chat/conversation-model.ts';
import { createChatSessionController } from './session-controller.ts';
import type { ChatStreamEvent } from './stream-event-codec.ts';

async function* events(values: ChatStreamEvent[]): AsyncGenerator<ChatStreamEvent> {
  yield* values;
}

/** A history built with identifiers a server would have minted, not the client. */
function serverHistory(id: string, ...inputs: MessageInput[]): ConversationHistory {
  let minted = 0;
  const environment = {
    randomId: () => {
      minted += 1;
      return `server-${minted}`;
    },
  };
  return inputs.reduce(
    (history, input) => appendMessages(history, input, environment),
    createConversationHistory({ id }),
  );
}

function contentsOf(conversation: ConversationHistory): unknown[] {
  return conversation.ids.map((id) => conversation.messages[id]?.content);
}

function terminalFrame(conversation: ConversationHistory, sequence: number): ChatStreamEvent {
  return {
    type: 'run.completed',
    conversation,
    content: '',
    usage: { prompt: 0, completion: 0, total: 0 },
    finishReason: 'stop',
    wireVersion: 1,
    sequence,
  };
}

describe('run-terminal reconciliation', () => {
  test("an eligible terminal replaces this run's own rows and identifiers", async () => {
    let conversation = createConversationHistory({ id: 'terminal' });
    const authoritative = serverHistory(
      'terminal',
      { role: 'user', content: 'remember this' },
      { role: 'assistant', content: 'Saved that note.' },
    );
    const controller = createChatSessionController({
      executionOwner: 'server',
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () =>
        events([
          { type: 'text', text: 'Saving', wireVersion: 1, sequence: 0 },
          terminalFrame(authoritative, 1),
        ]),
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'remember this' }, []);
    expect(conversation.ids).toEqual([...authoritative.ids]);
    expect(contentsOf(conversation)).toEqual(['remember this', 'Saved that note.']);
  });

  test('turns the run did not own survive the terminal untouched', async () => {
    const prior = appendMessages(
      appendMessages(createConversationHistory({ id: 'prior' }), {
        role: 'user',
        content: 'an earlier question',
      }),
      { role: 'assistant', content: 'an earlier answer' },
    );
    const priorIds = [...prior.ids];
    let conversation = prior;
    const authoritative = serverHistory(
      'prior',
      { role: 'user', content: 'the new question' },
      { role: 'assistant', content: 'the new answer' },
    );
    const controller = createChatSessionController({
      executionOwner: 'server',
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () =>
        events([
          { type: 'text', text: 'thinking', wireVersion: 1, sequence: 0 },
          terminalFrame(authoritative, 1),
        ]),
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'the new question' }, []);
    expect(conversation.ids.slice(0, 2)).toEqual(priorIds);
    expect(contentsOf(conversation)).toEqual([
      'an earlier question',
      'an earlier answer',
      'the new question',
      'the new answer',
    ]);
  });

  test('a terminal that arrives after a later full snapshot was accepted is dropped', async () => {
    let conversation = createConversationHistory({ id: 'raced' });
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    const stale = serverHistory('raced', { role: 'assistant', content: 'stale terminal' });
    const controller = createChatSessionController({
      executionOwner: 'server',
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () =>
        (async function* (): AsyncGenerator<ChatStreamEvent> {
          yield { type: 'text', text: 'partial', wireVersion: 1, sequence: 0 };
          await gate;
          yield terminalFrame(stale, 1);
        })(),
    });
    const sent = controller.adapter.sendMessage({ role: 'user', content: 'go' }, []);
    await Promise.resolve();

    // The user cancelled, and the host then installed the authoritative
    // history it fetched for itself. The run's terminal frame is still in
    // flight behind both of those.
    await controller.stop();
    const adopted = serverHistory('raced', { role: 'assistant', content: 'newer snapshot' });
    expect(controller.adoptHistory(adopted, controller.captureHistoryToken())).toBe(true);
    release();
    await sent;

    expect(contentsOf(conversation)).toEqual(['newer snapshot']);
  });

  test('a terminal for a run the host navigated away from is dropped', async () => {
    let conversation = createConversationHistory({ id: 'alpha' });
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    const stale = serverHistory('alpha', { role: 'assistant', content: 'stale terminal' });
    let navigated = false;
    const writesAfterNavigation: unknown[] = [];
    const controller = createChatSessionController({
      executionOwner: 'server',
      getConversation: () => conversation,
      setConversation: (next) => {
        if (navigated) writesAfterNavigation.push(next.id);
        conversation = next;
      },
      transport: async () =>
        (async function* (): AsyncGenerator<ChatStreamEvent> {
          yield { type: 'text', text: 'partial', wireVersion: 1, sequence: 0 };
          await gate;
          yield terminalFrame(stale, 1);
        })(),
    });
    const sent = controller.adapter.sendMessage({ role: 'user', content: 'go' }, []);
    await Promise.resolve();
    navigated = true;
    conversation = createConversationHistory({ id: 'beta' });
    release();
    await sent;
    expect(writesAfterNavigation).toEqual([]);
    expect(conversation.ids).toHaveLength(0);
  });
});

describe('run-terminal reconciliation and local decoration', () => {
  test('local decoration on a prior turn survives a terminal that names it', async () => {
    const base = appendMessages(createConversationHistory({ id: 'decorated' }), {
      role: 'user',
      content: 'an earlier question',
    });
    const priorId = base.ids[0] ?? '';
    // A local-only marker the server knows nothing about.
    let conversation = markMessageDeliveryFailed(base, priorId);
    expect(conversation.messages[priorId]?.metadata['_deliveryStatus']).toBe('failed');

    // The terminal names the same row, under the same identifier, without
    // the marker — as a server that never saw the failure would.
    const authoritative = appendMessages(
      { ...base, messages: { ...base.messages } },
      { role: 'assistant', content: 'the answer' },
    );
    const controller = createChatSessionController({
      executionOwner: 'server',
      getConversation: () => conversation,
      setConversation: (next) => {
        conversation = next;
      },
      transport: async () =>
        events([
          { type: 'text', text: 'thinking', wireVersion: 1, sequence: 0 },
          terminalFrame(authoritative, 1),
        ]),
    });
    await controller.adapter.sendMessage({ role: 'user', content: 'the new question' }, []);
    expect(conversation.messages[priorId]?.metadata['_deliveryStatus']).toBe('failed');
  });
});
